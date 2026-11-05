export const SPACING = 1.35;
export const CURVE = 0.95;
export const BAND = 1.22;
export const TILT = 0.8;
export const SLAT = 0.34;
export const LIFT_Y = -6;
export const LIFT_SCALE = 0.08;
export const BACK_SHADE = 0.15;
export const CHIP_ROOM = 34;
export const WIDE = 1024;
export const HOLD = 1400;

const RUN = 0;
const SEEK = 1;
const DRAG = 2;

function makeSim() {
  return { offset: 0, v: 0, mode: RUN, target: 0, lift: [], vlift: [], z: [], lane: [], raf: 0, last: 0, visible: true, init: false, touched: false, l: 0, center: -1, published: "", px: 0, py: 0, inside: false, lock: false, lockX: 0, lockY: 0 };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// u is arc length on the belt, the front lane runs right to left and the back lane left to right.
export function along(g, u) {
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

// The back lane shrinks to kb and the depth axis is foreshortened by TILT.
export function project(g, x, z) {
  const k = g.a + g.b * z;
  return { x: g.cx + x * k, y: g.ym + TILT * (g.a * z + (g.b * z * z) / 2), k };
}

export function makeGeo(width, n, d, kb) {
  const l = Math.max(1, n) * SPACING * d;
  const r = Math.min(CURVE * d, l / (2 * Math.PI));
  const s = Math.max(0, (l - 2 * Math.PI * r) / 2);
  const g = { width, height: 0, d, r, s, l, pitch: l / Math.max(1, n), n: Math.max(1, n), kb, cx: width / 2, ym: 0, a: (1 + kb) / 2, b: (1 - kb) / (2 * r), band: BAND * d, slats: Math.max(10, Math.round(l / (SLAT * d))), side: Math.max(3, d * 0.07), edgeTop: 0 };
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

export function halfSpan(g) {
  let span = 0;
  for (let j = 0; j < 120; j++) {
    const p = along(g, (j / 120) * g.l);
    const rim = project(g, p.x + (p.nx * g.band) / 2, p.z + (p.nz * g.band) / 2);
    const plate = project(g, p.x, p.z);
    span = Math.max(span, Math.abs(rim.x - g.cx) + 3, Math.abs(plate.x - g.cx) + (plate.k * g.d * (1 + LIFT_SCALE)) / 2);
  }
  return span;
}

export function edgePath(g, offset) {
  let d = "";
  const steps = 168;
  for (let j = 0; j < steps; j++) {
    const p = along(g, (j / steps) * g.l);
    const q = project(g, p.x + p.nx * offset, p.z + p.nz * offset);
    d += `${j ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  }
  return `${d}Z`;
}

// Crescent slat seams across the belt, redrawn every frame so they travel with the plates (and round the curves).
export function slatPath(g, offset, shift) {
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

export function pose(g, offset, i) {
  const p = along(g, offset - i * g.pitch);
  const q = project(g, p.x, p.z);
  return { x: q.x, y: q.y, k: q.k, depth: (p.z + g.r) / (2 * g.r) };
}

export function centerOf(g, offset) {
  return ((Math.round((offset - g.s / 2) / g.pitch) % g.n) + g.n) % g.n;
}

export function legendEntries(items, legend) {
  const out = [];
  for (let tier = 1; tier <= 5; tier++) {
    const label = legend ? legend[tier] : items.find((item) => (item.tier ?? 1) === tier)?.price;
    if (label) out.push({ tier, label });
  }
  return out;
}

let serial = 0;
let activeBelt = null;

function setOptionalAttr(el, name, on) {
  if (on) el.setAttribute(name, "");
  else el.removeAttribute(name);
}

export function initBelt(container, options = {}) {
  if (activeBelt) activeBelt.destroy();
  const { items = [], legend, autoplay = false, speed = 26, interval = 3000, onAdd } = options;

  if (!container || typeof container.appendChild !== "function") {
    console.warn("belt: container element is required");
    return { open() {}, destroy() {} };
  }
  if (items.length === 0) {
    return { open() {}, destroy() {} };
  }

  const count = items.length;
  const uid = `chef-belt-${++serial}`;
  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sim = makeSim();
  const pointer = { id: -1, index: -1, x: 0, y: 0, moved: false, start: 0, lane: 1, lastX: 0, lastT: 0, v: 0 };
  let pendingOpen = -1;
  let returnFocus = null;
  let autoActive = null;
  let autoLast = null;
  let autoTimer = 0;
  let active = null;
  let openIndex = null;
  let lifted = null;
  let paused = false;
  let playing = autoplay;
  let destroyed = false;
  let cleanupDialog = null;

  let size = { section: 0, stage: 0 };
  let geo = null;
  const failed = {};

  const ICON_PAUSE = '<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="4" y="3" width="2.6" height="10" rx="0.8" /><rect x="9.4" y="3" width="2.6" height="10" rx="0.8" /></svg>';
  const ICON_PLAY = '<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M5 3.4v9.2a.6.6 0 0 0 .9.5l7.4-4.6a.6.6 0 0 0 0-1L5.9 2.9a.6.6 0 0 0-.9.5Z" /></svg>';

  // --- DOM ------------------------------------------------------------

  const stage = document.createElement("div");
  stage.className = "belt-stage";
  stage.dataset.stage = "";
  stage.setAttribute("role", "group");
  stage.setAttribute("aria-label", "Food conveyor belt");
  stage.setAttribute("aria-roledescription", "conveyor belt");
  stage.style.height = "260px";
  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", (event) => finishPointer(event, false));
  stage.addEventListener("pointercancel", (event) => finishPointer(event, true));
  stage.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    sim.inside = false;
    sim.lock = false;
    if (pointer.id >= 0 || openIndex !== null || active === null || active === autoActive || focusVisible()) return;
    setActive(null);
  });
  stage.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if ((next && stage.contains(next)) || openIndex !== null || sim.inside) return;
    if (active !== null && active !== autoActive) setActive(null);
  });
  stage.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const own = event.target.closest?.("[data-dish]")?.getAttribute("data-dish");
    const from = own != null ? Number(own) : (active ?? Math.max(0, sim.center));
    go(event.key === "Home" ? 0 : event.key === "End" ? count - 1 : from + (event.key === "ArrowRight" ? 1 : -1), true);
  });

  const counter = document.createElement("div");
  counter.className = "belt-counter";
  counter.setAttribute("aria-hidden", "true");
  stage.appendChild(counter);

  const beltLayer = document.createElement("div");
  beltLayer.className = "belt-track";
  beltLayer.dataset.belt = "";
  beltLayer.setAttribute("aria-hidden", "true");
  stage.appendChild(beltLayer);

  const plates = [];
  const liftEls = [];
  const shadeEls = [];
  const shadowEls = [];
  const anchorEls = [];

  items.forEach((item, i) => {
    const tier = clamp(Math.round(item.tier ?? 1), 1, 5);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "belt-plate";
    button.dataset.dish = String(i);
    setOptionalAttr(button, "data-active", active === i);
    button.setAttribute("aria-label", `${item.name}, ${item.price}`);
    button.setAttribute("aria-describedby", `${uid}-caption`);
    button.setAttribute("aria-haspopup", "dialog");
    button.tabIndex = i === 0 ? 0 : -1;

    const shadowWrap = document.createElement("span");
    shadowWrap.className = "belt-plate-shadow";
    shadowWrap.setAttribute("aria-hidden", "true");
    const shadowBlur = document.createElement("span");
    shadowBlur.className = "belt-plate-shadow-blur";
    shadowWrap.appendChild(shadowBlur);
    button.appendChild(shadowWrap);

    const lift = document.createElement("span");
    lift.className = "belt-plate-lift";
    lift.dataset.lift = "";

    const placeholder = document.createElement("span");
    placeholder.className = "belt-plate-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    const placeholderInner = document.createElement("span");
    placeholderInner.className = "belt-plate-placeholder-inner";
    placeholder.appendChild(placeholderInner);
    lift.appendChild(placeholder);

    const shade = document.createElement("span");
    shade.className = "belt-plate-shade";
    shade.setAttribute("aria-hidden", "true");
    shade.style.opacity = "0";

    const img = document.createElement("img");
    img.src = item.image;
    img.alt = "";
    img.draggable = false;
    img.className = "belt-plate-img";
    img.addEventListener("error", () => {
      if (failed[item.id]) return;
      failed[item.id] = true;
      placeholder.classList.add("broken");
      img.remove();
      shade.remove();
    });

    const ring = document.createElement("span");
    ring.className = `belt-ring belt-ring-${tier}`;
    ring.setAttribute("aria-hidden", "true");

    const anchor = document.createElement("span");
    anchor.className = "belt-anchor";
    anchor.setAttribute("aria-hidden", "true");
    const chip = document.createElement("span");
    chip.className = "belt-chip";
    chip.dataset.chip = "";
    const dot = document.createElement("span");
    dot.className = `belt-dot-${tier}`;
    const chipName = document.createElement("span");
    chipName.textContent = item.name;
    const chipPrice = document.createElement("span");
    chipPrice.className = "belt-chip-price";
    chipPrice.textContent = item.price;
    chip.appendChild(dot);
    chip.appendChild(chipName);
    chip.appendChild(chipPrice);
    anchor.appendChild(chip);

    lift.appendChild(img);
    lift.appendChild(shade);
    lift.appendChild(ring);
    lift.appendChild(anchor);
    button.appendChild(lift);

    button.addEventListener("focus", () => {
      if (pointer.id < 0) { stop(); setActive(i); }
    });
    button.addEventListener("click", (event) => {
      const pending = pendingOpen;
      pendingOpen = -1;
      if (event.detail === 0 || pending === i) open(i);
    });

    stage.appendChild(button);
    plates.push(button);
    liftEls.push(lift);
    shadeEls.push(shade);
    shadowEls.push(shadowBlur);
    anchorEls.push(anchor);
  });

  let pauseBtn = null;
  let controlsEl = null;
  if (count > 1) {
    const controls = document.createElement("div");
    controls.className = "belt-controls";
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "belt-control";
    prevBtn.dataset.control = "previous";
    prevBtn.setAttribute("aria-label", "Previous plate");
    prevBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>';
    prevBtn.addEventListener("click", () => go((active ?? Math.max(0, sim.center)) - 1, false));
    pauseBtn = document.createElement("button");
    pauseBtn.type = "button";
    pauseBtn.className = "belt-control";
    pauseBtn.dataset.control = "pause";
    pauseBtn.setAttribute("aria-label", "Pause belt");
    pauseBtn.setAttribute("aria-pressed", "false");
    pauseBtn.innerHTML = ICON_PAUSE;
    pauseBtn.addEventListener("click", togglePause);
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "belt-control";
    nextBtn.dataset.control = "next";
    nextBtn.setAttribute("aria-label", "Next plate");
    nextBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5" /></svg>';
    nextBtn.addEventListener("click", () => go((active ?? Math.max(0, sim.center)) + 1, false));
    controls.appendChild(prevBtn);
    controls.appendChild(pauseBtn);
    controls.appendChild(nextBtn);
    controlsEl = controls;
  }

  const caption = document.createElement("div");
  caption.className = "belt-caption";
  caption.id = `${uid}-caption`;
  caption.dataset.caption = "";
  caption.setAttribute("aria-live", "polite");
  const captionTitle = document.createElement("p");
  captionTitle.className = "belt-caption-title";
  const captionDesc = document.createElement("p");
  captionDesc.className = "belt-caption-desc";
  caption.appendChild(captionTitle);

  container.appendChild(stage);
  if (controlsEl) container.appendChild(controlsEl);
  container.appendChild(caption);

  // --- geometry -------------------------------------------------------

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "belt-svg-track");
  beltLayer.appendChild(svg);
  let seam = null;
  let glint = null;

  function recompute() {
    const section = Math.round(container.clientWidth);
    const stageWidth = Math.round(stage.clientWidth);
    if (size.section === section && size.stage === stageWidth) return false;
    size = { section, stage: stageWidth };
    if (!stageWidth || count === 0) { geo = null; return true; }
    const wide = section >= WIDE;
    const kb = section > 0 && section < 480 ? 0.6 : 0.68;
    const span = halfSpan(makeGeo(1000, count, 100, kb)) / 100;
    const cap = wide ? 150 : clamp(section * 0.143, 96, 150);
    const fit = (stageWidth - 8) / (2 * span);
    geo = makeGeo(stageWidth, count, Math.round(clamp(fit, Math.min(96, cap), cap)), kb);
    return true;
  }

  function buildBelt() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!geo) return;
    const g = geo;
    svg.setAttribute("width", String(g.width));
    svg.setAttribute("height", String(g.height));
    svg.setAttribute("viewBox", `0 0 ${g.width} ${g.height}`);

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const blur = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    blur.setAttribute("id", `${uid}-soft`);
    blur.setAttribute("x", "-10%");
    blur.setAttribute("y", "-30%");
    blur.setAttribute("width", "120%");
    blur.setAttribute("height", "160%");
    const gaussian = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
    gaussian.setAttribute("stdDeviation", (g.d * 0.06).toFixed(1));
    blur.appendChild(gaussian);
    const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    gradient.setAttribute("id", `${uid}-island`);
    gradient.setAttribute("x1", "0");
    gradient.setAttribute("x2", "0");
    gradient.setAttribute("y1", "0");
    gradient.setAttribute("y2", "1");
    const stopTop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stopTop.setAttribute("offset", "0");
    stopTop.style.stopColor = "var(--island)";
    const stopLow = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stopLow.setAttribute("offset", "1");
    stopLow.style.stopColor = "var(--island-low)";
    gradient.appendChild(stopTop);
    gradient.appendChild(stopLow);
    defs.appendChild(blur);
    defs.appendChild(gradient);
    svg.appendChild(defs);

    const paths = {
      outer: edgePath(g, g.band / 2),
      inner: edgePath(g, -g.band / 2),
      island: edgePath(g, -g.band / 2 - g.d * 0.035),
    };

    const add = (attrs, transform) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      for (const [key, value] of Object.entries(attrs)) path.setAttribute(key, value);
      if (transform) path.setAttribute("transform", transform);
      svg.appendChild(path);
      return path;
    };

    seam = add({ d: "", fill: "none", stroke: "black", "stroke-opacity": "0.42", "stroke-width": Math.max(1, g.d * 0.013), "stroke-linecap": "round" });
    glint = add({ d: "", fill: "none", stroke: "white", "stroke-opacity": "0.14", "stroke-width": Math.max(0.8, g.d * 0.009), "stroke-linecap": "round" });
    svg.insertBefore(seam, svg.children[1]);
    svg.insertBefore(glint, svg.children[2]);

    const shadowPath = add({ d: paths.outer, fill: "black", filter: `url(#${uid}-soft)` }, `translate(0 ${(g.side + g.d * 0.07).toFixed(1)})`);
    shadowPath.classList.add("belt-track-shadow");
    add({ d: `${paths.outer}${paths.inner}`, "fill-rule": "evenodd" }, `translate(0 ${g.side.toFixed(1)})`).style.fill = "var(--belt-side)";
    add({ d: `${paths.outer}${paths.inner}`, "fill-rule": "evenodd" }).style.fill = "var(--belt)";
    add({ d: paths.outer, fill: "none" }, null).style.stroke = "var(--rail)";
    svg.lastChild.setAttribute("stroke-width", String(Math.max(2, g.d * 0.026)));
    add({ d: paths.outer, fill: "none", stroke: "white", "stroke-opacity": "0.55", "stroke-width": Math.max(0.8, g.d * 0.008) }, "translate(0 -0.8)");
    const railInner = add({ d: paths.inner, fill: "none" }, null);
    railInner.style.stroke = "var(--rail)";
    railInner.setAttribute("stroke-width", String(Math.max(1.6, g.d * 0.02)));
    add({ d: paths.inner, fill: "none", stroke: "white", "stroke-opacity": "0.4", "stroke-width": Math.max(0.8, g.d * 0.008) }, "translate(0 -0.7)");
    add({ d: paths.island }).style.fill = "var(--island-wall)";
    add({ d: paths.island }, `translate(0 ${(-g.side * 0.6).toFixed(1)})`).style.fill = `url(#${uid}-island)`;
    add({ d: paths.island, fill: "none", stroke: "white", "stroke-opacity": "0.55", "stroke-width": Math.max(0.8, g.d * 0.008) }, `translate(0 ${(-g.side * 0.6 - 0.6).toFixed(1)})`);
  }

  function resizePlates() {
    if (!geo) { stage.style.height = "260px"; return; }
    const g = geo;
    stage.style.height = `${g.height}px`;
    plates.forEach((button, i) => {
      button.style.width = `${g.d}px`;
      button.style.height = `${g.d * TILT}px`;
      shadowEls[i].style.filter = `blur(${Math.max(2, g.d * 0.045).toFixed(1)}px)`;
    });
    const top = Math.max(0, g.edgeTop - g.d * 0.34);
    counter.style.top = `${top}px`;
    counter.style.height = `${g.ym - top}px`;
    plates.forEach((button, i) => {
      const mask = `url("${items[i].image}") 0 0 / 100% 100% no-repeat`;
      shadeEls[i].style.webkitMask = mask;
      shadeEls[i].style.mask = mask;
      setOptionalAttr(button, "data-active", active === i);
    });
  }

  // --- painting -------------------------------------------------------

  function paintPlate(i) {
    const g = geo;
    const button = plates[i];
    if (!g || !button) return;
    const q = pose(g, sim.offset, i);
    const e = sim.lift[i] ?? 0;
    button.style.transform = `translate3d(${(q.x - g.d / 2).toFixed(2)}px,${(q.y - (g.d * TILT) / 2).toFixed(2)}px,0) scale(${q.k.toFixed(4)})`;
    const z = i === active ? 2000 : 100 + Math.round(q.y);
    if (sim.z[i] !== z) { sim.z[i] = z; button.style.zIndex = String(z); }
    const lane = q.depth >= 0.5 ? "front" : "back";
    if (sim.lane[i] !== lane) { sim.lane[i] = lane; button.dataset.lane = lane; }
    button.style.visibility = lifted === i ? "hidden" : "";
    const lift = liftEls[i];
    if (lift) lift.style.transform = `translateY(${(LIFT_Y * e).toFixed(3)}%) scale(${(1 + LIFT_SCALE * e).toFixed(4)})`;
    const shade = shadeEls[i];
    if (shade) shade.style.opacity = (BACK_SHADE * clamp(1 - q.depth, 0, 1) * (1 - 0.7 * clamp(e, 0, 1))).toFixed(3);
    const shadow = shadowEls[i];
    if (shadow) {
      shadow.style.transform = `translate3d(0,${(g.d * TILT * 0.05 * e).toFixed(2)}px,0) scale(${(1 + 0.14 * e).toFixed(3)})`;
      shadow.style.opacity = (1 - 0.5 * clamp(e, 0, 1)).toFixed(3);
    }
    const anchor = anchorEls[i];
    if (anchor) anchor.style.transform = `scale(${(1 / (q.k * (1 + LIFT_SCALE * e))).toFixed(4)})`;
    const chip = anchor?.firstChild;
    if (chip) chip.classList.toggle("active", i === active && lifted !== i);
  }

  function paintBelt() {
    const g = geo;
    if (!g) return;
    if (seam) seam.setAttribute("d", slatPath(g, sim.offset, 0));
    if (glint) glint.setAttribute("d", slatPath(g, sim.offset, -Math.max(1.4, g.d * 0.024)));
    const v = (Math.abs(sim.v) < 0.005 ? 0 : sim.v).toFixed(2);
    if (v !== sim.published) { sim.published = v; beltLayer.style.setProperty("--belt-v", v); }
    const c = centerOf(g, sim.offset);
    if (c !== sim.center) {
      sim.center = c;
      syncRoving();
      container.dataset.center = String(c);
    }
  }

  function paintAll() {
    for (let i = 0; i < count; i++) paintPlate(i);
    paintBelt();
  }

  function hitTest(px, py) {
    const g = geo;
    if (!g) return null;
    let best = null;
    let bestY = -Infinity;
    for (let i = 0; i < count; i++) {
      const q = pose(g, sim.offset, i);
      const e = clamp(sim.lift[i] ?? 0, 0, 1.2);
      const grow = (1 + LIFT_SCALE * e) * (i === active ? 1.1 : 1);
      const rx = (g.d * q.k * grow) / 2;
      const ry = (g.d * TILT * q.k * grow) / 2;
      const dx = (px - q.x) / rx;
      const dy = (py - (q.y + (LIFT_Y / 100) * g.d * TILT * q.k * e)) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (i === active) return i;
      if (q.y > bestY) { best = i; bestY = q.y; }
    }
    return best;
  }

  function focusVisible() {
    return !!stage.querySelector("[data-dish]:focus-visible");
  }

  function syncRoving() {
    const roving = active ?? Math.max(0, sim.center);
    plates.forEach((button, i) => {
      button.tabIndex = i === roving ? 0 : -1;
      setOptionalAttr(button, "data-active", i === active);
    });
  }

  function updateCaption() {
    const current = active === null ? null : items[active] ?? null;
    while (captionTitle.firstChild) captionTitle.removeChild(captionTitle.firstChild);
    if (captionDesc.parentNode) captionDesc.remove();
    if (current) {
      captionTitle.textContent = current.name;
      const price = document.createElement("span");
      price.className = "belt-caption-price";
      price.textContent = ` \u00B7 ${current.price}`;
      captionTitle.appendChild(price);
      caption.appendChild(captionDesc);
      captionDesc.textContent = current.description ?? "";
    } else if (paused) {
      captionTitle.textContent = "Belt paused";
    }
  }

  function refreshUI() {
    updateCaption();
    syncRoving();
    container.dataset.active = active ?? "";
    container.dataset.open = openIndex ?? "";
    setOptionalAttr(container, "data-paused", paused);
  }

  // --- motion ---------------------------------------------------------

  function tick(now) {
    sim.raf = 0;
    if (!geo || !sim.visible) { sim.last = 0; return; }
    const dt = sim.last ? clamp((now - sim.last) / 1000, 0, 0.25) : 1 / 60;
    sim.last = now;
    // Sub steps keep the springs stable and the belt on real time when frames arrive late.
    const steps = Math.max(1, Math.ceil(dt / 0.017));
    const h = dt / steps;
    const stopped = paused || active !== null || openIndex !== null;
    const cruise = reducedQuery.matches ? 0 : Math.max(0, speed);
    for (let step = 0; step < steps; step++) {
      if (sim.mode === SEEK) {
        const w = 5.6;
        sim.v += (w * w * (sim.target - sim.offset) - 2 * w * sim.v) * h;
        sim.offset += sim.v * h;
        if (Math.abs(sim.target - sim.offset) < 0.3 && Math.abs(sim.v) < 4) { sim.offset = sim.target; sim.v = 0; sim.mode = RUN; }
      } else if (sim.mode === RUN) {
        if (stopped) {
          sim.v *= Math.exp(-7.2 * h);
          if (Math.abs(sim.v) < 0.02) sim.v = 0;
        } else {
          let e = sim.v - cruise;
          if (Math.abs(e) > Math.max(6, cruise * 0.5)) e = Math.sign(e) * Math.max(0, Math.abs(e) * Math.exp(-2.4 * h) - 90 * h);
          else e *= Math.exp(-3.4 * h);
          sim.v = cruise + (Math.abs(e) < 0.01 ? 0 : e);
        }
        sim.offset += sim.v * h;
      }
      for (let i = 0; i < count; i++) {
        const goal = i === active ? 1 : 0;
        if (reducedQuery.matches) { sim.lift[i] = goal; sim.vlift[i] = 0; continue; }
        const x = sim.lift[i] ?? 0;
        const v = (sim.vlift[i] ?? 0) + (330 * (goal - x) - 23 * (sim.vlift[i] ?? 0)) * h;
        sim.lift[i] = x + v * h;
        sim.vlift[i] = v;
      }
    }
    let busy = sim.mode !== RUN || sim.v !== 0 || (!stopped && cruise > 0);
    for (let i = 0; i < count; i++) {
      const goal = i === active ? 1 : 0;
      if (Math.abs(goal - (sim.lift[i] ?? 0)) < 0.002 && Math.abs(sim.vlift[i] ?? 0) < 0.02) { sim.lift[i] = goal; sim.vlift[i] = 0; }
      else busy = true;
    }
    if (sim.inside && !sim.lock && sim.mode === RUN && openIndex === null && pointer.id < 0 && Math.abs(sim.v) > 0.3) {
      const hit = hitTest(sim.px, sim.py);
      if (hit !== null && hit !== active) hover(hit);
    }
    paintAll();
    if (busy) sim.raf = requestAnimationFrame(tick);
    else sim.last = 0;
  }

  function kick() {
    if (sim.raf || !sim.visible) return;
    sim.last = 0;
    sim.raf = requestAnimationFrame(tick);
  }

  function setActive(next) {
    if (active === next) return;
    active = next;
    refreshUI();
    kick();
  }

  function stop() {
    playing = false;
    clearTimeout(autoTimer);
    sim.touched = true;
    if (sim.mode === SEEK) sim.mode = RUN;
    const auto = autoActive;
    if (auto !== null) {
      autoActive = null;
      if (active === auto) setActive(null);
    }
  }

  function seekTo(index) {
    const g = geo;
    if (!g) return;
    const base = g.s / 2 + index * g.pitch;
    sim.target = base + Math.round((sim.offset - base) / g.l) * g.l;
    if (reducedQuery.matches) { sim.offset = sim.target; sim.v = 0; sim.mode = RUN; paintAll(); return; }
    sim.mode = SEEK;
    kick();
  }

  function go(index, focus) {
    const next = ((index % count) + count) % count;
    stop();
    if (focus) plates[next]?.focus({ preventScroll: true });
    setActive(next);
    seekTo(next);
  }

  function togglePause() {
    stop();
    paused = !paused;
    if (pauseBtn) {
      pauseBtn.setAttribute("aria-pressed", String(paused));
      pauseBtn.innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
    }
    if (!paused && active !== null && !focusVisible() && !sim.inside) setActive(null);
    refreshUI();
    scheduleAutoplay();
    kick();
  }

  function hover(hit) {
    const current = active;
    if (hit === current) {
      // The visitor takes over the plate autoplay lifted: autoplay stops and the plate stays up.
      if (hit !== null && autoActive === hit) { autoActive = null; playing = false; clearTimeout(autoTimer); }
      return;
    }
    if (hit !== null) { stop(); setActive(hit); return; }
    if (current !== null && current !== autoActive && !focusVisible()) setActive(null);
  }

  // Reduced motion resets the offset whenever geometry changes, because nothing cruises.
  function applyGeo() {
    if (!geo) return;
    if (!sim.init) {
      sim.init = true;
      sim.offset = geo.s / 2 - Math.min(Math.max(0, speed) * 1.62, geo.pitch * 0.45);
      sim.v = reducedQuery.matches || paused ? 0 : speed;
    } else if (sim.l > 0 && sim.l !== geo.l) {
      const f = geo.l / sim.l;
      sim.offset *= f;
      sim.target *= f;
    }
    if (reducedQuery.matches) {
      sim.v = 0;
      if (sim.mode !== DRAG) sim.mode = RUN;
      if (!sim.touched) sim.offset = geo.s / 2;
    }
    sim.l = geo.l;
    sim.z = [];
    sim.lane = [];
    paintAll();
    kick();
  }

  function scheduleAutoplay() {
    clearTimeout(autoTimer);
    if (!playing || reducedQuery.matches || paused || openIndex !== null || count === 0 || !geo) return;
    const show = () => {
      const g = geo;
      if (!g) return;
      const index = autoLast === null ? centerOf(g, sim.offset + Math.max(0, speed) * 0.25) : (autoLast + 1) % count;
      autoLast = index;
      autoActive = index;
      setActive(index);
      seekTo(index);
      autoTimer = setTimeout(() => {
        if (autoActive === index) {
          autoActive = null;
          if (active === index) setActive(null);
        }
        autoTimer = setTimeout(show, Math.max(300, interval - HOLD));
      }, HOLD);
    };
    autoTimer = setTimeout(show, autoLast === null ? 1600 : Math.max(300, interval - HOLD));
  }

  // --- pointer handling -----------------------------------------------

  function onPointerDown(event) {
    const g = geo;
    if (event.button !== 0 || !g) return;
    const box = stage.getBoundingClientRect();
    const at = { x: event.clientX - box.left, y: event.clientY - box.top };
    const hit = hitTest(at.x, at.y);
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
  }

  function onPointerMove(event) {
    const g = geo;
    if (!g) return;
    const box = stage.getBoundingClientRect();
    const at = { x: event.clientX - box.left, y: event.clientY - box.top };
    if (event.pointerType === "mouse") { sim.px = at.x; sim.py = at.y; sim.inside = true; }
    if (pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const now = event.timeStamp;
    if (!pointer.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(event.clientY - pointer.y)) {
      pointer.moved = true;
      stop();
      setActive(null);
      sim.mode = DRAG;
      if (stage.isConnected) stage.setPointerCapture(event.pointerId);
    }
    if (pointer.moved) {
      const v = (event.clientX - pointer.lastX) / Math.max(1, now - pointer.lastT);
      pointer.v = pointer.v * 0.6 + v * 0.4;
      pointer.lastX = event.clientX;
      pointer.lastT = now;
      const scale = pointer.lane > 0 ? 1 : 1 / g.kb;
      sim.offset = pointer.start - pointer.lane * dx * scale;
      sim.v = reducedQuery.matches ? 0 : -pointer.lane * pointer.v * 1000 * scale;
      kick();
    }
  }

  function finishPointer(event, cancelled) {
    if (pointer.id !== event.pointerId) return;
    pointer.id = -1;
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    if (sim.mode === DRAG) {
      sim.mode = RUN;
      // Holding still before letting go bleeds the flick away (about 70 ms time constant).
      const carry = Math.exp(-Math.max(0, event.timeStamp - pointer.lastT) / 70);
      sim.v = reducedQuery.matches ? 0 : clamp(sim.v * carry, -1400, 1400);
      if (event.pointerType === "mouse") {
        const box = stage.getBoundingClientRect();
        sim.lock = true;
        sim.lockX = event.clientX - box.left;
        sim.lockY = event.clientY - box.top;
      }
      kick();
      return;
    }
    if (cancelled || pointer.moved) return;
    const touch = event.pointerType !== "mouse";
    if (pointer.index < 0) {
      if (touch && active !== null) { stop(); setActive(null); }
      return;
    }
    stop();
    if (touch && active !== pointer.index) setActive(pointer.index);
    else pendingOpen = pointer.index;
  }

  // --- observers ------------------------------------------------------

  const reducedListener = () => {
    if (reducedQuery.matches) {
      for (let i = 0; i < count; i++) { sim.lift[i] = 0; sim.vlift[i] = 0; }
    }
    scheduleAutoplay();
    kick();
  };
  reducedQuery.addEventListener("change", reducedListener);

  const resizeObserver = new ResizeObserver(() => {
    if (!recompute()) return;
    buildBelt();
    resizePlates();
    applyGeo();
  });
  resizeObserver.observe(container);
  resizeObserver.observe(stage);

  let inView = true;
  const visibilityUpdate = () => {
    const visible = inView && !document.hidden;
    if (visible === sim.visible) return;
    sim.visible = visible;
    if (visible) kick();
    else if (sim.raf) { cancelAnimationFrame(sim.raf); sim.raf = 0; sim.last = 0; }
  };
  const intersectionObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting);
    visibilityUpdate();
  }) : null;
  if (intersectionObserver) intersectionObserver.observe(container);
  document.addEventListener("visibilitychange", visibilityUpdate);
  visibilityUpdate();

  // --- dialog ---------------------------------------------------------

  function open(index) {
    if (openIndex !== null) return;
    stop();
    setActive(index);
    sim.v = 0;
    sim.mode = RUN;
    openIndex = index;
    refreshUI();
    buildDialog(index);
  }

  function buildDialog(index) {
    const item = items[index];
    const tier = clamp(Math.round(item.tier ?? 1), 1, 5);
    const from = liftEls[index]?.getBoundingClientRect() ?? null;
    lifted = index;
    paintPlate(index);

    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", `${uid}-dish-title`);
    overlay.dataset.dishDialog = "";

    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    overlay.appendChild(backdrop);

    const card = document.createElement("div");
    card.className = "dialog-card";
    const cardBg = document.createElement("div");
    cardBg.className = "dialog-card-bg";
    cardBg.setAttribute("aria-hidden", "true");
    card.appendChild(cardBg);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "dialog-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>';
    card.appendChild(closeBtn);

    const figure = document.createElement("div");
    figure.className = "dialog-figure";
    figure.dataset.dishFigure = "";
    const figureShadow = document.createElement("span");
    figureShadow.className = "dialog-figure-shadow";
    figureShadow.setAttribute("aria-hidden", "true");
    figure.appendChild(figureShadow);
    if (failed[item.id]) {
      const placeholder = document.createElement("span");
      placeholder.className = "dialog-figure-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      const inner = document.createElement("span");
      inner.className = "dialog-figure-placeholder-inner";
      placeholder.appendChild(inner);
      figure.appendChild(placeholder);
    } else {
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = item.name;
      img.draggable = false;
      img.className = "dialog-figure-img";
      figure.appendChild(img);
    }
    const figureRing = document.createElement("span");
    figureRing.className = `dialog-figure-ring dialog-ring-${tier}`;
    figureRing.setAttribute("aria-hidden", "true");
    figure.appendChild(figureRing);
    card.appendChild(figure);

    const body = document.createElement("div");
    body.className = "dialog-body";
    const counterLine = document.createElement("p");
    counterLine.className = "dialog-counter";
    const counterDot = document.createElement("span");
    counterDot.className = `dialog-dot dialog-dot-${tier}`;
    counterDot.setAttribute("aria-hidden", "true");
    counterLine.appendChild(counterDot);
    counterLine.appendChild(document.createTextNode(` ${pad(index + 1)} / ${pad(count)}`));
    const title = document.createElement("h3");
    title.id = `${uid}-dish-title`;
    title.className = "dialog-title";
    title.textContent = item.name;
    body.appendChild(counterLine);
    body.appendChild(title);
    if (item.description) {
      const desc = document.createElement("p");
      desc.className = "dialog-desc";
      desc.textContent = item.description;
      body.appendChild(desc);
    }
    if (item.details?.length) {
      const chips = document.createElement("ul");
      chips.className = "dialog-chips";
      item.details.forEach((detail) => {
        const chip = document.createElement("li");
        chip.className = "dialog-chip";
        chip.textContent = detail;
        chips.appendChild(chip);
      });
      body.appendChild(chips);
    }
    const actions = document.createElement("div");
    actions.className = "dialog-actions";
    const price = document.createElement("p");
    price.className = "dialog-price";
    price.textContent = item.price;
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "dialog-add-btn";
    addBtn.dataset.add = "";
    addBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9" /></svg>';
    addBtn.appendChild(document.createTextNode(" Add to order"));
    actions.appendChild(price);
    actions.appendChild(addBtn);
    body.appendChild(actions);
    card.appendChild(body);
    overlay.appendChild(card);

    document.body.appendChild(overlay);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.focus({ preventScroll: true });

    let closing = false;
    let added = false;
    let addTimer = 0;
    let flight = null;
    let shownFrame = 0;

    shownFrame = requestAnimationFrame(() => {
      overlay.classList.add("dialog-shown");
      if (reducedQuery.matches || !figure || !from || from.width === 0) return;
      const to = figure.getBoundingClientRect();
      const sx = from.width / to.width;
      const sy = from.height / to.height;
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      const rise = Math.min(120, Math.abs(dy) * 0.3 + 40);
      flight = figure.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transform: `translate(${dx * 0.42}px, ${dy * 0.42 - rise}px) scale(${((sx + 1) / 2) * 1.05}, ${((sy + 1) / 2) * 1.05}) rotate(${dx > 0 ? -6 : 6}deg)`, offset: 0.5 },
        { transform: "none" },
      ], { duration: 680, easing: "cubic-bezier(.22,.85,.3,1)" });
    });

    function finish() {
      cancelAnimationFrame(shownFrame);
      flight?.cancel();
      clearTimeout(addTimer);
      document.removeEventListener("keydown", onDocumentKey);
      overlay.remove();
      if (document.body.style.overflow === "hidden") document.body.style.overflow = overflow;
      cleanupDialog = null;
      openIndex = null;
      lifted = null;
      refreshUI();
      scheduleAutoplay();
      kick();
      if (returnFocus !== null) {
        const back = returnFocus;
        returnFocus = null;
        plates[back]?.focus({ preventScroll: true });
      }
    }

    function dismiss() {
      if (closing) return;
      closing = true;
      overlay.classList.remove("dialog-shown");
      returnFocus = index;
      const to = liftEls[index]?.getBoundingClientRect() ?? null;
      if (!figure || !to || reducedQuery.matches || to.width === 0) { finish(); return; }
      const box = figure.getBoundingClientRect();
      const sx = to.width / box.width;
      const sy = to.height / box.height;
      const dx = to.left + to.width / 2 - (box.left + box.width / 2);
      const dy = to.top + to.height / 2 - (box.top + box.height / 2);
      const reverse = figure.animate([
        { transform: "none" },
        { transform: `translate(${dx * 0.58}px, ${dy * 0.58 - 36}px) scale(${(sx + 1) / 2}, ${(sy + 1) / 2})`, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      ], { duration: 540, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" });
      reverse.onfinish = () => finish();
    }

    function onDocumentKey(event) {
      if (overlay.contains(event.target)) return;
      if (event.key === "Escape") { event.preventDefault(); dismiss(); }
      else if (event.key === "Tab") {
        const first = overlay.querySelector("button");
        if (first) { event.preventDefault(); first.focus(); }
      }
    }

    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss(); return; }
      if (event.key !== "Tab") return;
      const buttons = [...overlay.querySelectorAll("button")].filter((node) => !node.disabled);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    closeBtn.addEventListener("click", dismiss);
    backdrop.addEventListener("click", dismiss);
    document.addEventListener("keydown", onDocumentKey);

    addBtn.addEventListener("click", () => {
      if (added || closing) return;
      added = true;
      onAdd?.(item);
      addBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>';
      addBtn.appendChild(document.createTextNode(" Add to order"));
      addTimer = setTimeout(dismiss, reducedQuery.matches ? 0 : 450);
    });

    cleanupDialog = () => finish();
  }

  // --- start and teardown ---------------------------------------------

  if (recompute()) {
    buildBelt();
    resizePlates();
    applyGeo();
  }
  refreshUI();
  scheduleAutoplay();

  const api = {
    open,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(sim.raf);
      sim.raf = 0;
      clearTimeout(autoTimer);
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
      reducedQuery.removeEventListener("change", reducedListener);
      document.removeEventListener("visibilitychange", visibilityUpdate);
      if (document.body.style.overflow === "hidden") document.body.style.overflow = "";
      if (cleanupDialog) cleanupDialog();
      stage.remove();
      caption.remove();
      if (pauseBtn) pauseBtn.parentNode.remove();
      setOptionalAttr(container, "data-paused", false);
      delete container.dataset.active;
      delete container.dataset.open;
      delete container.dataset.center;
      if (activeBelt === api) activeBelt = null;
    },
  };
  activeBelt = api;
  return api;
}
