/**
 * Conveyor belt component ported faithfully from reference/sushi-conveyor-menu.tsx
 * All geometry, tick physics, interaction formulas and constants match the reference.
 */

// --- Constants (verbatim from reference/sushi-conveyor-menu.tsx) ---
const SPACING = 1.35;
const CURVE = 0.95;
const BAND = 1.22;
const TILT = 0.8;
const SLAT = 0.34;
const LIFT_Y = -6;
const LIFT_SCALE = 0.08;
const BACK_SHADE = 0.15;
const CHIP_ROOM = 34;
const WIDE = 1024;
const HOLD = 1400;
const RUN = 0;
const SEEK = 1;
const DRAG = 2;
const DEFAULT_LABELS = {
  add: "Add to order",
  close: "Close",
  previous: "Previous plate",
  next: "Next plate",
  pause: "Pause belt",
};
const TIERS = [
  { ring: "border-chart-1", dot: "bg-chart-1" },
  { ring: "border-chart-2", dot: "bg-chart-2" },
  { ring: "border-chart-3", dot: "bg-chart-3" },
  { ring: "border-chart-4", dot: "bg-chart-4" },
  { ring: "border-chart-5", dot: "bg-chart-5" },
];
const THEME =
  "[--belt:color-mix(in_oklab,var(--color-foreground)_78%,var(--color-background))] dark:[--belt:color-mix(in_oklab,var(--color-foreground)_16%,var(--color-background))] " +
  "[--belt-side:color-mix(in_oklab,var(--color-foreground)_92%,var(--color-background))] dark:[--belt-side:color-mix(in_oklab,var(--color-foreground)_7%,var(--color-background))] " +
  "[--rail:color-mix(in_oklab,var(--color-muted-foreground)_45%,white)] dark:[--rail:color-mix(in_oklab,var(--color-muted-foreground)_72%,var(--color-background))] " +
  "[--island:color-mix(in_oklab,var(--color-muted-foreground)_16%,var(--color-background))] dark:[--island:color-mix(in_oklab,var(--color-foreground)_13%,var(--color-background))] " +
  "[--island-low:color-mix(in_oklab,var(--color-muted-foreground)_27%,var(--color-background))] dark:[--island-low:color-mix(in_oklab,var(--color-foreground)_8%,var(--color-background))] " +
  "[--island-wall:color-mix(in_oklab,var(--color-muted-foreground)_42%,var(--color-background))] dark:[--island-wall:color-mix(in_oklab,var(--color-foreground)_5%,var(--color-background))]";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tierStyle(tier) {
  return TIERS[clamp(Math.round(tier ?? 1), 1, 5) - 1] ?? TIERS[0];
}

function makeSim() {
  return {
    offset: 0,
    v: 0,
    mode: RUN,
    target: 0,
    lift: [],
    vlift: [],
    z: [],
    lane: [],
    raf: 0,
    last: 0,
    visible: true,
    init: false,
    touched: false,
    l: 0,
    center: -1,
    published: "",
    px: 0,
    py: 0,
    inside: false,
    lock: false,
    lockX: 0,
    lockY: 0,
  };
}

/** Position on the stadium loop. u is arc length on the belt. */
function along(g, u) {
  const { s, r } = g;
  let t = ((u % g.l) + g.l) % g.l;
  if (t < s) return { x: s / 2 - t, z: r, nx: 0, nz: 1, tx: -1, tz: 0 };
  t -= s;
  const arc = Math.PI * r;
  if (t < arc) {
    const f = t / r;
    const sin = Math.sin(f);
    const cos = Math.cos(f);
    return { x: -s / 2 - r * sin, z: r * cos, nx: -sin, nz: cos, tx: -cos, tz: -sin };
  }
  t -= arc;
  if (t < s) return { x: -s / 2 + t, z: -r, nx: 0, nz: -1, tx: 1, tz: 0 };
  t -= s;
  const f = Math.min(Math.PI, t / r);
  const sin = Math.sin(f);
  const cos = Math.cos(f);
  return { x: s / 2 + r * sin, z: -r * cos, nx: sin, nz: -cos, tx: cos, tz: sin };
}

/** Perspective projection matching reference. */
function project(g, x, z) {
  const k = g.a + g.b * z;
  return { x: g.cx + x * k, y: g.ym + TILT * (g.a * z + (g.b * z * z) / 2), k };
}

function makeGeo(width, n, d, kb) {
  const l = Math.max(1, n) * SPACING * d;
  const r = Math.min(CURVE * d, l / (2 * Math.PI));
  const s = Math.max(0, (l - 2 * Math.PI * r) / 2);
  const g = {
    width,
    height: 0,
    d,
    r,
    s,
    l,
    pitch: l / Math.max(1, n),
    n: Math.max(1, n),
    kb,
    cx: width / 2,
    ym: 0,
    a: (1 + kb) / 2,
    b: (1 - kb) / (2 * r),
    band: BAND * d,
    slats: Math.max(10, Math.round(l / (SLAT * d))),
    side: Math.max(3, d * 0.07),
    edgeTop: 0,
  };
  let top = Infinity;
  let bottom = -Infinity;
  let edge = Infinity;
  for (let j = 0; j < 120; j++) {
    const p = along(g, (j / 120) * l);
    const rim = project(g, p.x + (p.nx * g.band) / 2, p.z + (p.nz * g.band) / 2);
    const plate = project(g, p.x, p.z);
    const half = (plate.k * d * TILT) / 2;
    edge = Math.min(edge, rim.y);
    top = Math.min(top, rim.y, plate.y + (LIFT_Y / 100) * half * 2 - half * (1 + LIFT_SCALE) - CHIP_ROOM);
    bottom = Math.max(bottom, rim.y + g.side + d * 0.06, plate.y + half + d * 0.08);
  }
  g.ym = Math.ceil(-top) + 2;
  g.height = Math.ceil(bottom - top) + 4;
  g.edgeTop = edge + g.ym;
  return g;
}

function halfSpan(g) {
  let span = 0;
  for (let j = 0; j < 120; j++) {
    const p = along(g, (j / 120) * g.l);
    const rim = project(g, p.x + (p.nx * g.band) / 2, p.z + (p.nz * g.band) / 2);
    const plate = project(g, p.x, p.z);
    span = Math.max(span, Math.abs(rim.x - g.cx) + 3, Math.abs(plate.x - g.cx) + (plate.k * g.d * (1 + LIFT_SCALE)) / 2);
  }
  return span;
}

function edgePath(g, offset) {
  let d = "";
  const steps = 168;
  for (let j = 0; j < steps; j++) {
    const p = along(g, (j / steps) * g.l);
    const q = project(g, p.x + p.nx * offset, p.z + p.nz * offset);
    d += `${j ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  }
  return `${d}Z`;
}

function slatPath(g, offset, shift) {
  const half = g.band * 0.46;
  const pitch = g.l / g.slats;
  const bulge = pitch * 0.2;
  let d = "";
  for (let j = 0; j < g.slats; j++) {
    const p = along(g, offset + shift + j * pitch);
    const inner = project(g, p.x - p.nx * half, p.z - p.nz * half);
    const outer = project(g, p.x + p.nx * half, p.z + p.nz * half);
    const mid = project(g, p.x + p.tx * bulge, p.z + p.tz * bulge);
    d += `M${inner.x.toFixed(1)} ${inner.y.toFixed(1)}Q${(2 * mid.x - (inner.x + outer.x) / 2).toFixed(1)} ${(2 * mid.y - (inner.y + outer.y) / 2).toFixed(1)} ${outer.x.toFixed(1)} ${outer.y.toFixed(1)}`;
  }
  return d;
}

function pose(g, offset, i) {
  const p = along(g, offset - i * g.pitch);
  const q = project(g, p.x, p.z);
  return { x: q.x, y: q.y, k: q.k, depth: (p.z + g.r) / (2 * g.r) };
}

function centerOf(g, offset) {
  return ((Math.round((offset - g.s / 2) / g.pitch) % g.n) + g.n) % g.n;
}

function legendEntries(items, legend) {
  const out = [];
  for (let tier = 1; tier <= 5; tier++) {
    const label = legend ? legend[tier] : items.find((item) => (item.tier ?? 1) === tier)?.price;
    if (label) out.push({ tier, label });
  }
  return out;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

/**
 * hitTest faithfully calculates bounding elliptical collision on projected plates.
 * Matches line 355 in reference/sushi-conveyor-menu.tsx
 */
function hitTest(live, sim, px, py) {
  const g = live.geo;
  const s = sim;
  if (!g) return null;
  let best = null;
  let bestY = -Infinity;
  for (let i = 0; i < live.count; i++) {
    const q = pose(g, s.offset, i);
    const e = clamp(s.lift[i] ?? 0, 0, 1.2);
    const grow = (1 + LIFT_SCALE * e) * (i === live.active ? 1.1 : 1);
    const rx = (g.d * q.k * grow) / 2;
    const ry = (g.d * TILT * q.k * grow) / 2;
    const dx = (px - q.x) / rx;
    const dy = (py - (q.y + (LIFT_Y / 100) * g.d * TILT * q.k * e)) / ry;
    if (dx * dx + dy * dy > 1) continue;
    if (i === live.active) return i;
    if (q.y > bestY) {
      best = i;
      bestY = q.y;
    }
  }
  return best;
}

/**
 * tick physics loop faithfully updating velocity, spring lifts, sub-steps and slat rendering.
 * Matches line 379 in reference/sushi-conveyor-menu.tsx
 */
function tick(sim, live, pointer, paintAll, hover, now) {
  const s = sim;
  const L = live;
  const g = L.geo;
  s.raf = 0;
  if (!g || !s.visible) {
    s.last = 0;
    return;
  }
  const dt = s.last ? clamp((now - s.last) / 1000, 0, 0.25) : 1 / 60;
  s.last = now;
  // Sub-steps keep the springs stable and the belt on real time when frames arrive late.
  const steps = Math.max(1, Math.ceil(dt / 0.017));
  const h = dt / steps;
  const stopped = L.paused || L.active !== null || L.open;
  const cruise = L.reduced ? 0 : L.speed;
  for (let step = 0; step < steps; step++) {
    if (s.mode === SEEK) {
      const w = 5.6;
      s.v += (w * w * (s.target - s.offset) - 2 * w * s.v) * h;
      s.offset += s.v * h;
      if (Math.abs(s.target - s.offset) < 0.3 && Math.abs(s.v) < 4) {
        s.offset = s.target;
        s.v = 0;
        s.mode = RUN;
      }
    } else if (s.mode === RUN) {
      if (stopped) {
        s.v *= Math.exp(-7.2 * h);
        if (Math.abs(s.v) < 0.02) s.v = 0;
      } else {
        let e = s.v - cruise;
        if (Math.abs(e) > Math.max(6, cruise * 0.5)) {
          e = Math.sign(e) * Math.max(0, Math.abs(e) * Math.exp(-2.4 * h) - 90 * h);
        } else {
          e *= Math.exp(-3.4 * h);
        }
        s.v = cruise + (Math.abs(e) < 0.01 ? 0 : e);
      }
      s.offset += s.v * h;
    }
    for (let i = 0; i < L.count; i++) {
      const goal = i === L.active ? 1 : 0;
      if (L.reduced) {
        s.lift[i] = goal;
        s.vlift[i] = 0;
        continue;
      }
      const x = s.lift[i] ?? 0;
      const v = (s.vlift[i] ?? 0) + (330 * (goal - x) - 23 * (s.vlift[i] ?? 0)) * h;
      s.lift[i] = x + v * h;
      s.vlift[i] = v;
    }
  }
  let busy = s.mode !== RUN || s.v !== 0 || (!stopped && cruise > 0);
  for (let i = 0; i < L.count; i++) {
    const goal = i === L.active ? 1 : 0;
    if (Math.abs(goal - (s.lift[i] ?? 0)) < 0.002 && Math.abs(s.vlift[i] ?? 0) < 0.02) {
      s.lift[i] = goal;
      s.vlift[i] = 0;
    } else {
      busy = true;
    }
  }
  if (s.inside && !s.lock && s.mode === RUN && !L.open && pointer.id < 0 && Math.abs(s.v) > 0.3) {
    const hit = hitTest(L, s, s.px, s.py);
    if (hit !== null && hit !== L.active) hover(hit);
  }
  paintAll();
  if (busy) {
    s.raf = requestAnimationFrame((t) => tick(sim, live, pointer, paintAll, hover, t));
  } else {
    s.last = 0;
  }
}

/**
 * DishDialog faithfully renders the modal dialog and runs the plate flight animation.
 * Matches line 941 in reference/sushi-conveyor-menu.tsx
 */
function DishDialog({ uid, item, index, total, labels, reduced, broken, source, onLift, onAdd, onClose }) {
  const tier = tierStyle(item.tier);
  const titleId = `${uid}-dish-title`;
  let closing = false;
  let added = false;
  let timer = 0;
  let animation = null;

  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", titleId);
  overlay.setAttribute("data-dish-dialog", "");
  overlay.className = "sushi-dialog fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 text-foreground sm:p-8";

  const backdrop = document.createElement("div");
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.className = "sushi-dialog-backdrop absolute inset-0 bg-background/80 backdrop-blur-md transition-opacity duration-300";
  backdrop.style.opacity = "0";

  const card = document.createElement("div");
  card.className = "sushi-dialog-card relative grid w-full max-w-[52rem] items-center gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] sm:gap-10 sm:p-8";

  const cardBg = document.createElement("div");
  cardBg.setAttribute("aria-hidden", "true");
  cardBg.className = "sushi-dialog-card-bg absolute inset-0 rounded-[2rem] border border-border bg-card shadow-2xl transition-[opacity,scale] duration-300";
  cardBg.style.opacity = "0";
  cardBg.style.transform = "scale(0.97)";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "sushi-dialog-close absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-[opacity,color] duration-300 hover:text-foreground";
  closeBtn.style.opacity = "0";
  closeBtn.innerHTML = `${labels.close} <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>`;

  const figure = document.createElement("div");
  figure.setAttribute("data-dish-figure", "");
  figure.className = "sushi-dialog-figure relative mx-auto aspect-square w-full max-w-[min(42vh,22rem)]";

  const figShadow = document.createElement("span");
  figShadow.setAttribute("aria-hidden", "true");
  figShadow.className = "absolute inset-x-[8%] bottom-[-4%] top-[14%] rounded-full bg-black opacity-25 blur-2xl";

  figure.appendChild(figShadow);

  if (broken) {
    const ph = document.createElement("span");
    ph.setAttribute("aria-hidden", "true");
    ph.className = "absolute inset-[3%] rounded-full border border-border bg-muted flex items-center justify-center";
    ph.innerHTML = '<span class="size-[40%] rounded-full bg-muted-foreground/25"></span>';
    figure.appendChild(ph);
  } else {
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.name;
    img.draggable = false;
    img.className = "relative size-full select-none object-contain";
    figure.appendChild(img);
  }

  const figRing = document.createElement("span");
  figRing.setAttribute("aria-hidden", "true");
  figRing.className = `absolute -inset-[1.5%] rounded-full border-[3px] ${tier.ring}`;
  figRing.style.borderColor = `var(--tier-${item.tier ?? 1}, currentColor)`;
  figure.appendChild(figRing);

  const contentCol = document.createElement("div");
  contentCol.className = "relative flex flex-col gap-3 text-center transition-[opacity,translate] delay-150 duration-500 sm:text-left";
  contentCol.style.opacity = "0";
  contentCol.style.transform = "translateY(8px)";

  const counterP = document.createElement("p");
  counterP.className = "flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground sm:justify-start";
  counterP.innerHTML = `<span aria-hidden="true" class="size-2 rounded-full ${tier.dot}" style="background-color:var(--tier-${item.tier ?? 1}, currentColor)"></span>${pad(index + 1)} / ${pad(total)}`;

  const titleH3 = document.createElement("h3");
  titleH3.id = titleId;
  titleH3.className = "text-2xl font-medium tracking-tight sm:text-3xl";
  titleH3.textContent = item.name;

  contentCol.appendChild(counterP);
  contentCol.appendChild(titleH3);

  if (item.description) {
    const descP = document.createElement("p");
    descP.className = "text-sm leading-relaxed text-muted-foreground";
    descP.textContent = item.description;
    contentCol.appendChild(descP);
  }

  if (item.details && item.details.length > 0) {
    const detailsUl = document.createElement("ul");
    detailsUl.className = "flex flex-wrap justify-center gap-2 sm:justify-start";
    item.details.forEach((d) => {
      const li = document.createElement("li");
      li.className = "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground";
      li.textContent = typeof d === "string" ? d : (d.label ? `${d.label}: ${d.value}` : d.value);
      detailsUl.appendChild(li);
    });
    contentCol.appendChild(detailsUl);
  }

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "mt-2 flex flex-wrap items-center justify-center gap-4 sm:justify-start";

  const priceP = document.createElement("p");
  priceP.className = "text-2xl font-semibold tabular-nums tracking-tight";
  priceP.textContent = item.price;

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.setAttribute("data-add", "");
  addBtn.className = "inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-sm outline-none transition-[translate,box-shadow] hover:-translate-y-px hover:shadow-md";
  addBtn.innerHTML = `<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9" /></svg> ${labels.add}`;

  actionsDiv.appendChild(priceP);
  actionsDiv.appendChild(addBtn);
  contentCol.appendChild(actionsDiv);

  card.appendChild(cardBg);
  card.appendChild(closeBtn);
  card.appendChild(figure);
  card.appendChild(contentCol);
  overlay.appendChild(backdrop);
  overlay.appendChild(card);

  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  onLift(true);

  document.body.appendChild(overlay);

  const from = source();
  if (figure && from && !reduced && from.width > 0) {
    const to = figure.getBoundingClientRect();
    const sx = from.width / to.width;
    const sy = from.height / to.height;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const rise = Math.min(120, Math.abs(dy) * 0.3 + 40);
    animation = figure.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transform: `translate(${dx * 0.42}px, ${dy * 0.42 - rise}px) scale(${((sx + 1) / 2) * 1.05}, ${((sy + 1) / 2) * 1.05}) rotate(${dx > 0 ? -6 : 6}deg)`, offset: 0.5 },
      { transform: "none" },
    ], { duration: 680, easing: "cubic-bezier(.22,.85,.3,1)" });
  }

  requestAnimationFrame(() => {
    backdrop.style.opacity = "1";
    cardBg.style.opacity = "1";
    cardBg.style.transform = "scale(1)";
    closeBtn.style.opacity = "1";
    contentCol.style.opacity = "1";
    contentCol.style.transform = "translateY(0)";
  });

  closeBtn.focus({ preventScroll: true });

  function cleanup() {
    animation?.cancel();
    window.clearTimeout(timer);
    document.body.style.overflow = prevOverflow;
    document.removeEventListener("keydown", onGlobalKey);
    overlay.remove();
    onLift(false);
  }

  function dismiss() {
    if (closing) return;
    closing = true;
    backdrop.style.opacity = "0";
    cardBg.style.opacity = "0";
    cardBg.style.transform = "scale(0.97)";
    closeBtn.style.opacity = "0";
    contentCol.style.opacity = "0";

    const to = source();
    if (!figure || !to || reduced || to.width === 0) {
      cleanup();
      onClose();
      return;
    }
    const fromNow = figure.getBoundingClientRect();
    const sx = to.width / fromNow.width;
    const sy = to.height / fromNow.height;
    const dx = to.left + to.width / 2 - (fromNow.left + fromNow.width / 2);
    const dy = to.top + to.height / 2 - (fromNow.top + fromNow.height / 2);
    const exitAnim = figure.animate([
      { transform: "none" },
      { transform: `translate(${dx * 0.58}px, ${dy * 0.58 - 36}px) scale(${(sx + 1) / 2}, ${(sy + 1) / 2})`, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
    ], { duration: 540, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" });

    exitAnim.onfinish = () => {
      cleanup();
      onClose();
    };
  }

  function add() {
    if (added || closing) return;
    added = true;
    onAdd();
    addBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg> ' + labels.add;
    timer = window.setTimeout(dismiss, reduced ? 0 : 450);
  }

  function onGlobalKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
    } else if (e.key === "Tab") {
      const focusable = [...card.querySelectorAll('button:not([disabled]), [tabindex="0"]')];
      if (focusable.length < 2) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  backdrop.addEventListener("click", dismiss);
  closeBtn.addEventListener("click", dismiss);
  addBtn.addEventListener("click", add);
  document.addEventListener("keydown", onGlobalKey);

  return { dismiss };
}

/**
 * Injects required stylesheet rules for conveyor theme, counter, slats, and modal dialog.
 */
function injectStylesOnce() {
  if (document.getElementById("chef-belt-component-styles")) return;
  const style = document.createElement("style");
  style.id = "chef-belt-component-styles";
  style.textContent = `
    [data-slot="sushi-conveyor-menu"] {
      --belt: color-mix(in oklab, var(--foreground, #2A1A12) 78%, var(--background, #FBF6EE));
      --belt-side: color-mix(in oklab, var(--foreground, #2A1A12) 92%, var(--background, #FBF6EE));
      --rail: color-mix(in oklab, var(--muted-foreground, #7A6657) 45%, white);
      --island: color-mix(in oklab, var(--muted-foreground, #7A6657) 16%, var(--background, #FBF6EE));
      --island-low: color-mix(in oklab, var(--muted-foreground, #7A6657) 27%, var(--background, #FBF6EE));
      --island-wall: color-mix(in oklab, var(--muted-foreground, #7A6657) 42%, var(--background, #FBF6EE));
      position: relative;
      isolation: isolate;
      width: 100%;
      overflow: hidden;
    }
    @media (prefers-color-scheme: dark) {
      [data-slot="sushi-conveyor-menu"] {
        --belt: color-mix(in oklab, var(--foreground, #F5EBDD) 16%, var(--background, #1D130C));
        --belt-side: color-mix(in oklab, var(--foreground, #F5EBDD) 7%, var(--background, #1D130C));
        --rail: color-mix(in oklab, var(--muted-foreground, #B8A292) 72%, var(--background, #1D130C));
        --island: color-mix(in oklab, var(--foreground, #F5EBDD) 13%, var(--background, #1D130C));
        --island-low: color-mix(in oklab, var(--foreground, #F5EBDD) 8%, var(--background, #1D130C));
        --island-wall: color-mix(in oklab, var(--foreground, #F5EBDD) 5%, var(--background, #1D130C));
      }
    }
    .sushi-control-btn {
      display: inline-flex;
      width: 2rem;
      height: 2rem;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      border: 1px solid var(--border, #E6D8C4);
      background: var(--card, #FFFFFF);
      color: var(--muted-foreground, #7A6657);
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      outline: none;
      cursor: pointer;
      transition: color 0.15s;
    }
    .sushi-control-btn:hover {
      color: var(--foreground, #2A1A12);
    }
    .sushi-control-btn:focus-visible {
      outline: 2px solid var(--ring, #C2410C);
      outline-offset: 2px;
    }
    .sushi-dialog {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .sushi-dialog-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      transition: opacity 300ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .sushi-dialog-card {
      position: relative;
      width: 100%;
      max-width: 52rem;
      display: grid;
      gap: 1.5rem;
      padding: 1.5rem;
      z-index: 10;
    }
    @media (min-width: 640px) {
      .sushi-dialog-card {
        grid-template-columns: minmax(0, 1fr) minmax(0, 19rem);
        gap: 2.5rem;
        padding: 2rem;
      }
    }
    .sushi-dialog-card-bg {
      position: absolute;
      inset: 0;
      border-radius: 2rem;
      border: 1px solid var(--border, #E6D8C4);
      background: var(--card, #FFFFFF);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      transition: opacity 300ms, transform 300ms;
    }
    .sushi-dialog-close {
      position: absolute;
      right: 1rem;
      top: 1rem;
      z-index: 20;
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      border-radius: 9999px;
      border: none;
      background: transparent;
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--muted-foreground, #7A6657);
      cursor: pointer;
    }
    .sushi-dialog-close:hover {
      color: var(--foreground, #2A1A12);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Vanilla JavaScript port of SushiConveyorMenu.
 * Mounts the faithful conveyor belt into container.
 */
export function initBelt(container, options = {}) {
  if (!container) {
    console.error("belt: container is required");
    return;
  }

  injectStylesOnce();

  const items = options.items || options.dishes || [];
  const count = items.length;
  const speedProp = options.speed !== undefined ? (options.speed > 200 ? 26 : options.speed) : 26;
  const autoplay = options.autoplay !== undefined ? options.autoplay : true;
  const interval = options.interval || 3000;
  const labels = { ...DEFAULT_LABELS, ...(options.labels || {}) };
  const onPlateSelect = options.onPlateSelect || options.onAdd;
  const legend = options.legend;

  const uid = `belt-${Math.random().toString(36).slice(2, 9)}`;
  const sim = makeSim();
  const pointer = { id: -1, index: -1, x: 0, y: 0, moved: false, start: 0, lane: 1, lastX: 0, lastT: 0, v: 0 };
  let pendingOpen = -1;
  let returnFocus = null;
  let autoActive = null;
  let autoLast = null;
  let active = null;
  let paused = !!options.paused;
  let openIndex = null;
  let lifted = null;
  let playing = autoplay;
  let center = 0;
  const failed = {};
  let size = { section: container.clientWidth || 800, stage: container.clientWidth || 800 };

  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = mediaQuery.matches;
  mediaQuery.addEventListener("change", () => {
    reduced = mediaQuery.matches;
    live.reduced = reduced;
    kick();
  });

  const wide = size.section >= WIDE;
  const narrow = size.section > 0 && size.section < 480;
  const kb = narrow ? 0.6 : 0.68;

  function calculateGeo() {
    if (!size.stage || count === 0) return null;
    const span = halfSpan(makeGeo(1000, count, 100, kb)) / 100;
    const cap = wide ? 150 : clamp(size.section * 0.143, 96, 150);
    const fit = (size.stage - 8) / (2 * span);
    return makeGeo(size.stage, count, Math.round(clamp(fit, Math.min(96, cap), cap)), kb);
  }

  let geo = calculateGeo();

  const live = {
    geo,
    active,
    paused,
    reduced,
    open: false,
    count,
    speed: Math.max(0, speedProp),
    activeControlled: false,
    pausedControlled: false,
    onActiveChange: options.onActiveChange,
    onPausedChange: options.onPausedChange,
    onOpenChange: options.onOpenChange,
    onAdd: onPlateSelect,
  };

  container.innerHTML = "";

  const section = document.createElement("section");
  section.setAttribute("data-slot", "sushi-conveyor-menu");
  section.setAttribute("data-layout", wide ? "wide" : "stack");
  section.setAttribute("data-center", "0");
  section.className = `relative isolate w-full overflow-hidden ${THEME}`;

  const radial = document.createElement("div");
  radial.setAttribute("aria-hidden", "true");
  radial.className = "pointer-events-none absolute inset-0 -z-10";
  radial.style.background = "radial-gradient(64% 52% at 50% 56%, color-mix(in oklab, var(--foreground, #2A1A12) 5%, transparent), transparent 72%)";
  section.appendChild(radial);

  const stage = document.createElement("div");
  stage.setAttribute("data-stage", "");
  stage.setAttribute("role", "group");
  stage.setAttribute("aria-label", options.heading || "Sushi conveyor belt");
  stage.setAttribute("aria-roledescription", "conveyor belt");
  stage.className = "relative w-full touch-pan-y select-none";
  stage.style.height = `${geo ? geo.height : 260}px`;
  stage.style.overflowX = "clip";

  const counterDiv = document.createElement("div");
  counterDiv.setAttribute("aria-hidden", "true");
  counterDiv.setAttribute("data-counter", "");
  counterDiv.className = "pointer-events-none absolute inset-x-0";
  stage.appendChild(counterDiv);

  const beltDiv = document.createElement("div");
  beltDiv.setAttribute("data-belt", "");
  beltDiv.setAttribute("aria-hidden", "true");
  beltDiv.className = "pointer-events-none absolute inset-0";

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "absolute left-0 top-0 overflow-visible");
  svg.setAttribute("focusable", "false");

  const defs = document.createElementNS(svgNS, "defs");
  defs.innerHTML = `
    <filter id="${uid}-soft" x="-10%" y="-30%" width="120%" height="160%">
      <feGaussianBlur stdDeviation="6.0" />
    </filter>
    <linearGradient id="${uid}-island" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" style="stop-color: var(--island)" />
      <stop offset="1" style="stop-color: var(--island-low)" />
    </linearGradient>
  `;
  svg.appendChild(defs);

  const shadowPath = document.createElementNS(svgNS, "path");
  shadowPath.setAttribute("fill", "black");
  shadowPath.setAttribute("class", "opacity-[0.18]");
  shadowPath.setAttribute("filter", `url(#${uid}-soft)`);
  svg.appendChild(shadowPath);

  const beltSidePath = document.createElementNS(svgNS, "path");
  beltSidePath.setAttribute("fill-rule", "evenodd");
  beltSidePath.style.fill = "var(--belt-side)";
  svg.appendChild(beltSidePath);

  const beltTopPath = document.createElementNS(svgNS, "path");
  beltTopPath.setAttribute("fill-rule", "evenodd");
  beltTopPath.style.fill = "var(--belt)";
  svg.appendChild(beltTopPath);

  const seamPath = document.createElementNS(svgNS, "path");
  seamPath.setAttribute("fill", "none");
  seamPath.setAttribute("stroke", "black");
  seamPath.setAttribute("stroke-opacity", "0.42");
  seamPath.setAttribute("stroke-linecap", "round");
  svg.appendChild(seamPath);

  const glintPath = document.createElementNS(svgNS, "path");
  glintPath.setAttribute("fill", "none");
  glintPath.setAttribute("stroke", "white");
  glintPath.setAttribute("stroke-opacity", "0.14");
  glintPath.setAttribute("stroke-linecap", "round");
  svg.appendChild(glintPath);

  const outerRail = document.createElementNS(svgNS, "path");
  outerRail.setAttribute("fill", "none");
  outerRail.style.stroke = "var(--rail)";
  svg.appendChild(outerRail);

  const outerRailGlint = document.createElementNS(svgNS, "path");
  outerRailGlint.setAttribute("fill", "none");
  outerRailGlint.setAttribute("stroke", "white");
  outerRailGlint.setAttribute("stroke-opacity", "0.55");
  outerRailGlint.setAttribute("transform", "translate(0 -0.8)");
  svg.appendChild(outerRailGlint);

  const innerRail = document.createElementNS(svgNS, "path");
  innerRail.setAttribute("fill", "none");
  innerRail.style.stroke = "var(--rail)";
  svg.appendChild(innerRail);

  const innerRailGlint = document.createElementNS(svgNS, "path");
  innerRailGlint.setAttribute("fill", "none");
  innerRailGlint.setAttribute("stroke", "white");
  innerRailGlint.setAttribute("stroke-opacity", "0.4");
  innerRailGlint.setAttribute("transform", "translate(0 -0.7)");
  svg.appendChild(innerRailGlint);

  const islandWall = document.createElementNS(svgNS, "path");
  islandWall.style.fill = "var(--island-wall)";
  svg.appendChild(islandWall);

  const islandTop = document.createElementNS(svgNS, "path");
  islandTop.style.fill = `url(#${uid}-island)`;
  svg.appendChild(islandTop);

  const islandGlint = document.createElementNS(svgNS, "path");
  islandGlint.setAttribute("fill", "none");
  islandGlint.setAttribute("stroke", "white");
  islandGlint.setAttribute("stroke-opacity", "0.55");
  svg.appendChild(islandGlint);

  beltDiv.appendChild(svg);
  stage.appendChild(beltDiv);

  const plates = [];
  const lifts = [];
  const shades = [];
  const shadows = [];
  const anchors = [];
  const chips = [];

  for (let i = 0; i < count; i++) {
    const item = items[i];
    const tier = tierStyle(item.tier);
    const broken = !!failed[item.id];
    const mask = `url("${item.image}") 0 0 / 100% 100% no-repeat`;

    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-dish", String(i));
    button.tabIndex = i === 0 ? 0 : -1;
    button.setAttribute("aria-label", `${item.name}, ${item.price}`);
    button.setAttribute("aria-describedby", `${uid}-caption`);
    button.setAttribute("aria-haspopup", "dialog");
    button.className = "absolute left-0 top-0 cursor-pointer rounded-[50%] outline-none";
    button.style.position = "absolute";

    const shadowOuter = document.createElement("span");
    shadowOuter.setAttribute("aria-hidden", "true");
    shadowOuter.className = "pointer-events-none absolute inset-0 opacity-50";

    const shadowInner = document.createElement("span");
    shadowInner.className = "absolute inset-x-[5%] bottom-[-9%] top-[16%] rounded-[50%] bg-black";
    shadowOuter.appendChild(shadowInner);
    shadows.push(shadowInner);

    const liftSpan = document.createElement("span");
    liftSpan.setAttribute("data-lift", "");
    liftSpan.className = "absolute inset-0";

    const placeholder = document.createElement("span");
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.setAttribute("data-placeholder", "");
    placeholder.className = `absolute rounded-[50%] border border-border bg-card ${broken ? "inset-[3%] shadow-sm" : "inset-[6%]"}`;
    placeholder.innerHTML = '<span class="absolute inset-[30%] rounded-[50%] bg-muted-foreground/20"></span>';
    liftSpan.appendChild(placeholder);

    if (!broken) {
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = "";
      img.draggable = false;
      img.className = "pointer-events-none absolute inset-0 size-full select-none object-fill";
      img.onerror = () => {
        failed[item.id] = true;
        img.remove();
      };
      liftSpan.appendChild(img);

      const shade = document.createElement("span");
      shade.setAttribute("aria-hidden", "true");
      shade.className = "pointer-events-none absolute inset-0 bg-black";
      shade.style.opacity = "0";
      shade.style.webkitMask = mask;
      shade.style.mask = mask;
      liftSpan.appendChild(shade);
      shades.push(shade);
    } else {
      shades.push(null);
    }

    const ring = document.createElement("span");
    ring.setAttribute("aria-hidden", "true");
    ring.setAttribute("data-ring", "");
    ring.className = `pointer-events-none absolute -inset-[2%] rounded-[50%] border-2 ${tier.ring}`;
    ring.style.borderColor = `var(--tier-${item.tier ?? 1}, currentColor)`;
    liftSpan.appendChild(ring);

    const anchor = document.createElement("span");
    anchor.setAttribute("aria-hidden", "true");
    anchor.className = "pointer-events-none absolute left-1/2 top-0 size-0";

    const chip = document.createElement("span");
    chip.setAttribute("data-chip", "");
    chip.className = "absolute bottom-[7px] left-0 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card py-1 pl-2 pr-2.5 text-[11px] font-medium leading-none text-card-foreground shadow-[0_6px_16px_-6px_rgba(0,0,0,0.3)] transition-[opacity,translate] duration-300";
    chip.style.opacity = "0";
    chip.style.transform = "translateY(4px) translateX(-50%)";
    chip.innerHTML = `<span class="size-1.5 rounded-full ${tier.dot}" style="background-color:var(--tier-${item.tier ?? 1}, currentColor)"></span>${item.name} <span class="tabular-nums text-muted-foreground">${item.price}</span>`;

    anchor.appendChild(chip);
    liftSpan.appendChild(anchor);
    anchors.push(anchor);
    chips.push(chip);

    button.appendChild(shadowOuter);
    button.appendChild(liftSpan);
    stage.appendChild(button);

    plates.push(button);
    lifts.push(liftSpan);
  }

  const controlsDiv = document.createElement("div");
  controlsDiv.className = "relative z-10 mt-3 flex items-center justify-center gap-1.5";
  controlsDiv.innerHTML = `
    <button type="button" data-control="previous" aria-label="${labels.previous}" class="sushi-control-btn">
      <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
    </button>
    <button type="button" data-control="pause" aria-label="${labels.pause}" aria-pressed="${paused}" class="sushi-control-btn">
      ${paused
        ? '<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M5 3.4v9.2a.6.6 0 0 0 .9.5l7.4-4.6a.6.6 0 0 0 0-1L5.9 2.9a.6.6 0 0 0-.9.5Z" /></svg>'
        : '<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="4" y="3" width="2.6" height="10" rx="0.8" /><rect x="9.4" y="3" width="2.6" height="10" rx="0.8" /></svg>'}
    </button>
    <button type="button" data-control="next" aria-label="${labels.next}" class="sushi-control-btn">
      <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
    </button>
  `;

  const captionNode = document.createElement("div");
  captionNode.id = `${uid}-caption`;
  captionNode.setAttribute("aria-live", "polite");
  captionNode.setAttribute("data-caption", "");
  captionNode.className = "mx-auto mt-2 max-w-md px-2 text-center min-h-[2.75rem]";
  captionNode.innerHTML = `<p class="text-sm text-muted-foreground">${options.caption || ""}</p>`;

  section.appendChild(stage);
  if (count > 1) section.appendChild(controlsDiv);
  section.appendChild(captionNode);
  container.appendChild(section);

  function syncPaths() {
    if (!geo) return;
    const paths = {
      outer: edgePath(geo, geo.band / 2),
      inner: edgePath(geo, -geo.band / 2),
      island: edgePath(geo, -geo.band / 2 - geo.d * 0.035),
    };
    svg.setAttribute("width", String(geo.width));
    svg.setAttribute("height", String(geo.height));
    svg.setAttribute("viewBox", `0 0 ${geo.width} ${geo.height}`);

    const blurDev = (geo.d * 0.06).toFixed(1);
    defs.querySelector("feGaussianBlur")?.setAttribute("stdDeviation", blurDev);

    shadowPath.setAttribute("d", paths.outer);
    shadowPath.setAttribute("transform", `translate(0 ${(geo.side + geo.d * 0.07).toFixed(1)})`);

    const compound = `${paths.outer}${paths.inner}`;
    beltSidePath.setAttribute("d", compound);
    beltSidePath.setAttribute("transform", `translate(0 ${geo.side.toFixed(1)})`);

    beltTopPath.setAttribute("d", compound);

    outerRail.setAttribute("d", paths.outer);
    outerRail.setAttribute("stroke-width", String(Math.max(2, geo.d * 0.026)));

    outerRailGlint.setAttribute("d", paths.outer);
    outerRailGlint.setAttribute("stroke-width", String(Math.max(0.8, geo.d * 0.008)));

    innerRail.setAttribute("d", paths.inner);
    innerRail.setAttribute("stroke-width", String(Math.max(1.6, geo.d * 0.02)));

    innerRailGlint.setAttribute("d", paths.inner);
    innerRailGlint.setAttribute("stroke-width", String(Math.max(0.8, geo.d * 0.008)));

    islandWall.setAttribute("d", paths.island);
    islandTop.setAttribute("d", paths.island);
    islandTop.setAttribute("transform", `translate(0 ${(-geo.side * 0.6).toFixed(1)})`);

    islandGlint.setAttribute("d", paths.island);
    islandGlint.setAttribute("transform", `translate(0 ${(-geo.side * 0.6 - 0.6).toFixed(1)})`);
    islandGlint.setAttribute("stroke-width", String(Math.max(0.8, geo.d * 0.008)));

    seamPath.setAttribute("stroke-width", String(Math.max(1, geo.d * 0.013)));
    glintPath.setAttribute("stroke-width", String(Math.max(0.8, geo.d * 0.009)));

    counterDiv.style.top = `${Math.max(0, geo.edgeTop - geo.d * 0.34)}px`;
    counterDiv.style.height = `${geo.ym - Math.max(0, geo.edgeTop - geo.d * 0.34)}px`;

    stage.style.height = `${geo.height}px`;

    for (let i = 0; i < count; i++) {
      plates[i].style.width = `${geo.d}px`;
      plates[i].style.height = `${geo.d * TILT}px`;
      shadows[i].style.filter = `blur(${Math.max(2, geo.d * 0.045).toFixed(1)}px)`;
    }
  }

  function paintPlate(i) {
    const g = live.geo;
    const button = plates[i];
    if (!g || !button) return;
    const q = pose(g, sim.offset, i);
    const e = sim.lift[i] ?? 0;
    button.style.transform = `translate3d(${(q.x - g.d / 2).toFixed(2)}px,${(q.y - (g.d * TILT) / 2).toFixed(2)}px,0) scale(${q.k.toFixed(4)})`;
    const z = i === live.active ? 2000 : 100 + Math.round(q.y);
    if (sim.z[i] !== z) {
      sim.z[i] = z;
      button.style.zIndex = String(z);
    }
    const lane = q.depth >= 0.5 ? "front" : "back";
    if (sim.lane[i] !== lane) {
      sim.lane[i] = lane;
      button.dataset.lane = lane;
    }
    const lift = lifts[i];
    if (lift) lift.style.transform = `translateY(${(LIFT_Y * e).toFixed(3)}%) scale(${(1 + LIFT_SCALE * e).toFixed(4)})`;

    const shade = shades[i];
    if (shade) shade.style.opacity = (BACK_SHADE * clamp(1 - q.depth, 0, 1) * (1 - 0.7 * clamp(e, 0, 1))).toFixed(3);

    const shadow = shadows[i];
    if (shadow) {
      shadow.style.transform = `translate3d(0,${(g.d * TILT * 0.05 * e).toFixed(2)}px,0) scale(${(1 + 0.14 * e).toFixed(3)})`;
      shadow.style.opacity = (1 - 0.5 * clamp(e, 0, 1)).toFixed(3);
    }

    const anchor = anchors[i];
    if (anchor) anchor.style.transform = `scale(${(1 / (q.k * (1 + LIFT_SCALE * e))).toFixed(4)})`;

    const chip = chips[i];
    if (chip) {
      const isAct = live.active === i && lifted !== i;
      chip.style.opacity = isAct ? "1" : "0";
      chip.style.transform = isAct ? "translateY(0) translateX(-50%)" : "translateY(4px) translateX(-50%)";
    }

    button.style.visibility = lifted === i ? "hidden" : "";
  }

  function paintBelt() {
    const g = live.geo;
    if (!g) return;
    seamPath.setAttribute("d", slatPath(g, sim.offset, 0));
    glintPath.setAttribute("d", slatPath(g, sim.offset, -Math.max(1.4, g.d * 0.024)));

    const v = (Math.abs(sim.v) < 0.005 ? 0 : sim.v).toFixed(2);
    if (v !== sim.published) {
      sim.published = v;
      beltDiv.style.setProperty("--belt-v", v);
    }
    const c = centerOf(g, sim.offset);
    if (c !== sim.center) {
      sim.center = c;
      center = c;
      section.setAttribute("data-center", String(c));
    }
  }

  function paintAll() {
    for (let i = 0; i < live.count; i++) paintPlate(i);
    paintBelt();
    updateCaption();
  }

  function updateCaption() {
    const cur = live.active !== null ? items[live.active] : null;
    const globalCaption = document.querySelector(".section-caption");
    if (cur) {
      const html = `<p class="text-sm font-medium text-foreground">${cur.name} <span class="font-normal tabular-nums text-muted-foreground">· ${cur.price}</span></p>${cur.description ? `<p class="mt-0.5 text-[13px] leading-snug text-muted-foreground">${cur.description}</p>` : ""}`;
      captionNode.innerHTML = html;
      if (globalCaption) globalCaption.innerHTML = `${cur.name} (${cur.price}) — ${cur.description || ""}`;
    } else {
      const def = options.caption || "Hover to stop the belt, flick to spin it, pick a plate to order.";
      captionNode.innerHTML = `<p class="text-sm text-muted-foreground">${def}</p>`;
      if (globalCaption) globalCaption.textContent = def;
    }
  }

  function kick() {
    if (sim.raf || !sim.visible) return;
    sim.last = 0;
    sim.raf = requestAnimationFrame((now) => tick(sim, live, pointer, paintAll, hover, now));
  }

  function setActive(next) {
    if (live.active === next) return;
    live.active = next;
    active = next;
    section.setAttribute("data-active", next !== null ? String(next) : "");
    for (let i = 0; i < count; i++) {
      if (i === next) {
        plates[i].setAttribute("data-active", "true");
        plates[i].setAttribute("aria-current", "true");
        plates[i].tabIndex = 0;
      } else {
        plates[i].removeAttribute("data-active");
        plates[i].removeAttribute("aria-current");
        plates[i].tabIndex = -1;
      }
    }
    live.onActiveChange?.(next);
    kick();
  }

  function stop() {
    playing = false;
    sim.touched = true;
    if (sim.mode === SEEK) sim.mode = RUN;
    const auto = autoActive;
    if (auto !== null) {
      autoActive = null;
      if (live.active === auto) setActive(null);
    }
  }

  function seekTo(index) {
    const g = live.geo;
    if (!g) return;
    const base = g.s / 2 + index * g.pitch;
    sim.target = base + Math.round((sim.offset - base) / g.l) * g.l;
    if (live.reduced) {
      sim.offset = sim.target;
      sim.v = 0;
      sim.mode = RUN;
      paintAll();
      return;
    }
    sim.mode = SEEK;
    kick();
  }

  function focusVisible() {
    return !!stage.querySelector("[data-dish]:focus-visible");
  }

  function hover(hit) {
    const currentActive = live.active;
    if (hit === currentActive) {
      if (hit !== null && autoActive === hit) {
        autoActive = null;
        playing = false;
      }
      return;
    }
    if (hit !== null) {
      stop();
      setActive(hit);
      return;
    }
    if (currentActive !== null && currentActive !== autoActive && !focusVisible()) {
      setActive(null);
    }
  }

  function open(index) {
    stop();
    setActive(index);
    sim.v = 0;
    sim.mode = RUN;
    live.open = true;
    openIndex = index;
    section.setAttribute("data-open", String(index));
    paintBelt();
    live.onOpenChange?.(index);

    DishDialog({
      uid,
      item: items[index],
      index,
      total: count,
      labels,
      reduced,
      broken: !!failed[items[index].id],
      source: () => lifts[index]?.getBoundingClientRect() ?? null,
      onLift: (on) => {
        lifted = on ? index : null;
        paintPlate(index);
      },
      onAdd: () => live.onAdd?.(items[index]),
      onClose: () => {
        live.open = false;
        openIndex = null;
        section.setAttribute("data-open", "");
        returnFocus = index;
        plates[index]?.focus({ preventScroll: true });
        live.onOpenChange?.(null);
        kick();
      },
    });
  }

  function go(index, focus) {
    if (count === 0) return;
    const next = ((index % count) + count) % count;
    stop();
    if (focus) plates[next]?.focus({ preventScroll: true });
    setActive(next);
    seekTo(next);
  }

  function togglePause() {
    stop();
    const next = !live.paused;
    live.paused = next;
    paused = next;
    section.toggleAttribute("data-paused", next);
    const pauseBtn = controlsDiv.querySelector('[data-control="pause"]');
    if (pauseBtn) {
      pauseBtn.setAttribute("aria-pressed", String(next));
      pauseBtn.innerHTML = next
        ? '<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M5 3.4v9.2a.6.6 0 0 0 .9.5l7.4-4.6a.6.6 0 0 0 0-1L5.9 2.9a.6.6 0 0 0-.9.5Z" /></svg>'
        : '<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="4" y="3" width="2.6" height="10" rx="0.8" /><rect x="9.4" y="3" width="2.6" height="10" rx="0.8" /></svg>';
    }
    live.onPausedChange?.(next);
    if (!next && live.active !== null && !focusVisible() && !sim.inside) {
      setActive(null);
    }
    kick();
  }

  function local(event) {
    const box = stage.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  stage.addEventListener("pointerdown", (event) => {
    const g = live.geo;
    if (event.button !== 0 || !g) return;
    const at = local(event);
    const hit = hitTest(live, sim, at.x, at.y);
    pendingOpen = -1;
    pointer.id = event.pointerId;
    pointer.index = hit ?? -1;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.moved = false;
    pointer.start = sim.offset;
    pointer.lane = at.y >= g.ym ? 1 : -1;
    pointer.lastX = event.clientX;
    pointer.lastT = event.timeStamp;
    pointer.v = 0;
  });

  stage.addEventListener("pointermove", (event) => {
    const g = live.geo;
    if (!g) return;
    const at = local(event);
    if (event.pointerType === "mouse") {
      sim.px = at.x;
      sim.py = at.y;
      sim.inside = true;
    }
    if (pointer.id === event.pointerId) {
      const dx = event.clientX - pointer.x;
      const now = event.timeStamp;
      if (!pointer.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(event.clientY - pointer.y)) {
        pointer.moved = true;
        stop();
        setActive(null);
        sim.mode = DRAG;
        if (stage.isConnected && stage.setPointerCapture) {
          try {
            stage.setPointerCapture(event.pointerId);
          } catch (_) {}
        }
      }
      if (pointer.moved) {
        const v = (event.clientX - pointer.lastX) / Math.max(1, now - pointer.lastT);
        pointer.v = pointer.v * 0.6 + v * 0.4;
        pointer.lastX = event.clientX;
        pointer.lastT = now;
        const scale = pointer.lane > 0 ? 1 : 1 / g.kb;
        sim.offset = pointer.start - pointer.lane * dx * scale;
        sim.v = live.reduced ? 0 : -pointer.lane * pointer.v * 1000 * scale;
        kick();
      }
      return;
    }
    if (event.pointerType !== "mouse" || live.open) return;
    if (sim.lock) {
      if (Math.hypot(at.x - sim.lockX, at.y - sim.lockY) < 4) return;
      sim.lock = false;
    }
    hover(hitTest(live, sim, at.x, at.y));
  });

  function finishPointer(event, cancelled) {
    if (pointer.id !== event.pointerId) return;
    if (stage.releasePointerCapture && stage.hasPointerCapture?.(event.pointerId)) {
      try {
        stage.releasePointerCapture(event.pointerId);
      } catch (_) {}
    }
    pointer.id = -1;
    if (sim.mode === DRAG) {
      sim.mode = RUN;
      // Holding still before letting go bleeds the flick away (about 70 ms time constant).
      const carry = Math.exp(-Math.max(0, event.timeStamp - pointer.lastT) / 70);
      sim.v = live.reduced ? 0 : clamp(sim.v * carry, -1400, 1400);
      if (event.pointerType === "mouse") {
        const at = local(event);
        sim.lock = true;
        sim.lockX = at.x;
        sim.lockY = at.y;
      }
      kick();
      return;
    }
    if (cancelled || pointer.moved) return;
    const touch = event.pointerType !== "mouse";
    if (pointer.index < 0) {
      if (touch && live.active !== null) {
        stop();
        setActive(null);
      }
      return;
    }
    stop();
    if (touch && live.active !== pointer.index) {
      setActive(pointer.index);
    } else {
      pendingOpen = pointer.index;
    }
  }

  stage.addEventListener("pointerup", (e) => finishPointer(e, false));
  stage.addEventListener("pointercancel", (e) => finishPointer(e, true));
  stage.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    sim.inside = false;
    sim.lock = false;
    const cur = live.active;
    if (pointer.id < 0 && !live.open && cur !== null && cur !== autoActive && !focusVisible()) {
      setActive(null);
    }
  });

  stage.addEventListener("blur", (event) => {
    const next = event.relatedTarget;
    if ((next && stage.contains(next)) || live.open || sim.inside) return;
    const cur = live.active;
    if (cur !== null && cur !== autoActive) setActive(null);
  }, true);

  stage.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key) || count === 0) return;
    event.preventDefault();
    const own = event.target.closest("[data-dish]")?.getAttribute("data-dish");
    const from = own != null ? Number(own) : (active ?? center);
    go(event.key === "Home" ? 0 : event.key === "End" ? count - 1 : from + (event.key === "ArrowRight" ? 1 : -1), true);
  });

  for (let i = 0; i < count; i++) {
    plates[i].addEventListener("focus", () => {
      if (pointer.id < 0) {
        stop();
        setActive(i);
      }
    });
    plates[i].addEventListener("click", (event) => {
      const pending = pendingOpen;
      pendingOpen = -1;
      if (event.detail === 0 || pending === i) open(i);
    });
  }

  controlsDiv.querySelector('[data-control="previous"]')?.addEventListener("click", () => go((live.active ?? sim.center) - 1, false));
  controlsDiv.querySelector('[data-control="pause"]')?.addEventListener("click", togglePause);
  controlsDiv.querySelector('[data-control="next"]')?.addEventListener("click", () => go((live.active ?? sim.center) + 1, false));

  function resize() {
    const sectionWidth = Math.round(container.clientWidth || window.innerWidth);
    const stageWidth = Math.round(stage.clientWidth || sectionWidth);
    if (size.section === sectionWidth && size.stage === stageWidth) return;
    size = { section: sectionWidth, stage: stageWidth };
    geo = calculateGeo();
    live.geo = geo;
    if (!geo) return;
    if (!sim.init) {
      sim.init = true;
      sim.offset = geo.s / 2 - Math.min(live.speed * 1.62, geo.pitch * 0.45);
      sim.v = live.reduced || live.paused ? 0 : live.speed;
    } else if (sim.l > 0 && sim.l !== geo.l) {
      const f = geo.l / sim.l;
      sim.offset *= f;
      sim.target *= f;
    }
    if (live.reduced) {
      sim.v = 0;
      if (sim.mode !== DRAG) sim.mode = RUN;
      if (!sim.touched) sim.offset = geo.s / 2;
    }
    sim.l = geo.l;
    sim.z = [];
    sim.lane = [];
    syncPaths();
    paintAll();
    kick();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resizeObserver.observe(stage);

  let autoTimer = 0;
  function scheduleAutoplay() {
    if (!playing || reduced || paused || openIndex !== null || count === 0 || !geo) return;
    const show = () => {
      if (!live.geo) return;
      const last = autoLast;
      const index = last === null ? centerOf(live.geo, sim.offset + live.speed * 0.25) : (last + 1) % count;
      autoLast = index;
      autoActive = index;
      setActive(index);
      seekTo(index);
      autoTimer = window.setTimeout(() => {
        if (autoActive === index) {
          autoActive = null;
          if (live.active === index) setActive(null);
        }
        autoTimer = window.setTimeout(show, Math.max(300, interval - HOLD));
      }, HOLD);
    };
    autoTimer = window.setTimeout(show, autoLast === null ? 1600 : Math.max(300, interval - HOLD));
  }

  scheduleAutoplay();

  let inView = true;
  function updateInView() {
    const visible = inView && !document.hidden;
    if (visible === sim.visible) return;
    sim.visible = visible;
    if (visible) kick();
    else if (sim.raf) {
      cancelAnimationFrame(sim.raf);
      sim.raf = 0;
      sim.last = 0;
    }
  }

  const intersectionObserver = new IntersectionObserver((entries) => {
    inView = entries.some((e) => e.isIntersecting);
    updateInView();
  });
  intersectionObserver.observe(section);
  document.addEventListener("visibilitychange", updateInView);

  resize();

  return {
    reload: (newItems) => {
      initBelt(container, { ...options, items: newItems, dishes: newItems });
    },
    play: () => {
      playing = true;
      scheduleAutoplay();
    },
    pause: () => {
      stop();
      if (!live.paused) togglePause();
    },
    toggle: togglePause,
    setActive,
    seekTo,
    destroy: () => {
      if (sim.raf) cancelAnimationFrame(sim.raf);
      window.clearTimeout(autoTimer);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", updateInView);
      container.innerHTML = "";
    },
  };
}

export default initBelt;
