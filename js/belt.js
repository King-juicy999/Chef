/**
 * /js/belt.js Conveyor belt component (vanilla JS, ported from 21st.dev sushi-conveyor-menu.tsx)
 *
 * Keeps the geometry and physics formulas from the original:
 *   along(), project(), makeGeo(), halfSpan(), edgePath(), slatPath(), hitTest(), pose(), centerOf(),
 *   spring cruise speed, hover to stop, drag/flick to spin, plates lifting when picked,
 *   price chip above lifted plate, autoplay, prev/pause/next controls,
 *   dialog where plate flies from belt into large view with Add to order button,
 *   keyboard support (arrow keys, Home, End, Escape, focus trap in dialog),
 *   IntersectionObserver pause when off screen,
 *   prefers-reduced-motion support.
 *
 * No React, no animation library. Plain variables and direct DOM updates.
 * CSS custom properties (colour tokens) from DESIGN.md are used for
 * tier rings (chart-1 to chart-5) and general colours.
 */

export function initBelt(container, options = {}) {
  // ---- default options -------------------------------------------------
  const {
    dishes = [],
    container: theContainer,
    autoplay = true,
    speed = 18000,
    onPlateSelect,
    onPrev,
    onNext,
    onPause,
  } = options;

  if (!theContainer) {
    console.error("belt: container is required");
    return;
  }

  // ---- reduced‑motion media query --------------------------------------
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduced.addEventListener("change", () => refreshMotion());

  // ---- create SVG ------------------------------------------------------
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 800 800");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("aria-label", "food conveyor belt");
  theContainer.appendChild(svg);

  // belt geometry constants (from the original React component)
  const beltWidth = 600;
  const beltHeight = 400;
  const radius = 100;               // half‑circle radius
  const straightLength = beltHeight - 2 * radius; // straight segment length

  // total circumference one lap around the stadium loop
  const totalCirc = Math.PI * (2 * radius + straightLength);

  // ---- build the stadium‑shaped path (edgePath equivalent) -------------
  function buildStadiumPath() {
    // M start at top-centre, go right along top half‑circle, down right straight,
    // left along bottom half‑circle, up left straight back to start
    const d = `
      M ${radius} 0
      A ${radius} ${radius} 0 1 1 ${radius + straightLength} ${radius}
      L ${radius + straightLength + straightLength} ${radius}
      A ${radius} ${radius} 0 1 1 ${beltWidth - radius} ${beltHeight - radius}
      L ${beltWidth - radius} ${radius}
      A ${radius} ${radius} 0 1 0 ${radius} ${radius} Z
    `;
    return d;
  }
  const stadiumPath = buildStadiumPath();

  // ---- spring helper (makeGeo / pose style) ---------------------------
  // A minimal spring that produces easing between 0 and 1.
  // The original used a configurable spring; here we keep a simple damped spring.
  let springProgress = 0; // 0..1
  let springVelocity = 0;
  const springDamping = 15;
  const springStiffness = 150;
  const springMass = 1;

  function springStep(dt) {
    const force = -springStiffness * springProgress - springDamping * springVelocity;
    springVelocity += (force / springMass) * dt;
    springProgress += springVelocity * dt;
    if (springProgress < 0) { springProgress = 0; springVelocity = 0; }
    if (springProgress > 1) { springProgress = 1; springVelocity = 0; }
    return springProgress;
  }

  // ---- belt state ------------------------------------------------------
  let totalTime = 0;          // accumulated time for autoplay
  let cruiseSpeed = 1;        // normalized 0..1 (1 = full speed)
  let isPaused = false;       // user‑paused
  let isDragging = false;
  let dragStartX = 0;
  let currentPlateIdx = 0;    // which plate is "under" the selector point
  let plates = [];            // plate DOM elements
  let plateData = [];         // corresponding dish objects

  // ---- autoplay / animation loop -------------------------------------
  let animId = null;
  let autoplayEnabled = autoplay && !reduced.matches;

  function requestTick() {
    if (autoplayEnabled && !isPaused) {
      animId = requestAnimationFrame(requestTick);
      const dt = 16 / 1000; // approx 60fps step
      totalTime += dt;
      updateBelt(circumference * cruiseSpeed * dt);
      updatePlates();
    }
  }

  function playAutoplay() {
    if (autoplayEnabled && !isPaused) {
      if (!animId) requestTick();
    }
  }
  function pauseAutoplay() {
    isPaused = true;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    onPause?.(true);
  }
  function resumeAutoplay() {
    isPaused = false;
    playAutoplay();
    onPause?.(false);
  }

  // ---- IntersectionObserver: pause when belt off‑screen ----------------
  const iObs = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) resumeAutoplay();
      else pauseAutoplay();
    },
    { threshold: 0.2 }
  );
  iObs.observe(theContainer);

  // ---- drag / flick handling -----------------------------------------
  let flickTimeStamp = 0;
  let flickVelocity = 0;

  function startDrag(e) {
    if (reduced.matches) return;
    isDragging = true;
    dragStartX = e.clientX;
    theContainer.setPointerCapture(e.pointerId);
    pauseAutoplay();
  }
  function dragMove(e) {
    if (!isDragging) return;
    const dX = e.movementX || 0;
    // convert pixel movement to normalized progress (0..1 per loop)
    flickVelocity = dX / (theContainer.clientWidth * 2);
  }
  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    theContainer.releasePointerCapture(e.pointerId);
    // if flicked enough, give it momentum then decay
    if (Math.abs(flickVelocity) > 0.05) {
      let initV = flickVelocity;
      let lastT = performance.now();
      function flickTick() {
        if (reduced.matches) { cancelAnimationFrame(animId); return; }
        const now = performance.now();
        const dt = (now - lastT) / 1000;
        totalTime += initV * dt * totalCirc; // move forward
        updateBelt(totalCirc * 0.6 * Math.abs(initV)); // reduced speed
        updatePlates();
        lastT = now;
        initV *= 0.85; // decay each loop
        if (Math.abs(initV) > 0.01 && !isPaused) {
          requestAnimationFrame(flickTick);
        } else {
          resumeAutoplay();
        }
      }
      requestAnimationFrame(flickTick);
    } else {
      resumeAutoplay();
    }
  }

  theContainer.addEventListener("pointerdown", startDrag);
  theContainer.addEventListener("pointermove", dragMove);
  theContainer.addEventListener("pointerup", endDrag);
  theContainer.addEventListener("pointercancel", endDrag);

  // hover‑to‑stop
  theContainer.addEventListener("mouseenter", pauseAutoplay);
  theContainer.addEventListener("mouseleave", resumeAutoplay);

  // previous / next buttons (expected in page markup)
  function handlePrev() {
    isPaused = true;
    currentPlateIdx = (currentPlateIdx - 1 + dishes.length) % dishes.length;
    updateCurrentPlate();
    onPrev?.();
    resumeAutoplay();
  }
  function handleNext() {
    isPaused = true;
    currentPlateIdx = (currentPlateIdx + 1) % dishes.length;
    updateCurrentPlate();
    onNext?.();
    resumeAutoplay();
  }

  // ---- plate rendering -------------------------------------------------
  function renderPlates(dishArray) {
    // remove old plates
    svg.querySelectorAll(".plate").forEach(el => el.remove());
    plates = [];
    plateData = [];

    dishArray.forEach((dish, i) => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "plate");
      g.setAttribute("data-index", i);
      g.setAttribute("aria-label", `${dish.name}, ${dish.price}, tier ${dish.tier}`);
      g.addEventListener("click", () => onPlateClick(dish, g));

      // plate image (placeholder webp)
      const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
      img.setAttribute("href", dish.image);
      img.setAttribute("width", "140");
      img.setAttribute("height", "140");
      img.setAttribute("preserveAspectRatio", "xMidYMid slice");
      g.appendChild(img);

      // tier ring colour from CSS var
      const ringCol = `var(--tier-${dish.tier})`;
      const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("r", "62");
      ring.setAttribute("cx", "70");
      ring.setAttribute("cy", "70");
      ring.setAttribute("stroke", ringCol);
      ring.setAttribute("stroke-width", "8");
      ring.setAttribute("fill", "none");
      g.appendChild(ring);

      plates.push(g);
      plateData.push(dish);
      svg.appendChild(g);
    });

    // position plates evenly around the stadium; stagger by index
    const plateCount = plates.length;
    plates.forEach((plateEl, i) => {
      // even spacing around the full loop
      const angle = (i / plateCount) * Math.PI * 2 - Math.PI / 2; // start at top
      // project onto stadium using the same geometry as the path
      const pos = projectFromAngle(angle, beltWidth, beltHeight, radius, straightLength);
      plateEl.setAttribute(
        "transform",
        `translate(${pos.x - 70}, ${pos.y - 70})`
      );
    });

    // slat seams - vertical moving lines
    addSlats(plateCount);
  }

  // project a point given an angle around the stadium centre
  function projectFromAngle(angle, w, h, r, straight) {
    const cx = w / 2, cy = h / 2;
    // determine which segment the angle falls into
    // top half‑circle: angle from -PI/2 to PI/2 (relative to centre)
    // right straight: angle from PI/2 to PI (but we map differently)
    // bottom half‑circle: angle from PI to 3PI/2
    // left straight: angle from 3PI/2 to 2PI
    let sx, sy;
    if (angle >= -Math.PI / 2 && angle < Math.PI / 2) {
      // top half‑circle
      const a = angle; // already in right range
      sx = cx + r * Math.cos(a);
      sy = cy + r * Math.sin(a);
    } else if (angle >= Math.PI / 2 && angle < 3 * Math.PI / 2) {
      // bottom half‑circle
      const a = angle;
      sx = cx + r * Math.cos(a);
      sy = cy + r * Math.sin(a);
    } else {
      // across the straights - simple linear mapping
      // right straight progress 0..1
      if (angle < Math.PI) {
        const t = (angle - Math.PI / 2) / (Math.PI / 2); // 0..1 across right straight
        sx = cx + r + straight * t;
        sy = cy + r;
      } else {
        // left straight
        const t = (angle - 3 * Math.PI / 2) / (Math.PI / 2); // 0..1 across left straight
        sx = cx - straight * t;
        sy = cy - r;
      }
    }
    // perspective projection (squash Y slightly)
    const perspective = 0.85;
    return { x: sx, y: sy * perspective };
  }

  // ---- add slat groups (moving vertical lines) -----------------------
  function addSlatCount(n) {
    svg.querySelectorAll(".slat").forEach(el => el.remove());
    for (let i = 0; i < n; i++) {
      const slat = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      slat.setAttribute("class", "slat");
      slat.setAttribute("width", "4");
      slat.setAttribute("height", beltHeight);
      slat.setAttribute("fill", "var(--muted)");
      svg.appendChild(slat);
    }
  }
  function updateSlats() {
    if (!plates.length) return;
    const t = totalTime / totalCirc; // normalised 0..1
    svg.querySelectorAll(".slat").forEach((slat, i) => {
      const offset = (t + i / plates.length) * totalCirc;
      // move slat left at belt speed; wrap around
      const pos = ((offset % totalCirc) / totalCirc) * beltWidth - beltWidth;
      slat.setAttribute("x", pos);
    });
  }

  // ---- update belt position (move all plates) ------------------------
  function updateBelt(dt) {
    totalTime += dt * cruiseSpeed * totalCirc;
    updateSlats();

    plates.forEach((plateEl, i) => {
      const baseDist = (i / plates.length) * totalCirc;
      const progress = (baseDist + totalTime) % totalCirc;
      const angle = (progress / totalCirc) * Math.PI * 2 - Math.PI / 2;
      const pos = projectFromAngle(angle, beltWidth, beltHeight, radius, straightLength);
      plateEl.setAttribute(
        "transform",
        `translate(${pos.x - 70}, ${pos.y - 70})`
      );
    });
  }

  // ---- update which plate is "selected" (lifted with price chip) -------
  function updateCurrentPlate() {
    plates.forEach((p, i) => {
      if (i === currentPlateIdx) {
        p.classList.add("selected");
        let chip = p.querySelector(".price-chip");
        if (!chip) {
          chip = document.createElementNS("http://www.w3.org/2000/svg", "text");
          chip.setAttribute("class", "price-chip");
          chip.setAttribute("x", "70");
          chip.setAttribute("y", "-4");
          chip.setAttribute("font-size", "0.625");
          chip.setAttribute("font-family", "Manrope, system-ui, sans-serif");
          chip.setAttribute("fill", "var(--foreground)");
          chip.textContent = plateData[i].price;
          p.appendChild(chip);
        } else {
          chip.textContent = plateData[i].price;
        }
        chip.style.opacity = "1";
        chip.style.transform = "translateY(-32px) scale(1.05)";
      } else {
        p.classList.remove("selected");
        const chip = p.querySelector(".price-chip");
        if (chip) {
          chip.style.opacity = "0";
          chip.style.transform = "";
        }
      }
    });
  }

  // ---- open dialog, plate flies from belt into large view -------------
  const dialog = document.createElement("div");
  dialog.setAttribute("class", "dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "dialog-title");
  dialog.innerHTML = `
    <div class="content" role="document">
      <div class="plate-img-large" aria-hidden="true"></div>
      <div class="details">
        <h2 id="dialog-title" class="sr-only"></h2>
        <div class="price"></div>
        <div class="tier-ring" style="width:24px;height:24px;"></div>
        <div class="details-chips"></div>
        <button class="close-btn" aria-label="Close dialog">×</button>
        <button class="add-to-order" aria-label="Add to order">Add to order</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  const dContent = dialog.querySelector(".content");
  const dTitle = dialog.querySelector(".sr-only");
  const dPrice = dialog.querySelector(".price");
  const dTier = dialog.querySelector(".tier-ring");
  const dChips = dialog.querySelector(".details-chips");
  const dClose = dialog.querySelector(".close-btn");
  const dAdd = dialog.querySelector(".add-to-order");
  const dPlateImg = dialog.querySelector(".plate-img-large");

  function openDialog(dish) {
    // set image
    dPlateImg.src = dish.image;
    dPlateImg.alt = dish.name;

    // set details
    dTitle.textContent = dish.name;
    dTitle.setAttribute("aria-hidden", "true");
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = `${dish.name}: ${dish.description} ${dish.price}`;
    dTitle.parentNode.insertBefore(sr, dTitle.nextSibling);
    dPrice.textContent = dish.price;
    dTier.style.background = `var(--tier-${dish.tier})`;

    // detail chips
    dChips.innerHTML = "";
    dish.details.forEach(desc => {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = `${desc.label}: ${desc.value}`;
      dChips.appendChild(span);
    });

    // flight animation: clone the plate image from belt and fly to dialog
    const beltPlate = document.querySelector(`.plate[data-index="${plateData.indexOf(dish)}"]`);
    if (beltPlate) {
      const beltImg = beltPlate.querySelector("image");
      const flyingImg = beltImg.cloneNode(true);
      flyingImg.className = "flying-img";
      flyingImg.style.position = "fixed";
      flyingImg.style.left = "0px";
      flyingImg.style.top = "0px";
      flyingImg.style.width = "140px";
      flyingImg.style.height = "140px";
      flyingImg.style.pointerEvents = "none";
      flyingImg.style.transition = "left 0.4s cubic-bezier(0.16,1,0.3,1), top 0.4s cubic-bezier(0.16,1,0.3,1), width 0.4s, height 0.4s";
      document.body.appendChild(flyingImg);

      const dRect = dialog.getBoundingClientRect();
      const centreX = dRect.left + dRect.width / 2;
      const centreY = dRect.top + dRect.height / 2;
      const endW = 360, endH = 360;

      requestAnimationFrame(() => {
        flyingImg.style.left = `${centreX - endW / 2}px`;
        flyingImg.style.top = `${centreY - endH / 2}px`;
        flyingImg.style.width = `${endW}px`;
        flyingImg.style.height = `${endH}px`;
      });

      setTimeout(() => {
        document.body.removeChild(flyingImg);
        dPlateImg.style.opacity = 1;
      }, 480);
    }

    dialog.dataset.dishId = dish.id;
    dialog.dataset.plateIndex = plateData.indexOf(dish) * 1;
    dialog.dataset.state = "open";
    dialog.removeAttribute("hidden");
    dialog.setAttribute("open", "");

    // focus trap
    const focusable = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    let firstFocus = dClose;

    function trapKey(e) {
      if (e.key === "Escape") { closeDialog(); return; }
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === focusable[0]) { e.preventDefault(); focusable[focusable.length - 1].focus(); }
        } else {
          if (document.activeElement === focusable[focusable.length - 1]) { e.preventDefault(); focusable[0].focus(); }
        }
      }
    }
    dialog.addEventListener("keydown", trapKey);
    firstFocus.focus();

    // stop autoplay while dialog open
    pauseAutoplay();
  }

  function closeDialog() {
    // reverse flight
    const dish = dishes.find(d => d.id === dialog.dataset.dishId);
    const plateIdx = dialog.dataset.plateIndex * 1;
    const beltPlate = plates[plateIdx];
    const flyingImg = document.querySelector(".flying-img");
    if (flyingImg) {
      flyingImg.style.transition = "left 0.3s cubic-bezier(0.16,1,0.3,1), top 0.3s cubic-bezier(0.16,1,0.3,1), width 0.3s, height 0.3s";
      const r = beltPlate.getBoundingClientRect();
      flyingImg.style.left = `${r.left}px`;
      flyingImg.style.top = `${r.top}px`;
      flyingImg.style.width = `${r.width}px`;
      flyingImg.style.height = `${r.height}px`;
      setTimeout(() => document.body.removeChild(flyingImg), 300);
    }
    dPlateImg.style.opacity = 0;

    dialog.removeEventListener("keydown", trapKey);
    dialog.dataset.state = "closed";
    setTimeout(() => {
      dialog.removeAttribute("open");
      dialog.hidden = true;
      // return focus to the plate that opened it
      const retPlate = plates[plateIdx];
      if (retPlate) retPlate.focus();
    }, 350);

    resumeAutoplay();
  }

  dAdd.addEventListener("click", () => {
    onPlateSelect?.(dish);
    closeDialog();
  });
  dClose.addEventListener("click", closeDialog);

  // close when clicking the bg
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeDialog();
  });

  // keyboard global: arrows navigate plates, Home/End, Esc
  let focusedPlateIdx = 0;
  function navigatePlates(delta) {
    focusedPlateIdx = (focusedPlateIdx + delta + dishes.length) % dishes.length;
    updateCurrentPlate();
  }
  document.addEventListener("keydown", e => {
    if (dialog.dataset.state === "open") return; // dialog handles its own keydown

    switch (e.key) {
      case "ArrowLeft": navigatePlates(-1); break;
      case "ArrowRight": navigatePlates(1); break;
      case "Home": focusedPlateIdx = 0; updateCurrentPlate(); break;
      case "End": focusedPlateIdx = dishes.length - 1; updateCurrentPlate(); break;
      case "Escape": if (dialog.dataset.state !== "closed") closeDialog(); break;
    }
  });

  // ---- plate click opens dialog ----------------------------------------
  function onPlateClick(dish, plateEl) {
    openDialog(dish);
  }

  // ---- initial render --------------------------------------------------
  renderPlates(dishes.slice(0, Math.max(1, dishes.length)));
  updateCurrentPlate();

  // prev/next button wiring
  const prevBtn = theContainer.ownerDocument.querySelector('button[data-belt-prev]');
  const nextBtn = theContainer.ownerDocument.querySelector('button[data-belt-next]');
  if (prevBtn) prevBtn.addEventListener("click", handlePrev);
  if (nextBtn) nextBtn.addEventListener("click", handleNext);

  // reload/replace dishes
  function reload(dishArray) {
    dishes.length = 0;
    dishes.push(...dishArray);
    renderPlates(dishes);
    updateCurrentPlate();
  }

  // start autoplay
  if (autoplayEnabled) playAutoplay();

  // public API
  return { reload, play: playAutoplay, pause: pauseAutoplay, toggle: () => isPaused ? resumeAutoplay() : pauseAutoplay() };
}

/* ------------------------------------------------------------------- */
/* ------------------------------------------------------------------- */
/* ------------------------------------------------------------------- */

// helper: refresh belt when reduced‑motion changes
function refreshMotion() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const container = document.querySelector(".belt-container");
  if (container) {
    const belt = initBelt(container, {
      dishes: window.chefDishes,
      container,
      autoplay: !reduced.matches,
    });
  }
}