// Vanilla port of the Coffee Pour Menu reference in ../reference/coffee-pour-menu.tsx.
// Same stage, physics and animation, recoloured for the Nzu chalk theme. Each drink
// supplies its own colours for the three liquid slots: deep, clear, creamy.

const W = 360;
const H = 400;
const FLOOR = 330;
const CX = 180;
const SRC = -FLOOR - 10; // pour source, local y, just above the stage
const P = 0.34; // ellipse squash: how far above the table we look from
const N = 14; // liquid column cells

const G_STREAM = 3000;
const G_FALL = 2600;
const V0 = 220;
const PARTS = 26;
const RIPPLES = 6;
const TENDRILS = 3;
const SPILLS = 32;

const f1 = (n) => Math.round(n * 10) / 10;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mid = (p) => (p.top + p.bot) / 2;

const mixRGB = (a, b, t) => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function hexToRgb(str) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(str.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

// Colours come from css/styles.css :root once, no hardcoded second copy.
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => hexToRgb(cs.getPropertyValue(`--${name}`)) ?? fallback;
  return {
    page: pick("background", [244, 238, 226]),
    card: pick("card", [251, 247, 238]),
    border: pick("border", [226, 215, 195]),
    ink: pick("foreground", [38, 26, 20]),
    mutedInk: pick("muted-foreground", [110, 94, 82]),
    accent: pick("accent", [122, 30, 70]),
    island: pick("island", [230, 219, 200]),
    islandLow: pick("island-low", [218, 205, 183]),
    islandWall: pick("island-wall", [200, 185, 159]),
  };
}

// Quadratic wall: top radius r, bottom radius rb, control x c (y is linear in t).
// wallR gives the wall radius at t (0 top, 1 bottom).
const wallR = (p, t) =>
  (1 - t) * (1 - t) * p.r + 2 * t * (1 - t) * p.c + t * t * p.rb;

// Closed outline seen through the opening: back rim arc, walls, front bottom arc.
function silhouette(p) {
  const m = mid(p);
  return `M${-p.r} ${p.top}A${p.r} ${f1(p.r * P)} 0 0 1 ${p.r} ${p.top}Q${p.c} ${m} ${p.rb} ${p.bot}A${p.rb} ${f1(p.rb * P)} 0 0 1 ${-p.rb} ${p.bot}Q${-p.c} ${m} ${-p.r} ${p.top}Z`;
}

// Outer body whose top edge is the front of the rim.
function bodyPath(p) {
  const m = mid(p);
  return `M${-p.r} ${p.top}Q${-p.c} ${m} ${-p.rb} ${p.bot}A${p.rb} ${f1(p.rb * P)} 0 0 0 ${p.rb} ${p.bot}Q${p.c} ${m} ${p.r} ${p.top}A${p.r} ${f1(p.r * P)} 0 0 1 ${-p.r} ${p.top}Z`;
}

// Band between two concentric front arcs (rim lip, saucer edge, glass base).
function frontBand(r1, y1, r2, y2) {
  return `M${-r1} ${y1}A${r1} ${f1(r1 * P)} 0 0 0 ${r1} ${y1}L${r2} ${y2}A${r2} ${f1(r2 * P)} 0 0 1 ${-r2} ${y2}Z`;
}

// A line running down the wall at a fraction k of its radius.
function wallLine(p, k, t0, t1) {
  const y0 = lerp(p.top, p.bot, t0);
  const y1 = lerp(p.top, p.bot, t1);
  const ym = (y0 + y1) / 2;
  return `M${f1(k * wallR(p, t0))} ${f1(y0)}Q${f1(k * wallR(p, (t0 + t1) / 2) * 1.02)} ${f1(ym)} ${f1(k * wallR(p, t1))} ${f1(y1)}`;
}

function ramp(stops, t) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [p, c] = stops[i];
    if (t <= p) {
      const [p0, c0] = stops[i - 1];
      return mixRGB(c0, c, (t - p0) / (p - p0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}

// Colour and opacity of a mix of the deep, clear and creamy slots.
function shade(e, w, m, pal) {
  const s = e + w + m || 1;
  e /= s;
  w /= s;
  m /= s;
  const c = e + w > 1e-4 ? 1 - Math.pow(1 - e / (e + w), 2) : 1;
  let rgb = ramp(pal.deep.ramp, c);
  const aC = c < 0.35 ? lerp(0.18, 0.88, c / 0.35) : lerp(0.88, 1, Math.min(1, (c - 0.35) / 0.35));
  if (m > 0.001) {
    const st = [[0, rgb], ...pal.creamy.ramp.map(([p, col]) => [p, mixRGB(pal.creamy.base, col, c)])];
    rgb = ramp(st, m);
  }
  return [rgb, 1 - (1 - aC) * (1 - Math.min(1, m * 3))];
}

const TYPE_INDEX = { deep: 0, clear: 1, creamy: 2 };
const PEN = { deep: 0.3, clear: 0.1, creamy: 0.18 };
const JET = { deep: 0.9, clear: 0.5, creamy: 0.8 };

const GEO = {
  demitasse: {
    outer: { top: -86, r: 46, bot: -14, rb: 27, c: 53 },
    // shallow on purpose: an opaque cup only shows liquid near the rim
    inner: { top: -86, r: 41, bot: -60, rb: 33, c: 42 },
    glass: false,
    glaze: "terra",
    saucer: { y: -6, r: 90 },
    handle: "M41 -74C66 -80 76 -56 60 -44C52 -38 42 -37 34 -39",
    handleW: 8,
    height: 92,
    shadowR: 90,
    streamX: 0.12,
    streamW: 3,
  },
  "glass-mug": {
    outer: { top: -170, r: 58, bot: 0, rb: 52, c: 55 },
    inner: { top: -170, r: 53.5, bot: -16, rb: 46.5, c: 50 },
    glass: true,
    handle: "M55 -148C94 -148 98 -130 98 -100C98 -64 92 -42 53 -40",
    handleW: 13,
    height: 172,
    shadowR: 62,
    streamX: 0.14,
    streamW: 4.2,
  },
  cup: {
    outer: { top: -114, r: 80, bot: -16, rb: 38, c: 95 },
    inner: { top: -114, r: 74.5, bot: -76, rb: 57, c: 74 },
    glass: false,
    glaze: "cream",
    saucer: { y: -6, r: 132 },
    handle: "M75 -98C112 -106 126 -68 98 -52C88 -46 78 -45 66 -47",
    handleW: 11,
    height: 120,
    shadowR: 132,
    streamX: 0.13,
    streamW: 4,
  },
  "tall-glass": {
    outer: { top: -238, r: 48, bot: 0, rb: 39, c: 43.5 },
    inner: { top: -238, r: 44.5, bot: -24, rb: 35, c: 39.8 },
    glass: true,
    height: 240,
    shadowR: 48,
    streamX: 0.12,
    streamW: 4,
  },
};

const HEART = "M0 0.78C-0.5 0.36 -0.98 0.02 -0.68 -0.48C-0.46 -0.82 -0.1 -0.74 0 -0.4C0.1 -0.74 0.46 -0.82 0.68 -0.48C0.98 0.02 0.5 0.36 0 0.78Z";

const BUBBLES = [
  [-0.82, -0.3, 0.035],
  [-0.88, 0.1, 0.028],
  [-0.7, 0.55, 0.03],
  [0.86, -0.2, 0.03],
  [0.8, 0.4, 0.036],
  [0.55, 0.72, 0.026],
  [-0.4, -0.84, 0.024],
  [0.3, -0.88, 0.028],
  [-0.2, 0.9, 0.025],
];

function makeCup(key, item) {
  const geo = GEO[item.vessel] ?? GEO.cup;
  return {
    key,
    item,
    geo,
    mode: "wait",
    wait: 0,
    x: W + 160,
    y: FLOOR,
    vx: 0,
    vy: 0,
    a: 0,
    va: 0,
    pivot: 0,
    opacity: 1,
    fallT: 0,
    level: 0,
    cells: new Float32Array(N * 3),
    pours: [],
    next: 0,
    pourT: 0,
    parts: [],
    ripples: [],
    tendrils: [],
    w1: 0,
    v1: 0,
    w2: 0,
    v2: 0,
    w3: 0,
    mix: 0,
    swirlCol: item.colours.creamy.swirl,
    crema: 0,
    foam: 0,
    art: 0,
    artV: 0,
    spill: 0,
    dirty: true,
    el: null,
  };
}

const foamOf = (it) => it.foam ?? (it.crema ? 0.035 : 0);
const levelY = (g, f) => lerp(g.inner.bot, g.inner.top, f);
const levelR = (g, f) => wallR(g.inner, 1 - f);
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

// Add dv of a liquid on top, entraining some of it into the liquid below.
function deposit(c, type, dv) {
  const T = TYPE_INDEX[type];
  const L0 = c.level;
  const L1 = Math.min(0.96, L0 + dv);
  const cells = c.cells;
  for (let i = 0; i < N; i++) {
    if (i / N >= L1) break;
    const o = i * 3;
    const a0 = clamp(L0 * N - i, 0, 1);
    const a1 = clamp(L1 * N - i, 0, 1);
    if (a1 > a0) {
      const k = (a1 - a0) / a1;
      for (let j = 0; j < 3; j++) cells[o + j] *= 1 - k;
      cells[o + T] += k;
    }
    if (a0 > 0) {
      const d = Math.max(0, L1 - (i + 0.5) / N);
      const k = Math.min(0.4, JET[type] * dv * N * 0.5 * Math.exp(-d / PEN[type]));
      for (let j = 0; j < 3; j++) cells[o + j] *= 1 - k;
      cells[o + T] += k;
    }
  }
  c.level = L1;
  c.dirty = true;
}

// Stirring: relax every filled cell toward the column's mean.
function stir(c, k) {
  const cells = c.cells;
  let tot = 0;
  const m = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const f = clamp(c.level * N - i, 0, 1);
    if (f <= 0) break;
    tot += f;
    for (let j = 0; j < 3; j++) m[j] += cells[i * 3 + j] * f;
  }
  if (tot <= 0) return;
  for (let i = 0; i < N; i++) {
    if (i / N >= c.level) break;
    for (let j = 0; j < 3; j++) cells[i * 3 + j] += (m[j] / tot - cells[i * 3 + j]) * k;
  }
  c.dirty = true;
}

// Local diffusion between neighbouring cells: softens layer boundaries.
function diffuse(c, k) {
  const cells = c.cells;
  const top = Math.min(N - 1, Math.ceil(c.level * N) - 1);
  for (let i = 0; i < top; i++) {
    for (let j = 0; j < 3; j++) {
      const f = (cells[(i + 1) * 3 + j] - cells[i * 3 + j]) * k;
      cells[i * 3 + j] += f;
      cells[(i + 1) * 3 + j] -= f;
    }
  }
}

// Fraction of the whole column that is liquid T.
function share(c, T) {
  let tot = 0;
  let x = 0;
  for (let i = 0; i < N; i++) {
    const f = clamp(c.level * N - i, 0, 1);
    if (f <= 0) break;
    tot += f;
    x += c.cells[i * 3 + T] * f;
  }
  return tot ? x / tot : 1;
}

const topCell = (c) => Math.max(0, Math.min(N - 1, Math.ceil(c.level * N) - 1));

// Wave height at u (-1 left .. 1 right) in px.
const wave = (c, u, t) =>
  c.w1 * u + c.w2 * Math.cos(Math.PI * u) + c.w3 * Math.sin(3 * Math.PI * u - t * 9);

function kick(c, u, s) {
  c.v1 += s * u * 40;
  c.v2 -= s * 50;
  c.w3 = Math.min(2.2, c.w3 + s * 0.9);
}

// Pour the whole recipe at once (reduced motion).
function fillInstantly(c) {
  for (const l of c.item.layers) {
    for (let v = 0; v < l.amount; v += 0.01) deposit(c, l.type, Math.min(0.01, l.amount - v));
  }
  stir(c, 1 - Math.exp(-((c.item.blend ?? 1) * 5.4)));
  for (let i = 0; i < 40; i++) diffuse(c, 0.1);
  c.crema = 1;
  c.foam = 1;
  c.art = 1;
  c.next = c.item.layers.length;
}

function startPour(c, i) {
  const l = c.item.layers[i];
  const r = c.geo.inner.r;
  const side = i % 2 === 0 ? -1 : 1;
  c.pours.push({
    type: l.type,
    amount: l.amount,
    rate: l.amount / clamp(l.amount * 2.6, 0.7, 1.6),
    poured: 0,
    x: side * c.geo.streamX * r,
    w: c.geo.streamW * (l.type === "creamy" ? 1.9 : l.type === "clear" ? 1.5 : 1.3),
    phase: l.type === "deep" ? "lead" : "fall",
    timer: 0,
    head: SRC,
    headV: V0,
    tail: SRC,
    tailV: V0,
    drips: l.type === "deep" ? 2 : 1,
    lead: l.type === "deep" ? 2 : 0,
    rippleT: 0,
    slot: c.pours.filter((p) => p.phase !== "done").length > 0 ? (c.pours[c.pours.length - 1].slot + 1) % 2 : 0,
  });
}

function spawnDrop(c, p) {
  c.parts.push({ x: p.x + (Math.random() - 0.5), y: SRC + 10, vx: 0, vy: V0 * 0.6, r: p.w * 0.5 + 0.6, col: c.item.colours[p.type].fill, drop: true });
}

function splash(c, x, y, col, n, s) {
  for (let k = 0; k < n && c.parts.length < PARTS; k++) {
    c.parts.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y - 1,
      vx: (Math.random() - 0.5) * 150 * s,
      vy: -(80 + Math.random() * 180) * s,
      r: 0.8 + Math.random() * 1.5,
      col,
      drop: false,
    });
  }
  if (c.ripples.length >= RIPPLES) c.ripples.shift();
  c.ripples.push({ x, age: 0 });
}

// Advance one cup. Returns true while anything is still moving.
function stepCup(c, dt, t, spills) {
  const g = c.geo;
  const it = c.item;
  const pal = it.colours;
  let busy = false;

  if (c.mode === "wait") {
    c.wait -= dt;
    if (c.wait <= 0) c.mode = "enter";
    return true;
  }
  if (c.mode === "enter" || c.mode === "rest") {
    const ax = -130 * (c.x - CX) - 15.5 * c.vx;
    c.vx += ax * dt;
    c.x += c.vx * dt;
    const target = clamp(-ax * 0.00011, -0.14, 0.14);
    c.va += (-240 * (c.a - target) - 15 * c.va) * dt;
    c.a += c.va * dt;
    if (c.mode === "enter") {
      busy = true;
      if (Math.abs(c.x - CX) < 0.4 && Math.abs(c.vx) < 8 && Math.abs(c.a) < 0.003 && Math.abs(c.va) < 0.04) {
        c.x = CX;
        c.vx = 0;
        c.a = 0;
        c.va = 0;
        c.mode = "rest";
      }
    }
  } else if (c.mode === "fall") {
    c.fallT += dt;
    c.vy += G_FALL * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.a += c.va * dt;
    busy = true;
    // tipped far enough: liquid spills over the low side of the rim
    if (c.level > 0.2 && Math.abs(c.a) > 0.3 && spills.length < SPILLS) {
      c.spill += dt * 60 * c.level;
      while (c.spill > 1 && spills.length < SPILLS) {
        c.spill -= 1;
        const side = Math.sign(c.a) || -1;
        const qx = side < 0 ? -g.inner.r : g.inner.r;
        const qy = g.inner.top + c.pivot;
        const cs = Math.cos(c.a);
        const sn = Math.sin(c.a);
        const rx = cs * qx - sn * qy;
        const ry = sn * qx + cs * qy;
        const [col] = shade(c.cells[topCell(c) * 3], c.cells[topCell(c) * 3 + 1], c.cells[topCell(c) * 3 + 2], pal);
        spills.push({
          x: c.x + rx,
          y: c.y - c.pivot + ry,
          vx: c.vx - c.va * ry + side * (30 + Math.random() * 60),
          vy: c.vy + c.va * rx - 60 - Math.random() * 80,
          r: 1.2 + Math.random() * 2.2,
          col: css(col),
          drop: true,
        });
        c.level = Math.max(0.05, c.level - 0.004);
      }
    }
  } else if (c.mode === "fadeIn") {
    c.opacity = Math.min(1, c.opacity + dt / 0.3);
    if (c.opacity >= 1) c.mode = "rest";
    busy = true;
  } else if (c.mode === "fadeOut") {
    c.opacity = Math.max(0, c.opacity - dt / 0.25);
    busy = true;
  }

  // recipe: start pours once the cup has (nearly) arrived
  const arrived = c.mode === "rest" || (c.mode === "enter" && Math.abs(c.x - CX) < 16);
  if (arrived && c.next < it.layers.length) {
    c.pourT += dt;
    const prev = c.pours[c.pours.length - 1];
    const overlap = prev && prev.type === "deep" && it.layers[c.next].type === "creamy";
    const ready = !prev
      ? c.pourT > 0.02
      : overlap
        ? prev.poured >= prev.amount * 0.6
        : prev.phase === "drips" || prev.phase === "done";
    if (ready) startPour(c, c.next++);
    busy = true;
  }

  const fTop = c.level + foamOf(it) * easeOut(c.foam);
  const yS = levelY(g, fTop);
  const rS = levelR(g, fTop);

  let flowing = false;
  for (const p of c.pours) {
    if (p.phase === "done") continue;
    busy = true;
    p.timer += dt;
    const surfY = yS + wave(c, p.x / rS, t);
    if (p.phase === "lead") {
      if (p.lead > 0 && p.timer > 0.08) {
        spawnDrop(c, p);
        p.lead--;
        p.timer = 0;
      } else if (p.lead === 0 && p.timer > 0.1) {
        p.phase = "fall";
      }
    }
    if (p.phase === "fall") {
      p.headV += G_STREAM * dt;
      p.head += p.headV * dt;
      if (p.head >= surfY) {
        p.phase = "flow";
        const top = c.cells[topCell(c) * 3 + TYPE_INDEX[p.type]];
        splash(c, p.x, surfY, pal[p.type].fill, c.level > 0.02 ? 6 : 3, 1);
        kick(c, p.x / rS, c.level > 0.02 ? 1 : 0.3);
        if (c.level > 0.02 && top < 0.85) c.swirlCol = pal[p.type].swirl;
      }
    }
    if (p.phase === "flow" || p.phase === "tail") {
      if (p.poured < p.amount) {
        const dv = Math.min(p.rate * dt, p.amount - p.poured);
        // does this pour differ from the liquid it lands in?
        const differs = c.level > 0.03 && share(c, TYPE_INDEX[p.type]) < 0.8;
        deposit(c, p.type, dv);
        p.poured += dv;
        if (differs) {
          c.mix = Math.min(1, c.mix + dt * 3);
          c.swirlCol = pal[p.type].swirl;
          if (g.glass && c.tendrils.length < TENDRILS && Math.random() < dt * 3.2) {
            c.tendrils.push({ x: p.x, age: 0, dir: Math.random() < 0.5 ? -1 : 1, ph: Math.random() * 6, col: pal[p.type].fill });
          }
        }
        flowing = true;
      }
      p.rippleT += dt;
      if (p.rippleT > 0.085) {
        p.rippleT = 0;
        splash(c, p.x, surfY, pal[p.type].fill, 1, 0.7);
        kick(c, p.x / rS, 0.12);
      }
      if (p.phase === "flow" && p.poured >= p.amount) p.phase = "tail";
    }
    if (p.phase === "tail") {
      p.tailV += G_STREAM * dt;
      p.tail += p.tailV * dt;
      if (p.tail >= surfY) {
        p.phase = "drips";
        p.timer = 0;
      }
    }
    if (p.phase === "drips") {
      if (p.drips > 0 && p.timer > 0.12 + Math.random() * 0.1) {
        spawnDrop(c, p);
        p.drips--;
        p.timer = 0;
      } else if (p.drips === 0 && p.timer > 0.1) {
        p.phase = "done";
      }
    }
  }

  // particles (local)
  for (let i = c.parts.length - 1; i >= 0; i--) {
    const q = c.parts[i];
    q.vy += G_STREAM * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    const sy = yS + wave(c, clamp(q.x / rS, -1, 1), t);
    if (q.vy > 0 && q.y >= sy) {
      if (q.drop) {
        splash(c, q.x, sy, q.col, 3, 0.6);
        kick(c, q.x / rS, 0.35);
      } else if (c.ripples.length < RIPPLES && Math.random() < 0.3) {
        c.ripples.push({ x: q.x, age: 0 });
      }
      c.parts.splice(i, 1);
    }
  }
  if (c.parts.length) busy = true;
  for (let i = c.ripples.length - 1; i >= 0; i--) {
    c.ripples[i].age += dt;
    if (c.ripples[i].age > 0.7) c.ripples.splice(i, 1);
  }
  for (let i = c.tendrils.length - 1; i >= 0; i--) {
    c.tendrils[i].age += dt;
    if (c.tendrils[i].age > 1.8) c.tendrils.splice(i, 1);
  }
  if (c.ripples.length || c.tendrils.length) busy = true;

  // surface waves: damped springs; tilt follows the cup so liquid stays level
  const tiltTarget = clamp(-Math.tan(c.a), -0.9, 0.9) * rS * (c.mode === "fall" ? 0.8 : 1);
  c.v1 += (-70 * (c.w1 - tiltTarget) - 3.2 * c.v1) * dt;
  c.w1 += c.v1 * dt;
  c.v2 += (-190 * c.w2 - 5 * c.v2) * dt;
  c.w2 += c.v2 * dt;
  c.w3 *= Math.exp(-2.6 * dt);
  if (c.mode !== "fall") {
    const m = rS * P * 0.8;
    c.w2 = clamp(c.w2, -m, m);
  }
  if (Math.abs(c.w1 - tiltTarget) + Math.abs(c.v1) * 0.1 + Math.abs(c.w2) + Math.abs(c.v2) * 0.1 + c.w3 > 0.02) busy = true;

  // mixing, crema, foam, art
  const pouring = c.next < it.layers.length || c.pours.some((p) => p.phase !== "done");
  if (!flowing) c.mix = Math.max(0, c.mix - dt * 0.85);
  if (c.mix > 0) {
    stir(c, 1 - Math.exp(-((it.blend ?? 1) * c.mix * 3.2 * dt)));
    diffuse(c, Math.min(0.25, c.mix * dt * 6 * Math.sqrt(it.blend ?? 1)));
    busy = true;
  }
  if (it.crema && c.level > 0.05 && c.crema < 1) {
    c.crema = Math.min(1, c.crema + dt / (pouring ? 2.4 : 0.9));
    busy = true;
  }
  if (!pouring && c.level > 0 && c.foam < 1 && c.mode !== "fall") {
    c.foam = Math.min(1, c.foam + dt / 0.75);
    busy = true;
  }
  if (it.art === "heart" && c.foam > 0.35 && c.mix < 0.5 && c.mode !== "fall") {
    c.artV += (-120 * (c.art - 1) - 13 * c.artV) * dt;
    c.art += c.artV * dt;
    if (Math.abs(c.art - 1) + Math.abs(c.artV) * 0.05 > 0.002) busy = true;
    else c.art = 1;
  }

  return busy;
}

const K = 36;
const COS = Array.from({ length: K + 1 }, (_, i) => Math.cos((i / K) * Math.PI * 2 + Math.PI));
const SIN = Array.from({ length: K + 1 }, (_, i) => Math.sin((i / K) * Math.PI * 2 + Math.PI));

function streamPath(p, yBot, t) {
  const yTop = p.phase === "tail" ? p.tail : SRC;
  if (p.phase === "lead" || p.phase === "drips" || p.phase === "done" || yBot - yTop < 1) return ["", ""];
  const L = [];
  const R = [];
  const n = 12;
  let hiTop = "";
  for (let i = 0; i <= n; i++) {
    const y = lerp(yTop, yBot, i / n);
    const v = Math.sqrt(V0 * V0 + 2 * G_STREAM * Math.max(0, y - SRC));
    const hw = (p.w / 2) * Math.max(0.62, Math.pow(V0 / v, 0.3));
    const wob = Math.sin(y * 0.045 + t * 14) * 0.5 * (i / n);
    L.push(`${f1(p.x - hw + wob)} ${f1(y)}`);
    R.unshift(`${f1(p.x + hw + wob)} ${f1(y)}`);
    if (i === 1) hiTop = `M${f1(p.x - hw * 0.35 + wob)} ${f1(y)}`;
  }
  const cap = p.phase === "fall" ? `A1 1 0 0 0 ${R[0]}` : `L${R[0]}`;
  const d = `M${L.join("L")}${cap}L${R.slice(1).join("L")}Z`;
  const hwB = (p.w / 2) * 0.55;
  return [d, `${hiTop}L${f1(p.x - hwB * 0.35)} ${f1(yBot - 2)}`];
}

function renderCup(c, t) {
  const e = c.el;
  if (!e) return;
  const g = c.geo;
  const it = c.item;
  const pal = it.colours;
  e.root.setAttribute("opacity", c.opacity.toFixed(3));
  e.body.setAttribute("transform", `translate(${f1(c.x)} ${f1(c.y)}) rotate(${((c.a * 180) / Math.PI).toFixed(2)} 0 ${-c.pivot})`);
  const sh = c.mode === "fall" ? Math.max(0, 1 - c.fallT * 6) : 1;
  e.shadow.setAttribute("transform", `translate(${f1(c.x)} ${FLOOR})`);
  e.shadow.setAttribute("opacity", sh.toFixed(3));

  const foamH = foamOf(it) * easeOut(c.foam);
  const fTop = c.level + foamH;
  const yS = levelY(g, fTop);
  const rS = levelR(g, fTop) * 1.02;
  const ry = rS * P;
  e.liquid.setAttribute("opacity", clamp(c.level * 50, 0, 1).toFixed(3));
  if (c.level <= 0) return;

  // surface ring and liquid body
  const pts = [];
  let back = "";
  for (let i = 0; i <= K; i++) {
    const u = COS[i];
    const pt = `${f1(rS * u)} ${f1(yS + ry * SIN[i] + wave(c, u, t))}`;
    pts.push(pt);
    if (i <= K / 2) back += (i ? "L" : "M") + pt;
  }
  const surf = `M${pts.join("L")}Z`;
  e.surf.setAttribute("d", surf);
  e.sclip.setAttribute("d", surf);
  const body = `${back}L${f1(rS + 40)} ${g.inner.bot + 40}L${f1(-rS - 40)} ${g.inner.bot + 40}Z`;
  e.liq.setAttribute("d", body);
  if (e.depth) e.depth.setAttribute("d", body);

  if (g.glass && foamH > 0.002) {
    const yL = levelY(g, c.level);
    const rL = levelR(g, c.level) * 1.02;
    // front arc of the liquid level, walked right to left
    let front = "";
    for (let i = K / 2; i <= K; i++) {
      const u = COS[i];
      front += `L${f1(rL * u)} ${f1(yL + rL * P * SIN[i] + wave(c, u, t))}`;
    }
    e.foam.setAttribute("d", `${back}${front}Z`);
  } else {
    e.foam.setAttribute("d", "");
  }

  if (c.dirty) {
    c.dirty = false;
    for (let i = 0; i < N; i++) {
      const [rgb, a] = shade(c.cells[i * 3], c.cells[i * 3 + 1], c.cells[i * 3 + 2], pal);
      e.stops[i].setAttribute("stop-color", css(rgb));
      e.stops[i].setAttribute("stop-opacity", a.toFixed(3));
    }
    const ti = topCell(c);
    const [top, ta] = shade(c.cells[ti * 3], c.cells[ti * 3 + 1], c.cells[ti * 3 + 2], pal);
    e.surf.setAttribute("fill", css(top));
    e.surf.setAttribute("fill-opacity", Math.min(1, ta + 0.08).toFixed(3));
    if (e.depth) e.depth.setAttribute("opacity", (ta * 0.9).toFixed(3));
    if (e.base) {
      const [b, ba] = shade(c.cells[0], c.cells[1], c.cells[2], pal);
      e.base.setAttribute("fill", css(b));
      e.base.setAttribute("fill-opacity", (ba * 0.45).toFixed(3));
    }
  }

  e.decor.setAttribute("transform", `matrix(${f1(rS)} ${(c.w1 / 1).toFixed(2)} 0 ${f1(ry)} 0 ${f1(yS + c.w2)})`);
  if (e.crema) e.crema.setAttribute("opacity", easeOut(c.crema).toFixed(3));
  if (e.foamTop) e.foamTop.setAttribute("opacity", easeOut(c.foam).toFixed(3));
  if (e.art) {
    const s = Math.max(0, c.art);
    e.art.setAttribute("opacity", clamp(c.art * 1.6, 0, 1).toFixed(3));
    e.art.setAttribute("transform", `translate(0 0.08) scale(${s.toFixed(3)})`);
  }

  // swirl arms on the surface
  const sa = clamp(c.mix * 1.2, 0, 1) * 0.8;
  for (let k = 0; k < e.swirl.length; k++) {
    if (sa < 0.01) {
      e.swirl[k].setAttribute("d", "");
      continue;
    }
    let d = "";
    const rot = t * 2.6 + k * Math.PI;
    for (let i = 0; i <= 22; i++) {
      const s = i / 22;
      const th = rot + s * Math.PI * 2.4;
      const rad = (0.12 + 0.72 * s) * 0.9;
      const u = Math.cos(th) * rad;
      d += `${i ? "L" : "M"}${f1(rS * u)} ${f1(yS + ry * Math.sin(th) * rad + wave(c, u, t))}`;
    }
    e.swirl[k].setAttribute("d", d);
    e.swirl[k].setAttribute("stroke", c.swirlCol);
    e.swirl[k].setAttribute("opacity", sa.toFixed(3));
  }

  // plumes sinking through the liquid (glass only)
  for (let k = 0; k < e.tendrils.length; k++) {
    const td = c.tendrils[k];
    if (!td) {
      e.tendrils[k].setAttribute("d", "");
      continue;
    }
    const grow = easeOut(td.age / 0.7);
    const depth = (yS - g.inner.bot) * 0.85 * grow;
    let d = "";
    for (let i = 0; i <= 10; i++) {
      const s = i / 10;
      const x = td.x + td.dir * s * s * rS * 0.6 * grow + Math.sin(s * 5 + td.age * 3.5 + td.ph) * s * 8;
      d += `${i ? "L" : "M"}${f1(x)} ${f1(yS + 2 + s * depth)}`;
    }
    e.tendrils[k].setAttribute("d", d);
    e.tendrils[k].setAttribute("stroke", td.col);
    e.tendrils[k].setAttribute("opacity", (0.6 * (1 - td.age / 1.8)).toFixed(3));
  }

  for (let k = 0; k < RIPPLES; k++) {
    const rp = c.ripples[k];
    const el = e.ripples[k];
    if (!rp) {
      el.setAttribute("opacity", "0");
      continue;
    }
    const rx = 2 + rp.age * rS * 1.3;
    el.setAttribute("cx", f1(rp.x).toString());
    el.setAttribute("cy", f1(yS + wave(c, clamp(rp.x / rS, -1, 1), t)).toString());
    el.setAttribute("rx", f1(rx).toString());
    el.setAttribute("ry", f1(rx * P).toString());
    el.setAttribute("opacity", (0.55 * (1 - rp.age / 0.7)).toFixed(3));
  }

  // streams
  for (let k = 0; k < 2; k++) {
    const p = c.pours.find((q) => q.slot === k && q.phase !== "done" && q.phase !== "drips");
    const s = e.streams[k];
    if (!p || c.mode === "fall") {
      s.path.setAttribute("d", "");
      s.hi.setAttribute("d", "");
      continue;
    }
    const yBot = p.phase === "fall" ? p.head : yS + wave(c, p.x / rS, t) + 1;
    const [d, hi] = streamPath(p, yBot, t);
    s.path.setAttribute("d", d);
    s.hi.setAttribute("d", hi);
    s.hi.setAttribute("stroke-opacity", pal[p.type].hi.toFixed(2));
    s.stops[0].setAttribute("stop-color", pal[p.type].fill);
    s.stops[1].setAttribute("stop-color", pal[p.type].fill);
    s.stops[1].setAttribute("stop-opacity", pal[p.type].a.toFixed(2));
  }

  for (let k = 0; k < PARTS; k++) {
    const q = c.parts[k];
    const el = e.parts[k];
    if (!q) {
      el.setAttribute("r", "0");
      continue;
    }
    el.setAttribute("cx", f1(q.x).toString());
    el.setAttribute("cy", f1(q.y).toString());
    el.setAttribute("r", q.r.toFixed(2));
    el.setAttribute("fill", q.col);
  }
}

function cacheEls(root) {
  const q = (k) => root.querySelector(`[data-k="${k}"]`);
  const all = (k) => Array.from(root.querySelectorAll(`[data-k="${k}"]`));
  return {
    root,
    shadow: q("shadow"),
    body: q("body"),
    liquid: q("liquid"),
    liq: q("liq"),
    depth: q("depth"),
    foam: q("foam"),
    surf: q("surf"),
    sclip: q("sclip"),
    decor: q("decor"),
    crema: q("crema"),
    foamTop: q("foamtop"),
    art: q("art"),
    base: q("base"),
    stops: all("stop"),
    swirl: all("swirl"),
    tendrils: all("tendril"),
    ripples: all("ripple"),
    streams: [0, 1].map((i) => ({
      path: q(`stream${i}`),
      hi: q(`streamhi${i}`),
      stops: all(`sstop${i}`),
    })),
    parts: all("part"),
  };
}

function svgEl(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

function attr(el, obj) {
  for (const k in obj) el.setAttribute(k, obj[k]);
  return el;
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

// Stage wide gradients in Nzu chalk tones read from the theme.
function makeDefs(idFn, theme) {
  const defs = svgEl("defs");
  const ink = theme.ink;

  const blur = (name, s) => {
    const filter = svgEl("filter");
    attr(filter, { id: idFn(name), x: "-50%", y: "-50%", width: "200%", height: "200%" });
    attr(filter.appendChild(svgEl("feGaussianBlur")), { stdDeviation: s });
    defs.appendChild(filter);
  };
  blur("blur05", 0.5);
  blur("blur1", 1);
  blur("blur2", 2);
  blur("blur3", 3.2);

  const lin = (name, stops, v = false) => {
    const g = svgEl("linearGradient");
    attr(g, { id: idFn(name), x1: 0, y1: 0, x2: v ? 0 : 1, y2: v ? 1 : 0 });
    for (const [o, c] of stops) {
      attr(g.appendChild(svgEl("stop")), { offset: o, "stop-color": c });
    }
    defs.appendChild(g);
    return g;
  };
  const rad = (name, stops, cx = 0.5, cy = 0.5, r = 0.5) => {
    const g = svgEl("radialGradient");
    attr(g, { id: idFn(name), cx, cy, r });
    for (const [o, c] of stops) {
      attr(g.appendChild(svgEl("stop")), { offset: o, "stop-color": Array.isArray(c) ? css(c) : c });
    }
    defs.appendChild(g);
    return g;
  };

  const cardT = (t) => mixRGB(theme.card, ink, t);
  const cardW = (t) => mixRGB(theme.card, [255, 255, 250], t);
  const accT = (t) => mixRGB(theme.accent, ink, t);
  const accC = (t) => mixRGB(theme.accent, theme.card, t);

  lin("cerCream", [
    [0, css(cardT(0.26))], [0.1, css(cardT(0.14))], [0.3, css(cardT(0.05))], [0.42, css(cardW(0.6))],
    [0.62, css(cardT(0.08))], [0.85, css(cardT(0.18))], [1, css(cardT(0.3))],
  ]);
  lin("cerTerra", [
    [0, css(accT(0.3))], [0.12, css(accT(0.14))], [0.32, css(accC(0.3))], [0.44, css(accC(0.42))],
    [0.64, css(accT(0.06))], [0.86, css(accT(0.24))], [1, css(accT(0.34))],
  ]);
  lin("handleCream", [[0, css(cardT(0.06))], [0.5, css(cardT(0.16))], [1, css(cardT(0.3))]]);
  lin("handleTerra", [[0, css(accC(0.3))], [0.5, css(accT(0.1))], [1, css(accT(0.28))]]);
  lin("edgeCream", [
    [0, css(mixRGB(theme.border, ink, 0.12))], [0.3, css(cardT(0.07))],
    [0.55, css(cardT(0.12))], [1, css(mixRGB(theme.border, ink, 0.1))],
  ]);
  lin("edgeTerra", [
    [0, css(accT(0.3))], [0.3, css(accC(0.25))], [0.55, css(accC(0.3))], [1, css(accT(0.28))],
  ]);

  // ambient occlusion from the saucer onto the cup body
  for (const n of ["aoCream", "aoTerra"]) {
    const g = svgEl("linearGradient");
    attr(g, { id: idFn(n), x1: 0, y1: 0, x2: 0, y2: 1 });
    const c = n === "aoCream" ? cardT(0.6) : accT(0.55);
    const op = n === "aoCream" ? 0.28 : 0.38;
    for (const [o, a] of [[0, 0], [0.55, 0], [1, op]]) {
      attr(g.appendChild(svgEl("stop")), { offset: o, "stop-color": css(c), "stop-opacity": a });
    }
    defs.appendChild(g);
  }

  rad("innerCream", [[0, css(cardW(0.5))], [0.55, css(theme.card)], [0.85, css(mixRGB(theme.card, theme.border, 0.6))], [1, css(cardT(0.22))]], 0.42, 0.18, 0.75);
  rad("saucerCream", [
    [0, css(cardW(0.7))], [0.5, css(theme.card)], [0.8, css(mixRGB(theme.card, theme.border, 0.5))],
    [0.93, css(mixRGB(theme.card, theme.border, 0.7))], [1, css(cardT(0.08))],
  ], 0.45, 0.4, 0.55);
  rad("shadow", [[0, rgba(ink, 0.45)], [0.5, rgba(ink, 0.17)], [1, rgba(ink, 0)]], undefined, undefined, undefined);

  lin("glassWall", [
    [0, rgba(ink, 0.5)], [0.05, "rgba(255,255,255,0.62)"], [0.13, "rgba(255,255,255,0.16)"],
    [0.5, "rgba(255,255,255,0.08)"], [0.84, "rgba(255,255,255,0.16)"], [0.94, "rgba(255,255,255,0.58)"], [1, rgba(ink, 0.48)],
  ]);
  lin("glassFace", [
    [0, "rgba(255,255,255,0)"], [0.1, "rgba(255,255,255,0.22)"], [0.18, "rgba(255,255,255,0.05)"],
    [0.6, "rgba(255,255,255,0)"], [0.88, "rgba(255,255,255,0.14)"], [1, "rgba(255,255,255,0)"],
  ]);

  const gb = svgEl("linearGradient");
  attr(gb, { id: idFn("glassBase"), x1: 0, y1: 0, x2: 0, y2: 1 });
  for (const [o, c, a] of [[0, "white", 0.35], [0.5, "white", 0.05], [1, css(mixRGB(ink, theme.border, 0.35)), 0.18]]) {
    attr(gb.appendChild(svgEl("stop")), { offset: o, "stop-color": c, "stop-opacity": a });
  }
  defs.appendChild(gb);

  lin("liqDepth", [
    [0, rgba(ink, 0.55)], [0.16, rgba(ink, 0.1)], [0.38, rgba(cardW(0.7), 0.08)],
    [0.62, rgba(ink, 0)], [0.84, rgba(ink, 0.12)], [1, rgba(ink, 0.6)], 
  ]);
  rad("sheen", [[0, "rgba(255,255,255,0.28)"], [0.6, "rgba(255,255,255,0.06)"], [1, "rgba(255,255,255,0)"]], 0.38, 0.3, 0.6);

  for (const v of Object.keys(GEO)) {
    const cp = svgEl("clipPath");
    attr(cp, { id: idFn(`clip-${v}`) });
    attr(cp.appendChild(svgEl("path")), { d: silhouette(GEO[v].inner) });
    defs.appendChild(cp);
  }

  return defs;
}

function glazeOf(g, theme) {
  if (g.glass) return null;
  const cardW = mixRGB(theme.card, [255, 250, 244], 0.6);
  if (g.glaze === "terra") {
    return {
      body: "cerTerra",
      rim: css(mixRGB(theme.card, [255, 255, 250], 0.6)),
      rimLine: "",
      inner: "innerCream",
      edge: "edgeTerra",
      saucer: "saucerCream",
      handle: "handleTerra",
      ao: "aoTerra",
      terra: css(mixRGB(theme.card, [255, 250, 244], 0.75)),
    };
  }
  return {
    body: "cerCream",
    rim: css(cardW),
    rimLine: css(mixRGB(theme.mutedInk, theme.ink, 0.35)),
    inner: "innerCream",
    edge: "edgeCream",
    saucer: "saucerCream",
    handle: "handleCream",
    ao: "aoCream",
  };
}

function makeSaucer(g, idFn, theme) {
  if (!g.saucer) return null;
  const { y, r } = g.saucer;
  const gl = glazeOf(g, theme);
  const o = g.outer;
  const group = svgEl("g");

  attr(group.appendChild(svgEl("path")), { d: frontBand(r, y, r * 0.985, y + 7), fill: `url(#${idFn(gl.edge)})` });
  attr(group.appendChild(svgEl("path")), { d: frontBand(r * 0.985, y + 7, r * 0.6, y + 11), fill: rgba(theme.ink, 0.16) });
  attr(group.appendChild(svgEl("ellipse")), { cx: 0, cy: y, rx: r, ry: r * P, fill: `url(#${idFn(gl.saucer)})` });
  attr(group.appendChild(svgEl("ellipse")), { cx: 0, cy: y - 0.6, rx: r * 0.985, ry: r * P * 0.985, fill: "none", stroke: "rgba(255,255,255,0.9)", "stroke-width": 1 });
  if (g.glaze === "cream") {
    attr(group.appendChild(svgEl("ellipse")), { cx: 0, cy: y, rx: r * 0.93, ry: r * P * 0.93, fill: "none", stroke: gl.rimLine, "stroke-opacity": 0.55, "stroke-width": 1.4 });
  }
  attr(group.appendChild(svgEl("ellipse")), { cx: 0, cy: y + 1.6, rx: r * 0.76, ry: r * P * 0.76, fill: "none", stroke: rgba(theme.mutedInk, 0.16), "stroke-width": 1.4 });
  attr(group.appendChild(svgEl("ellipse")), { cx: 0, cy: y + 0.6, rx: r * 0.76, ry: r * P * 0.76, fill: "none", stroke: "rgba(255,255,255,0.75)", "stroke-width": 1 });
  attr(group.appendChild(svgEl("ellipse")), { cx: 0, cy: y + 2, rx: r * 0.44, ry: r * P * 0.44, fill: rgba(theme.ink, 0.08) });
  // cup's own shadow in the well
  attr(group.appendChild(svgEl("ellipse")), { cx: 7, cy: o.bot + 4, rx: o.rb * 1.75, ry: o.rb * P * 1.9, fill: `url(#${idFn("shadow")})` });
  attr(group.appendChild(svgEl("ellipse")), { cx: 1, cy: o.bot + 2.5, rx: o.rb * 1.05, ry: o.rb * P * 1.1, fill: rgba(theme.ink, 0.32), filter: `url(#${idFn("blur2")})` });

  return group;
}

function makeGlassHandle(d, w, maskId, theme) {
  const group = svgEl("g");
  const mask = svgEl("mask");
  attr(mask, { id: maskId, maskUnits: "userSpaceOnUse", x: -200, y: -300, width: 400, height: 400 });
  attr(mask.appendChild(svgEl("path")), { d, fill: "none", stroke: "white", "stroke-width": w, "stroke-linecap": "round" });
  attr(mask.appendChild(svgEl("path")), { d, fill: "none", stroke: "black", "stroke-width": w - 2.8, "stroke-linecap": "round" });
  group.appendChild(mask);

  attr(group.appendChild(svgEl("path")), { d, fill: "none", stroke: "rgba(255,250,240,0.35)", "stroke-width": w, "stroke-linecap": "round" });
  attr(group.appendChild(svgEl("path")), { d, fill: "none", stroke: rgba(theme.ink, 0.5), "stroke-width": w, "stroke-linecap": "round", mask: `url(#${maskId})` });
  attr(group.appendChild(svgEl("path")), { d, fill: "none", stroke: rgba(theme.mutedInk, 0.12), "stroke-width": w * 0.3, "stroke-linecap": "round" });
  attr(group.appendChild(svgEl("path")), { d, fill: "none", stroke: "white", "stroke-opacity": 0.95, "stroke-width": 1.1, "stroke-linecap": "round", transform: "translate(-1.6 -1.2)" });

  return group;
}

function makeShadow(g, idFn, theme) {
  const r = g.shadowR;
  const group = svgEl("g");
  attr(group, { "data-k": "shadow" });
  attr(group.appendChild(svgEl("ellipse")), { cx: 10, cy: 4, rx: r * 1.25, ry: r * P * 1.3, fill: `url(#${idFn("shadow")})`, opacity: g.glass ? 0.55 : 0.8 });
  attr(group.appendChild(svgEl("ellipse")), { cx: 2, cy: g.saucer ? 6 : 1, rx: r * 0.98, ry: r * P * 0.9, fill: rgba(theme.ink, 0.36), filter: `url(#${idFn("blur3")})`, opacity: g.glass ? 0.6 : 1 });
  if (g.glass) {
    attr(group.appendChild(svgEl("ellipse")), { cx: r * 0.55, cy: 5, rx: r * 0.55, ry: r * P * 0.5, fill: rgba(theme.accent, 0.16), filter: `url(#${idFn("blur3")})` });
  }
  return group;
}

function makeVesselBack(g, idFn, theme) {
  const o = g.outer;
  const i = g.inner;
  const group = svgEl("g");
  if (g.glass) {
    if (g.handle) {
      group.appendChild(makeGlassHandle(g.handle, g.handleW, idFn("hmask"), theme));
    }
    attr(group.appendChild(svgEl("path")), { d: silhouette(i), fill: "rgba(255,255,255,0.2)" });
    attr(group.appendChild(svgEl("path")), { d: `M${-i.r} ${i.top}A${i.r} ${f1(i.r * P)} 0 0 1 ${i.r} ${i.top}`, fill: "none", stroke: rgba(theme.ink, 0.3), "stroke-width": 1 });
    // back wall edges seen through the glass
    attr(group.appendChild(svgEl("path")), { d: wallLine(i, -0.97, 0.04, 0.95), fill: "none", stroke: rgba(theme.ink, 0.12), "stroke-width": 1.4 });
    attr(group.appendChild(svgEl("path")), { d: wallLine(i, 0.97, 0.04, 0.95), fill: "none", stroke: rgba(theme.ink, 0.12), "stroke-width": 1.4 });
    return group;
  }
  const gl = glazeOf(g, theme);
  const fr = o.rb * 0.86;
  group.appendChild(makeSaucer(g, idFn, theme));
  // foot ring
  attr(group.appendChild(svgEl("path")), { d: frontBand(fr, o.bot - 2, fr * 0.97, o.bot + 4), fill: `url(#${idFn(gl.body)})` });
  attr(group.appendChild(svgEl("path")), { d: frontBand(fr * 0.97, o.bot + 3, fr * 0.97, o.bot + 4), fill: rgba(theme.ink, 0.3) });
  if (g.handle) {
    const hg = svgEl("g");
    attr(hg.appendChild(svgEl("path")), { d: g.handle, fill: "none", stroke: `url(#${idFn(gl.handle)})`, "stroke-width": g.handleW, "stroke-linecap": "round" });
    attr(hg.appendChild(svgEl("path")), { d: g.handle, fill: "none", stroke: "rgba(255,255,255,0.55)", "stroke-width": g.handleW * 0.22, "stroke-linecap": "round", transform: "translate(-0.6 -1.6)", filter: `url(#${idFn("blur1")})` });
    attr(hg.appendChild(svgEl("path")), { d: g.handle, fill: "none", stroke: rgba(theme.ink, 0.18), "stroke-width": g.handleW * 0.25, "stroke-linecap": "round", transform: "translate(0.8 2)", filter: `url(#${idFn("blur1")})` });
    group.appendChild(hg);
  }
  // rim top and the glazed interior
  attr(group.appendChild(svgEl("ellipse")), { cx: 0, cy: o.top, rx: o.r, ry: o.r * P, fill: gl.rim });
  attr(group.appendChild(svgEl("ellipse")), { cx: 0, cy: i.top + 0.8, rx: i.r, ry: i.r * P, fill: `url(#${idFn(gl.inner)})` });
  attr(group.appendChild(svgEl("ellipse")), { cx: 0, cy: i.top + 0.8, rx: i.r, ry: i.r * P, fill: "none", stroke: rgba(theme.ink, 0.18), "stroke-width": 1 });
  return group;
}

function makeVesselFront(g, idFn, theme) {
  const o = g.outer;
  const i = g.inner;
  const h = o.bot - o.top;
  const group = svgEl("g");
  if (g.glass) {
    attr(group.appendChild(svgEl("path")), { d: `${silhouette(o)}${silhouette(i)}`, "fill-rule": "evenodd", fill: `url(#${idFn("glassWall")})` });
    // thick base: refracts the liquid above it
    attr(group.appendChild(svgEl("path")), { "data-k": "base", d: frontBand(i.rb, i.bot, o.rb, o.bot), fill: "transparent" });
    attr(group.appendChild(svgEl("path")), { d: frontBand(i.rb, i.bot, o.rb, o.bot), fill: `url(#${idFn("glassBase")})` });
    attr(group.appendChild(svgEl("path")), { d: `M${-i.rb} ${i.bot}A${i.rb} ${f1(i.rb * P)} 0 0 0 ${i.rb} ${i.bot}`, fill: "none", stroke: "rgba(255,255,255,0.75)", "stroke-width": 1 });
    attr(group.appendChild(svgEl("path")), { d: `M${-o.rb + 1} ${o.bot - 1}A${o.rb - 1} ${f1((o.rb - 1) * P)} 0 0 0 ${o.rb - 1} ${o.bot - 1}`, fill: "none", stroke: "rgba(255,255,255,0.7)", "stroke-width": 1.2 });
    attr(group.appendChild(svgEl("path")), { d: `M${-o.rb} ${o.bot}A${o.rb} ${f1(o.rb * P)} 0 0 0 ${o.rb} ${o.bot}`, fill: "none", stroke: rgba(theme.ink, 0.4), "stroke-width": 0.9 });
    attr(group.appendChild(svgEl("path")), { d: bodyPath(o), fill: `url(#${idFn("glassFace")})` });
    // highlights
    attr(group.appendChild(svgEl("path")), { d: wallLine(o, -0.78, 0.05, 0.86), fill: "none", stroke: "white", "stroke-opacity": 0.55, "stroke-width": 5, "stroke-linecap": "round", filter: `url(#${idFn("blur2")})` });
    attr(group.appendChild(svgEl("path")), { d: wallLine(o, -0.8, 0.07, 0.8), fill: "none", stroke: "white", "stroke-opacity": 0.9, "stroke-width": 1.1, "stroke-linecap": "round" });
    attr(group.appendChild(svgEl("path")), { d: wallLine(o, 0.84, 0.08, 0.42), fill: "none", stroke: "white", "stroke-opacity": 0.6, "stroke-width": 1.6, "stroke-linecap": "round" });
    attr(group.appendChild(svgEl("path")), { d: wallLine(o, 0.86, 0.55, 0.62), fill: "none", stroke: "white", "stroke-opacity": 0.5, "stroke-width": 1.2, "stroke-linecap": "round" });
    // rim
    attr(group.appendChild(svgEl("ellipse")), { cx: 0, cy: o.top, rx: o.r, ry: o.r * P, fill: "none", stroke: "rgba(255,255,255,0.95)", "stroke-width": 1.4 });
    attr(group.appendChild(svgEl("ellipse")), { cx: 0, cy: i.top + 0.6, rx: i.r, ry: i.r * P, fill: "none", stroke: rgba(theme.ink, 0.32), "stroke-width": 0.8 });
    attr(group.appendChild(svgEl("path")), { d: `M${-o.r} ${o.top + 1.4}A${o.r} ${f1(o.r * P)} 0 0 0 ${o.r} ${o.top + 1.4}`, fill: "none", stroke: rgba(theme.ink, 0.26), "stroke-width": 0.9 });
    return group;
  }
  const gl = glazeOf(g, theme);
  attr(group.appendChild(svgEl("path")), { d: bodyPath(o), fill: `url(#${idFn(gl.body)})` });
  attr(group.appendChild(svgEl("path")), { d: bodyPath(o), fill: `url(#${idFn(gl.ao)})` });
  // bounce light from the saucer, and a soft specular streak
  attr(group.appendChild(svgEl("path")), { d: wallLine(o, 0.93, 0.35, 0.92), fill: "none", stroke: "rgba(255,238,220,0.4)", "stroke-width": 3, filter: `url(#${idFn("blur2")})` });
  attr(group.appendChild(svgEl("path")), { d: wallLine(o, -0.6, 0.12, 0.78), fill: "none", stroke: "white", "stroke-opacity": g.glaze === "terra" ? 0.45 : 0.85, "stroke-width": h * 0.09, "stroke-linecap": "round", filter: `url(#${idFn("blur3")})` });
  attr(group.appendChild(svgEl("path")), { d: wallLine(o, -0.62, 0.16, 0.5), fill: "none", stroke: "white", "stroke-opacity": 0.8, "stroke-width": 1.4, "stroke-linecap": "round", filter: `url(#${idFn("blur05")})` });
  // rim lip in front
  attr(group.appendChild(svgEl("path")), { d: frontBand(o.r, o.top, i.r, i.top + 0.8), fill: gl.rim });
  attr(group.appendChild(svgEl("path")), { d: `M${-i.r} ${i.top + 0.8}A${i.r} ${f1(i.r * P)} 0 0 0 ${i.r} ${i.top + 0.8}`, fill: "none", stroke: rgba(theme.ink, 0.22), "stroke-width": 0.8 });
  attr(group.appendChild(svgEl("path")), { d: `M${-o.r + 2} ${o.top + 0.6}A${o.r - 2} ${f1((o.r - 2) * P)} 0 0 0 ${o.r - 2} ${o.top + 0.6}`, fill: "none", stroke: "white", "stroke-opacity": 0.9, "stroke-width": 0.9 });
  if (gl.rimLine) {
    attr(group.appendChild(svgEl("path")), { d: `M${-o.r + 0.6} ${o.top + 1.6}A${o.r - 0.6} ${f1((o.r - 0.6) * P)} 0 0 0 ${o.r - 0.6} ${o.top + 1.6}`, fill: "none", stroke: gl.rimLine, "stroke-opacity": 0.85, "stroke-width": 1.7 });
  }
  if (g.glaze === "terra") {
    attr(group.appendChild(svgEl("path")), { d: `M${-o.r} ${o.top + 3}A${o.r} ${f1(o.r * P)} 0 0 0 ${o.r} ${o.top + 3}`, fill: "none", stroke: "rgba(255,255,255,0.85)", "stroke-width": 2.6 });
  }
  return group;
}

// One cup: defs, shadow, body, liquid, streams and particles, in reference order.
function makeCupView(key, item, idFn, theme) {
  const g = GEO[item.vessel] ?? GEO.cup;
  const pal = item.colours;
  const deep = pal.deep.ramp[pal.deep.ramp.length - 1][1];

  const group = svgEl("g");

  const defs = svgEl("defs");

  const liqGrad = svgEl("linearGradient");
  attr(liqGrad, {
    id: idFn(`liq${key}`),
    gradientUnits: "userSpaceOnUse",
    x1: 0,
    y1: g.inner.bot,
    x2: 0,
    y2: g.inner.top,
  });
  for (let i = 0; i < N; i++) {
    attr(liqGrad.appendChild(svgEl("stop")), { "data-k": "stop", offset: (i + 0.5) / N, "stop-color": rgba(theme.ink, 0) });
  }
  defs.appendChild(liqGrad);

  for (let s = 0; s < 2; s++) {
    const stg = svgEl("linearGradient");
    attr(stg, {
      id: idFn(`st${key}-${s}`),
      gradientUnits: "userSpaceOnUse",
      x1: 0,
      y1: -FLOOR,
      x2: 0,
      y2: -FLOOR + 70,
    });
    attr(stg.appendChild(svgEl("stop")), { "data-k": `sstop${s}`, offset: 0, "stop-opacity": 0, "stop-color": rgba(theme.ink, 0) });
    attr(stg.appendChild(svgEl("stop")), { "data-k": `sstop${s}`, offset: 1, "stop-color": rgba(theme.ink, 0) });
    defs.appendChild(stg);
  }

  const clip = svgEl("clipPath");
  attr(clip, { id: idFn(`sclip${key}`) });
  attr(clip.appendChild(svgEl("path")), { "data-k": "sclip" });
  defs.appendChild(clip);

  const foam = pal.foam ?? mixRGB(deep, [255, 253, 248], 0.7);
  if (item.foam) {
    lin("foamBand", [
      [0, css(mixRGB(foam, deep, 0.22))],
      [0.5, css(foam)],
      [1, css(mixRGB(foam, [255, 255, 250], 0.7))],
    ], true);
  } else {
    lin("cremaBand", [[0, css(mixRGB(deep, foam, 0.35))], [1, css(mixRGB(deep, foam, 0.7))]]);
  }
  if (item.crema) {
    rad("crema", [
      [0, css(mixRGB(deep, foam, 0.6))],
      [0.45, css(mixRGB(deep, foam, 0.45))],
      [0.8, css(deep)],
      [1, css(mixRGB(deep, theme.ink, 0.25))],
    ], 0.45, 0.42, 0.5);
  }
  if (item.foam && item.art !== "heart") {
    rad("foamTop", [
      [0, css(mixRGB(foam, [255, 255, 250], 0.7))],
      [0.6, css(foam)],
      [0.86, css(mixRGB(foam, deep, 0.35))],
      [1, css(mixRGB(foam, deep, 0.55))],
    ]);
  }
  if (item.art === "heart") {
    rad("artBase", [
      [0, css(mixRGB(deep, foam, 0.45))],
      [0.55, css(mixRGB(deep, foam, 0.35))],
      [0.74, css(mixRGB(deep, foam, 0.2))],
      [0.83, css(mixRGB(deep, foam, 0.55))],
      [0.88, css(mixRGB(foam, [255, 255, 250], 0.6))],
      [1, css(foam)],
    ]);
    rad("heart", [[0, css(mixRGB(foam, [255, 255, 250], 0.8))], [0.7, css(foam)], [1, css(mixRGB(foam, deep, 0.3))]]);
  }

  function lin(name, stops, v = false) {
    const g2 = svgEl("linearGradient");
    attr(g2, { id: idFn(name), x1: 0, y1: 0, x2: v ? 0 : 1, y2: v ? 1 : 0 });
    for (const [o, c] of stops) {
      attr(g2.appendChild(svgEl("stop")), { offset: o, "stop-color": c });
    }
    defs.appendChild(g2);
  }
  function rad(name, stops, cx = 0.5, cy = 0.5, r = 0.5) {
    const g2 = svgEl("radialGradient");
    attr(g2, { id: idFn(name), cx, cy, r });
    for (const [o, c] of stops) {
      attr(g2.appendChild(svgEl("stop")), { offset: o, "stop-color": c });
    }
    defs.appendChild(g2);
  }

  group.appendChild(defs);
  group.appendChild(makeShadow(g, idFn, theme));

  const body = svgEl("g");
  attr(body, { "data-k": "body", transform: `translate(${W + 160} ${FLOOR})` });
  body.appendChild(makeVesselBack(g, idFn, theme));

  const liquid = svgEl("g");
  attr(liquid, { "data-k": "liquid", opacity: 0, "clip-path": `url(#${idFn(`clip-${item.vessel}`)})` });

  attr(liquid.appendChild(svgEl("path")), { "data-k": "liq", fill: `url(#${idFn(`liq${key}`)})` });

  if (g.glass) {
    attr(liquid.appendChild(svgEl("path")), { "data-k": "depth", fill: `url(#${idFn("liqDepth")})` });

    const tendG = svgEl("g");
    attr(tendG, { filter: `url(#${idFn("blur3")})`, fill: "none", "stroke-linecap": "round" });
    for (let i = 0; i < TENDRILS; i++) {
      attr(tendG.appendChild(svgEl("path")), { "data-k": "tendril", "stroke-width": 6 - i });
    }
    liquid.appendChild(tendG);
  }

  const foamFill = item.foam ? idFn("foamBand") : idFn("cremaBand");
  attr(liquid.appendChild(svgEl("path")), { "data-k": "foam", fill: `url(#${foamFill})` });
  attr(liquid.appendChild(svgEl("path")), { "data-k": "surf", fill: "rgb(38,26,20)" });

  const sclipG = svgEl("g");
  attr(sclipG, { "clip-path": `url(#${idFn(`sclip${key}`)})` });
  const decor = svgEl("g");
  attr(decor, { "data-k": "decor" });

  attr(decor.appendChild(svgEl("circle")), { r: 1.1, fill: `url(#${idFn("sheen")})` });

  if (item.crema) {
    const crema = svgEl("g");
    attr(crema, { "data-k": "crema", opacity: 0 });
    attr(crema.appendChild(svgEl("circle")), { r: 1.1, fill: `url(#${idFn("crema")})` });
    attr(crema.appendChild(svgEl("ellipse")), { cx: -0.3, cy: -0.1, rx: 0.16, ry: 0.1, fill: rgba(theme.ink, 0.35) });
    attr(crema.appendChild(svgEl("ellipse")), { cx: 0.28, cy: 0.25, rx: 0.12, ry: 0.08, fill: rgba(theme.ink, 0.3) });
    attr(crema.appendChild(svgEl("ellipse")), { cx: 0.1, cy: -0.4, rx: 0.1, ry: 0.06, fill: rgba(theme.ink, 0.25) });
    attr(crema.appendChild(svgEl("ellipse")), { cx: -0.1, cy: 0.1, rx: 0.42, ry: 0.32, fill: rgba(theme.accent, 0.2) });
    for (const [bx, by, br] of BUBBLES) {
      attr(crema.appendChild(svgEl("circle")), { cx: bx, cy: by, r: br, fill: "rgba(255,250,240,0.55)" });
    }
    decor.appendChild(crema);
  }

  if (item.foam && item.art !== "heart") {
    const foamTop = svgEl("g");
    attr(foamTop, { "data-k": "foamtop", opacity: 0 });
    attr(foamTop.appendChild(svgEl("circle")), { r: 1.1, fill: `url(#${idFn("foamTop")})` });
    for (const [bx, by, br] of BUBBLES) {
      attr(foamTop.appendChild(svgEl("circle")), { cx: bx * 0.95, cy: by, r: br * 0.8, fill: rgba(theme.ink, 0.12) });
    }
    decor.appendChild(foamTop);
  }

  if (item.art === "heart") {
    const foamTop = svgEl("g");
    attr(foamTop, { "data-k": "foamtop", opacity: 0 });
    attr(foamTop.appendChild(svgEl("circle")), { r: 1.1, fill: `url(#${idFn("artBase")})` });
    decor.appendChild(foamTop);

    const art = svgEl("g");
    attr(art, { "data-k": "art", opacity: 0 });
    attr(art.appendChild(svgEl("path")), { d: HEART, fill: `url(#${idFn("heart")})`, transform: "scale(0.62)" });
    attr(art.appendChild(svgEl("path")), {
      d: "M0 0.48C0.02 0.2 -0.02 -0.05 0 -0.28",
      fill: "none",
      stroke: rgba(theme.ink, 0.35),
      "stroke-width": 0.035,
      transform: "scale(0.62)",
    });
    decor.appendChild(art);
  }

  sclipG.appendChild(decor);
  liquid.appendChild(sclipG);

  const swirlG = svgEl("g");
  attr(swirlG, { fill: "none", "stroke-linecap": "round", filter: `url(#${idFn("blur1")})` });
  attr(swirlG.appendChild(svgEl("path")), { "data-k": "swirl", "stroke-width": 3.2 });
  attr(swirlG.appendChild(svgEl("path")), { "data-k": "swirl", "stroke-width": 2.2 });
  liquid.appendChild(swirlG);

  const rippleG = svgEl("g");
  attr(rippleG, { fill: "none", stroke: "rgba(255,255,255,1)", "stroke-width": 0.9 });
  for (let i = 0; i < RIPPLES; i++) {
    attr(rippleG.appendChild(svgEl("ellipse")), { "data-k": "ripple", opacity: 0 });
  }
  liquid.appendChild(rippleG);

  body.appendChild(liquid);

  for (let s = 0; s < 2; s++) {
    const sg = svgEl("g");
    attr(sg.appendChild(svgEl("path")), { "data-k": `stream${s}`, fill: `url(#${idFn(`st${key}-${s}`)})` });
    attr(sg.appendChild(svgEl("path")), { "data-k": `streamhi${s}`, fill: "none", stroke: "white", "stroke-width": 0.9, "stroke-linecap": "round" });
    body.appendChild(sg);
  }

  const partsG = svgEl("g");
  for (let i = 0; i < PARTS; i++) {
    attr(partsG.appendChild(svgEl("circle")), { "data-k": "part", r: 0 });
  }
  body.appendChild(partsG);

  body.appendChild(makeVesselFront(g, idFn, theme));
  group.appendChild(body);

  return group;
}

function initPour(container, options = {}) {
  if (!container || !options.drinks?.length) return null;
  const drinks = options.drinks;
  const onAdd = options.onAdd ?? (() => {});

  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = reduceQuery.matches;
  const onReduceChange = (e) => { reduce = e.matches; };
  reduceQuery.addEventListener("change", onReduceChange);

  const theme = readTheme();
  const uid = `cpm${Math.random().toString(36).slice(2, 10).replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const idFn = (s) => `${uid}${s}`;

  // two columns from 640px: drink list left, stage right, stacked on phone
  const root = el("div", "pour-root");
  const list = el("div", "pour-list");
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", "Drinks menu");

  // sits behind the buttons and slides under the selected one
  const pill = el("div", "pour-pill");
  list.appendChild(pill);
  const btns = [];
  drinks.forEach((it) => {
    const btn = el("button", "pour-btn");
    btn.type = "button";
    btn.setAttribute("role", "radio");
    const name = el("span", "pour-btn-name");
    name.textContent = it.name;
    btn.appendChild(name);
    if (it.subtitle) {
      const sub = el("span", "pour-btn-sub");
      sub.textContent = it.subtitle;
      btn.appendChild(sub);
    }
    btn.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") select(it.id);
    });
    btn.addEventListener("focus", () => select(it.id));
    btn.addEventListener("click", () => select(it.id));
    btns.push(btn);
    list.appendChild(btn);
  });

  const stageWrap = el("div", "pour-stage-wrap");
  const stage = el("div", "pour-stage");

  const svg = svgEl("svg");
  attr(svg, { viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" });
  svg.appendChild(makeDefs(idFn, theme));

  const table = svgEl("linearGradient");
  attr(table, { id: idFn("table"), x1: 0, y1: 0, x2: 0, y2: 1 });
  attr(table.appendChild(svgEl("stop")), { offset: 0, "stop-color": rgba(theme.ink, 0), "stop-opacity": 0 });
  attr(table.appendChild(svgEl("stop")), { offset: 1, "stop-color": rgba(theme.ink, 0.14), "stop-opacity": 0.14 });
  svg.appendChild(table);

  const pool = svgEl("radialGradient");
  attr(pool, { id: idFn("pool") });
  attr(pool.appendChild(svgEl("stop")), { offset: 0, "stop-color": rgba(theme.card, 0.5), "stop-opacity": 0.5 });
  attr(pool.appendChild(svgEl("stop")), { offset: 1, "stop-color": rgba(theme.card, 0), "stop-opacity": 0 });
  svg.appendChild(pool);

  attr(svg.appendChild(svgEl("rect")), { x: 0, y: FLOOR - 36, width: W, height: H - FLOOR + 36, fill: `url(#${idFn("table")})` });
  // pool of light on the counter
  attr(svg.appendChild(svgEl("ellipse")), { cx: CX, cy: FLOOR + 2, rx: 170, ry: 46, fill: `url(#${idFn("pool")})` });

  const cupsG = svgEl("g");
  svg.appendChild(cupsG);
  const spillG = svgEl("g");
  const spillDots = [];
  for (let i = 0; i < SPILLS; i++) {
    spillDots.push(spillG.appendChild(svgEl("circle")));
  }
  svg.appendChild(spillG);
  stage.appendChild(svg);

  const live = el("p", "sr-only");
  live.setAttribute("aria-live", "polite");
  stage.appendChild(live);

  const orderRow = el("div", "pour-order");
  const orderText = el("div", "pour-order-text");
  const orderName = el("h3", "pour-order-name");
  const orderPrice = el("p", "pour-order-price");
  orderText.appendChild(orderName);
  orderText.appendChild(orderPrice);
  const addBtn = el("button", "pour-order-add");
  addBtn.type = "button";
  addBtn.textContent = "Add to order";
  addBtn.addEventListener("click", () => {
    if (selected) onAdd(selected);
  });
  orderRow.appendChild(orderText);
  orderRow.appendChild(addBtn);

  stageWrap.appendChild(stage);
  stageWrap.appendChild(orderRow);
  root.appendChild(list);
  root.appendChild(stageWrap);
  container.appendChild(root);

  const sim = new Map();
  const spills = [];
  let raf = 0;
  let nextKey = 1;
  let shown = null;
  let selectedIndex = -1;
  let selected = null;

  function loop() {
    if (raf) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      let busy = false;
      let removed = false;
      for (const c of [...sim.values()]) {
        busy = stepCup(c, dt, t, spills) || busy;
        const gone =
          (c.mode === "fall" && c.y - c.pivot - c.geo.height > H + 20) ||
          (c.mode === "fadeOut" && c.opacity <= 0);
        if (gone) {
          sim.delete(c.key);
          c.el?.root?.remove();
          removed = true;
        } else renderCup(c, t);
      }
      // spilled drops in stage space
      for (let i = spills.length - 1; i >= 0; i--) {
        const q = spills[i];
        q.vy += G_FALL * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        if (q.y > H + 20) spills.splice(i, 1);
      }
      for (let i = 0; i < spillDots.length; i++) {
        const q = spills[i];
        const n = spillDots[i];
        if (!q) {
          n.setAttribute("r", "0");
          continue;
        }
        n.setAttribute("cx", f1(q.x).toString());
        n.setAttribute("cy", f1(q.y).toString());
        n.setAttribute("r", q.r.toFixed(2));
        n.setAttribute("fill", q.col);
      }
      if (spills.length) busy = true;
      raf = busy ? requestAnimationFrame(tick) : 0;
    };
    raf = requestAnimationFrame(tick);
  }

  function register(cup, group) {
    const c = cup;
    if (c && group) {
      c.el = cacheEls(group);
      c.dirty = true;
      renderCup(c, performance.now() / 1000);
      loop();
    }
  }

  // Selection changed: the current cup leaves, the newest choice always wins.
  function applySelection(id) {
    const idx = drinks.findIndex((it) => it.id === id);
    if (idx < 0) return;
    selectedIndex = idx;
    selected = drinks[idx];
    const hasLive = [...sim.values()].some((c) => c.mode !== "fall" && c.mode !== "fadeOut");
    if (hasLive && shown === selected.id) {
      loop();
      return;
    }
    shown = selected.id;
    let falling = 0;
    for (const c of [...sim.values()]) {
      if (c.mode === "fall" || c.mode === "fadeOut") {
        falling++;
        continue;
      }
      if (c.mode === "wait") {
        sim.delete(c.key); // never made it on stage
        c.el?.root?.remove();
        continue;
      }
      if (reduce) {
        c.mode = "fadeOut";
        continue;
      }
      // swap the pivot to the centre of mass without a visual jump
      const d = c.geo.height * 0.45 - c.pivot;
      c.x += d * Math.sin(c.a);
      c.y += d - d * Math.cos(c.a);
      c.pivot += d;
      c.mode = "fall";
      c.vy = -150 - Math.random() * 60;
      c.vx = -30 - Math.random() * 50 + c.vx * 0.3;
      c.va = (Math.random() < 0.75 ? -1 : 1) * (1.3 + Math.random() * 1.4) + c.va * 0.3;
      c.pours = [];
      c.next = c.item.layers.length;
      falling++;
    }
    // cap leftover falling cups
    const fallers = [...sim.values()].filter((c) => c.mode === "fall");
    for (const c of fallers.slice(0, Math.max(0, fallers.length - 3))) {
      sim.delete(c.key);
      c.el?.root?.remove();
    }

    const cup = makeCup(nextKey++, selected);
    if (reduce) {
      cup.mode = "fadeIn";
      cup.opacity = 0;
      cup.x = CX;
      fillInstantly(cup);
    } else {
      cup.wait = falling ? 0.14 : 0.05;
    }
    sim.set(cup.key, cup);
    const group = makeCupView(cup.key, cup.item, idFn, theme);
    cupsG.insertBefore(group, cupsG.firstChild);
    register(cup, group);

    movePill();
    updateRail();
    loop();
  }

  function select(id) {
    if (id === (selected && selected.id)) return;
    applySelection(id);
  }

  function movePill(instant) {
    const btn = btns[selectedIndex];
    if (!btn) return;
    if (instant) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.width = `${btn.offsetWidth}px`;
      pill.style.height = `${btn.offsetHeight}px`;
      pill.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
      pill.style.transition = prev;
      return;
    }
    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.height = `${btn.offsetHeight}px`;
    pill.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
  }

  function updateRail() {
    btns.forEach((btn, i) => {
      const active = i === selectedIndex;
      btn.setAttribute("aria-checked", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
    });
    orderName.textContent = selected ? selected.name : "";
    orderPrice.textContent = selected ? selected.price : "";
    live.textContent = selected ? `${selected.name}: ${selected.description ?? selected.subtitle ?? ""}` : "";
  }

  function onKeyDown(e) {
    const i = selectedIndex;
    let n = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") n = (i + 1) % btns.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = (i - 1 + btns.length) % btns.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = btns.length - 1;
    if (n < 0) return;
    e.preventDefault();
    applySelection(drinks[n].id);
    btns[n].focus();
  }

  const onResize = () => movePill(true);
  window.addEventListener("resize", onResize);
  list.addEventListener("keydown", onKeyDown);

  // initial selection happens without moving the pill, so it just appears
  updateRail();
  applySelection(drinks[0].id);
  movePill(true);

  return {
    select(id) {
      select(id);
    },
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      reduceQuery.removeEventListener("change", onReduceChange);
      window.removeEventListener("resize", onResize);
      root.remove();
    },
  };
}

export {
  initPour,
  silhouette,
  bodyPath,
  frontBand,
  wallLine,
  wallR,
  deposit,
  stir,
  diffuse,
  share,
  wave,
  kick,
  fillInstantly,
  startPour,
  spawnDrop,
  splash,
  stepCup,
  streamPath,
  makeCup,
};

export default initPour;
