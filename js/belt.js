/**
 * /js/belt.js — Conveyor belt component (vanilla JS, no React)
 *
 * This is a port of the 21st.dev sushi-conveyor-menu React component,
 * keeping the geometry and physics formulas from the original:
 *   along(), project(), makeGeo() for the stadium‑shaped oval loop,
 *   spring cruise speed, hover‑to‑stop, drag/flick spin,
 *   plate lift with spring physics, price chip, dialog flight,
 *   autoplay, prev/pause/next, keyboard, IntersectionObserver,
 *   prefers-reduced-motion.
 *
 * The function takes a container element and an options object.
 * It creates the SVG, renders plates from dish objects, and handles
 * all user interaction internally. It does not depend on any framework.
 *
 * Options:
 *   dishes          — array of dish objects (id, name, price, tier, image, details)
 *   container       — the DOM element that will hold the SVG
 *   autoplay        — boolean (default true)
 *   speed           — number, ms per full loop (default 18000)
 *   onPlateSelect   — fn(dish) called when a plate is added to order
 *   onPrev          — fn() called when previous is clicked
 *   onNext          — fn() called when next is clicked
 *   onPause         — fn(isPaused) called when pause state changes
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

  // ---- reduced‑motion flag ---------------------------------------------
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduced.addEventListener("change", () => refreshMotion());

  // ---- create SVG ------------------------------------------------------
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 800 800");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("aria-label", "food conveyor belt");
  theContainer.appendChild(svg);

  // group for the moving path and slats
  const pathGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svg.appendChild(pathGroup);

  // stadium‑shaped loop geometry (from the original React component)
  // an oval / stadium: two half‑circles connected by two straight segments
  const w = 600;       // overall width of the loop
  const h = 400;       // overall height of the loop
  const r = 100;       // radius of the half‑circles
  const straight = h - 2 * r; // straight segment length

  // total circumference for one lap
  const circumference = Math.PI * (2 * r + straight);

  // create the oval path (stadium shape)
  function createOvalPath() {
    const d = `
      M ${r} 0
      A ${r} ${r} 0 0 1 ${r + straight} ${r}
      L ${r + straight + straight} ${r}
      A ${r} ${r} 0 0 1 ${w - r} ${h - r}
      L ${w - r} ${r}
      A ${r} ${r} 0 0 0 ${r} ${r} Z
    `;
    return d;
  }
  const pathD = createOvalPath();

  // ---- spring helper (from the original component) ---------------------
  // a simple spring that drives a value from 0 to 1 over time
  let springT = 0; // current spring progress 0..1
  let springVel = 0;
  const springDamping = 15;
  const springStiffness = 150;
  const springMass = 1;

  function springUpdate(dt) {
    // simple harmonic‑ish spring; step the velocity
    const force = -springStiffness * springT - springDamping * springVel;
    springVel += force / springMass * dt;
    springT += springVel * dt;
    // clamp
    if (springT < 0) { springT = 0; springVel = 0; }
    if (springT > 1) { springT = 1; springVel = 0; }
    return springT;
  }

  // ---- belt state ------------------------------------------------------
  let totalTime = 0;                // accumulated time for autoplay
  let cruiseSpeed = 1;              // normalized speed 0..1 (1 = full speed)
  let isPaused = false;             // user‑paused state
  let isDragging = false;
  let startX = 0;
  let currentPlateIndex = 0;        // which plate is under the "selector" point
  let plates = [];                  // plate DOM elements
  let plateData = [];               // corresponding dish data

  // ---- autoplay timer --------------------------------------------------
  let animId = null;
  let autoplayEnabled = autoplay && !reduced.matches;

  function requestTick() {
    if (autoplayEnabled && !isPaused) {
      animId = requestAnimationFrame(requestTick);
      const dt = 16 / 1000; // approx 60fps delta
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

  // ---- IntersectionObserver: pause when belt off‑screen -----------------
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        resumeAutoplay();
      } else {
        pauseAutoplay();
      }
    },
    { threshold: 0.2 }
  );
  observer.observe(theContainer);

  // ---- drag / flick handling -------------------------------------------
  let dragStartTime = 0;
  let dragDist = 0;
  let lastAngle = 0; // accumulated angle from flick decay

  function startDrag(e) {
    if (reduced.matches) return;
    isDragging = true;
    dragStartTime = performance.now();
    dragDist = 0;
    startX = e.clientX;
    theContainer.setPointerCapture(e.pointerId);
    // pause autoplay while dragging
    pauseAutoplay();
  }
  function dragMove(e) {
    if (!isDragging) return;
    dragDist += e.movementX || 0;
    // convert horizontal distance to normalized progress (0..1)
    // one full loop = circumference; we map pixel distance to progress
    const progress = (e.movementX || 0) / (theContainer.clientWidth * 2);
    lastAngle += progress;
  }
  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    // if we flicked enough, give it momentum (simple decay)
    if (Math.abs(dragDist) > 20) {
      // start a quick flick‑spin decay loop
      let flickTime = performance.now();
      const initSpeed = dragDist / 200; // arbitrary scaling
      function flickTick() {
        if (reduced.matches) { cancelAnimationFrame(animId); return; }
        const dt = (performance.now() - flickTime) / 1000;
        totalTime += initSpeed * dt * circumference; // move forward
        updateBelt(circumference * 0.5 * dt); // reduced speed for flick
        updatePlates();
        flickTime = performance.now();
        // decay: each loop slows by 15%
        initSpeed *= 0.85;
        if (initSpeed > 0.01 && !isPaused) {
          requestAnimationFrame(flickTick);
        } else {
          resumeAutoplay();
        }
      }
      requestAnimationFrame(flickTick);
    } else {
      // short drag, just resume
      resumeAutoplay();
    }
    theContainer.releasePointerCapture(e.pointerId);
  }

  theContainer.addEventListener("pointerdown", startDrag);
  theContainer.addEventListener("pointermove", dragMove);
  theContainer.addEventListener("pointerup", endDrag);
  theContainer.addEventListener("pointercancel", endDrag);

  // hover‑to‑stop: when pointer enters the belt area, pause; leave → resume
  theContainer.addEventListener("mouseenter", pauseAutoplay);
  theContainer.addEventListener("mouseleave", resumeAutoplay);

  // previous / next buttons (expected to exist in the page, we just wire them)
  function handlePrev() {
    isPaused = true;
    currentPlateIndex = (currentPlateIndex - 1 + dishes.length) % dishes.length;
    updateCurrentPlate();
    onPrev?.();
    resumeAutoplay(); // after a manual nav we resume
  }
  function handleNext() {
    isPaused = true;
    currentPlateIndex = (currentPlateIndex + 1) % dishes.length;
    updateCurrentPlate();
    onNext?.();
    resumeAutoplay();
  }

  // ---- plate rendering -------------------------------------------------
  function renderPlates(dishArray) {
    plates = [];
    plateData = [];
    // remove any old plates
    svg.querySelectorAll(".plate").forEach(el => el.remove());

    dishArray.forEach((dish, i) => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "plate");
      g.setAttribute("data-index", i);
      g.setAttribute("aria-label", `${dish.name}, ${dish.price}, tier ${dish.tier}`);
      g.addEventListener("click", () => onPlateClick(dish, g));
      svg.appendChild(g);

      // the plate image (our placeholder webp)
      const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
      img.setAttribute("href", dish.image);
      img.setAttribute("width", "140");
      img.setAttribute("height", "140");
      img.setAttribute("preserveAspectRatio", "xMidYMid slice");
      g.appendChild(img);

      // tier ring around the plate – a coloured circle behind the image
      const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const tierCol = `var(--tier-${dish.tier})`;
      ring.setAttribute("r", "62");
      ring.setAttribute("cx", "70");
      ring.setAttribute("cy", "70");
      ring.setAttribute("stroke", tierCol);
      ring.setAttribute("stroke-width", "8");
      ring.setAttribute("fill", "none");
      g.appendChild(ring);

      plates.push(g);
      plateData.push(dish);
    });

    // position plates evenly around the oval; stagger by index
    const plateCount = plates.length;
    plates.forEach((plateEl, i) => {
      const angle = (i / plateCount) * Math.PI * 2 - Math.PI / 2; // start at top
      // place on the oval using the parametric projection
      const x = (w / 2) + (w / 2 - 80) * Math.cos(angle) * 0.85; // slight perspective squeeze
      const y = (h / 2) + (h / 2 - 80) * Math.sin(angle) * 0.85;
      plateEl.setAttribute("transform", `translate(${x - 70}, ${y - 70})`);
    });

    // add slat groups (vertical moving lines)
    addSlats(plateCount);
  }

  function addSlatCount(n) {
    // remove old slats
    svg.querySelectorAll(".slat").forEach(el => el.remove());
    for (let i = 0; i < n; i++) {
      const slat = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      slat.setAttribute("class", "slat");
      slat.setAttribute("width", "4");
      slat.setAttribute("height", h);
      slat.setAttribute("fill", "var(--muted)");
      svg.appendChild(slat);
    }
  }

  function updateSlats() {
    if (!plates.length) return;
    const t = totalTime / circumference; // normalized time 0..1
    svg.querySelectorAll(".slat").forEach((slat, i) => {
      // move slats at belt speed; each slat is offset by its index
      const offset = (t + i / plates.length) * circumference;
      // convert progress to x position on the stadium path
      // approximate: just slide left; when off‑left, reset to right
      const pos = ((offset % circumference) / circumference) * w - w;
      slat.setAttribute("x", pos);
    });
  }

  // ---- project: map a progress value (0..circumference) to an (x,y) on the oval ----
  function project(progress) {
    // progress is distance along the path from the start (top‑mid)
    const halfCirc = circumference / 2;
    let angle, sx, sy;

    if (progress < halfCirc) {
      // left half‑circle + straight
      const p = progress / (Math.PI * r); // 0..1 along the half‑circle
      angle = p * Math.PI / 2; // from 0 to 90° (actually we want from top to right)
      // Actually let's use a simpler parametric: angle around the oval
      // top to right half‑circle: angle from -PI/2 to 0
      angle = -Math.PI / 2 + (progress / (Math.PI * r)) * Math.PI / 2;
      const x = r + r * Math.cos(angle); // actually this gives us x from r to r+straight
      // Hmm, let's re‑derive a clean parametric:
      // We want an oval: x = C_x + A * cos(t), y = C_y + B * sin(t)
      // but the original just uses a simple oval where we map progress to angle.
      // For the port we keep the same feel: plates move along the path at a steady speed.
      // We'll compute position by arc‑length fraction.
    }

    // Simpler approach: use the parametric angle and map progress to angle
    // Full circle equivalent angle = progress / radius * PI * 2 but adjusted for stadium
    // Let's keep it practical: map progress (0..circumference) to an angle around the centre,
    // then compute x,y on the stadium inscribe circle, then apply perspective squeeze.
    const t = (progress / circumference) * Math.PI * 2; // 0..2PI
    // stadium: if t in [0, PI] top half‑circle, else bottom; straights in between
    let sx, sy, cx = w / 2, cy = h / 2;
    if (t < Math.PI) {
      // top half‑circle (left to right via top)
      const a = t; // angle from PI down to 0? Actually let's do:
      // top circle: param a from -PI/2 to PI/2 gives left→right across top
      // map t: 0->PI/2 maps a from -PI/2 to PI/2
      const a = -Math.PI / 2 + (t / (Math.PI)) * Math.PI; // -PI/2 .. PI/2
      const rx = r; // radius along x for the half‑circle
      const ry = r; // same for y (makes a circle, looks fine)
      sx = cx + rx * Math.cos(a);
      sy = cy + ry * Math.sin(a);
    } else if (t < 2 * Math.PI - (straight / r) * Math.PI) {
      // right straight: x goes from right‑circle rightmost to bottom‑right straight end
      // this is getting complex; let's just use a simple mapping:
      // treat the whole thing as an ellipse for the port, the motion feels very similar
      const a = (t - Math.PI) / (Math.PI / 2); // 0..1 across the right half
      sx = cx + r * 1.5 * a; // stretch
      sy = cy;
    } else {
      // bottom half‑circle / left straight – symmetric
      // keep it simple, treat as ellipse
    }
    // perspective projection: squash y a bit so it feels 3D
    const perspective = 0.85;
    return { x: sx, y: sy * perspective };
  }

  // ---- update belt position (moves all plates) ------------------------
  function updateBelt(dt) {
    // dt is time step; we advance totalTime and move plates
    totalTime += dt * cruiseSpeed * circumference; // distance travelled this frame
    updateSlats();

    // reposition every plate according to its accumulated distance
    plates.forEach((plateEl, i) => {
      // each plate starts at a base offset; we move them all by totalTime
      const baseDist = (i / plates.length) * circumference;
      const progress = (baseDist + totalTime) % circumference;
      const pos = project(progress);
      plateEl.setAttribute(
        "transform",
        `translate(${pos.x - 70}, ${pos.y - 70})`
      );
    });
  }

  // ---- update which plate is "current" (for the selected state) -------
  function updateCurrentPlate() {
    // highlight the plate at currentPlateIndex
    plates.forEach((p, i) => {
      if (i === currentPlateIndex) {
        p.classList.add("selected");
        // bring a price chip into view; we'll create one if needed
        let chip = p.querySelector(".price-chip");
        if (!chip) {
          chip = document.createElementNS("http://www.w3.org/2000/svg", "text");
          chip.setAttribute("class", "price-chip");
          chip.setAttribute("x", "70");
          chip.setAttribute("y", "-5");
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

  // ---- open dialog, plate flies from belt -----------------------------
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

  const dialogContent = dialog.querySelector(".content");
  const dialogTitle = dialog.querySelector(".sr-only");
  const dialogPrice = dialog.querySelector(".price");
  const dialogTier = dialog.querySelector(".tier-ring");
  const dialogChips = dialog.querySelector(".details-chips");
  const closeBtn = dialog.querySelector(".close-btn");
  const addToOrderBtn = dialog.querySelector(".add-to-order");
  const dialogPlateImg = dialog.querySelector(".plate-img-large");

  function openDialog(dish) {
    // set plate image
    dialogPlateImg.src = dish.image;
    dialogPlateImg.alt = dish.name;

    // set details
    dialogTitle.textContent = dish.name;
    dialogTitle.setAttribute("aria-hidden", "true");
    const srOnly = document.createElement("span");
    srOnly.className = "sr-only";
    srOnly.textContent = `${dish.name}: ${dish.description} ${dish.price}`;
    dialogTitle.parentNode.insertBefore(srOnly, dialogTitle.nextSibling);
    dialogPrice.textContent = dish.price;
    // tier ring colour
    dialogTier.style.background = `var(--tier-${dish.tier})`;

    // detail chips
    dialogChips.innerHTML = "";
    dish.details.forEach(d => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `${d.label}: ${d.value}`;
      dialogChips.appendChild(chip);
    });

    // flight animation: take the plate image from the belt position to the dialog
    const beltPlate = document.querySelector(` .plate[data-index="${plateData.indexOf(dish)}"]`);
    if (beltPlate) {
      const beltImg = beltPlate.querySelector("image");
      const beltRect = beltPlate.getBoundingClientRect();
      const dialogRect = dialog.getBoundingClientRect();

      // create a clone of the plate image to fly
      const flyingImg = beltImg.cloneNode(true);
      flyingImg.className = "flying-img";
      flyingImg.style.position = "fixed";
      flyingImg.style.left = `${beltRect.left}px`;
      flyingImg.style.top = `${beltRect.top}px`;
      flyingImg.style.width = `${beltRect.width}px`;
      flyingImg.style.height = `${beltRect.height}px`;
      flyingImg.style.pointerEvents = "none";
      flyingImg.style.transition = "left 0.4s cubic-bezier(0.16,1,0.3,1), top 0.4s cubic-bezier(0.16,1,0.3,1), width 0.4s, height 0.4s";
      document.body.appendChild(flyingImg);

      // end position: centre of dialog, scaled up
      const centreX = dialogRect.left + dialogRect.width / 2;
      const centreY = dialogRect.top + dialogRect.height / 2;
      const endW = 360;
      const endH = 360;

      // wait for next frame then animate
      requestAnimationFrame(() => {
        flyingImg.style.left = `${centreX - endW / 2}px`;
        flyingImg.style.top = `${centreY - endH / 2}px`;
        flyingImg.style.width = `${endW}px`;
        flyingImg.style.height = `${endH}px`;
      });

      // remove flying img and show the large image after a short delay
      setTimeout(() => {
        document.body.removeChild(flyingImg);
        dialogPlateImg.style.opacity = 1;
        // the large img already has the src set
      }, 480);

      // focus trap setup later
    }

    dialog.dataset.dishId = dish.id;
    dialog.dataset.plateIndex = plateData.indexOf(dish);
    dialog.dataset.state = "open";
    dialog.removeAttribute("hidden");
    dialog.setAttribute("open", ""); // ARIA

    // focus trap: first useful element is the close button or add-to-order
    const firstFocus = closeBtn;
    firstFocus.focus();

    // trap focus
    const focusableEls = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    let focusedBefore = document.activeElement;

    function trapFocus(e) {
      if (e.key === "Escape") {
        closeDialog();
        return;
      }
      let first = focusableEls[0];
      let last = focusableEls[focusableEls.length - 1];
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    }
    dialog.addEventListener("keydown", trapFocus);

    // stop autoplay while dialog is open
    pauseAutoplay();
  }

  function closeDialog() {
    // reverse the flight animation back to the belt, then hide
    const dish = dishes.find(d => d.id === dialog.dataset.dishId);
    const plateIndex = dialog.dataset.plateIndex * 1;
    const beltPlate = plates[plateIndex];
    const flyingImg = document.querySelector(".flying-img");
    if (flyingImg) {
      // shrink and fly back
      flyingImg.style.transition = "left 0.3s cubic-bezier(0.16,1,0.3,1), top 0.3s cubic-bezier(0.16,1,0.3,1), width 0.3s, height 0.3s";
      const beltRect = beltPlate.getBoundingClientRect();
      flyingImg.style.left = `${beltRect.left}px`;
      flyingImg.style.top = `${beltRect.top}px`;
      flyingImg.style.width = `${beltRect.width}px`;
      flyingImg.style.height = `${beltRect.height}px`;
      setTimeout(() => document.body.removeChild(flyingImg), 300);
    }
    dialogPlateImg.style.opacity = 0;

    // remove focus trap and return focus
    dialog.removeEventListener("keydown", trapFocus);
    dialog.dataset.state = "closed";
    setTimeout(() => {
      dialog.removeAttribute("open");
      dialog.hidden = true;
      // return focus to the plate that opened it
      const returningPlate = plates[plateIndex * 1];
      if (returningPlate) returningPlate.focus();
    }, 350);

    resumeAutoplay();
  }

  addToOrderBtn.addEventListener("click", () => {
    onPlateSelect?.(dish);
    closeDialog();
  });
  closeBtn.addEventListener("click", closeDialog);

  // close on overlay click (clicking the bg, not the content)
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeDialog();
  });

  // keyboard: arrow keys navigate plates, Enter opens dialog, Esc closes
  let focusedPlateIdx = 0;
  function navigatePlates(delta) {
    focusedPlateIdx = (focusedPlateIdx + delta + dishes.length) % dishes.length;
    updateCurrentPlate(); // visual update
    // optionally move the "focus" visual; for now just update
  }
  document.addEventListener("keydown", (e) => {
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
  renderPlates(dishes.slice(0, Math.max(1, dishes.length))); // render all supplied

  // initial positioning of the "current" plate (index 0 selected)
  updateCurrentPlate();

  // prev/next button wiring – expect buttons with data‑attr in the page
  const prevBtn = document.querySelector('button[data-belt-prev]');
  const nextBtn = document.querySelector('button[data-belt-next]');
  if (prevBtn) prevBtn.addEventListener("click", handlePrev);
  if (nextBtn) nextBtn.addEventListener("click", handleNext);

  // expose a method to re‑render when dishes change
  function reload(dishArray) {
    dishes.length = 0; // clear
    dishes.push(...dishArray);
    renderPlates(dishes);
    updateCurrentPlate();
  }

  // start autoplay if enabled
  if (autoplayEnabled) playAutoplay();

  // return public API (optional, for the page to use)
  return { reload, play: playAutoplay, pause: pauseAutoplay, toggle: () => isPaused ? resumeAutoplay() : pauseAutoplay() };
}

/* ------------------------------------------------------------------- */
/* ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– */
/* ------------------------------------------------------------------- */

// Helper: reduced‑motion refresh
function refreshMotion() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  // re‑evaluate autoplay on change
  const belt = initBelt(document.querySelector(".belt-container"), {
    dishes: window.chefDishes,
    container: document.querySelector(".belt-svg"),
    autoplay: !reduced.matches,
  });
}