export function initBelt(container, options = {}) {
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

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduced.addEventListener("change", () => refreshMotion());

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 800 800");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("aria-label", "food conveyor belt");
  theContainer.appendChild(svg);

  const beltWidth = 600;
  const beltHeight = 400;
  const radius = 100;
  const straightLength = beltWidth - 2 * radius;

  const totalCirc = Math.PI * 2 * radius + 2 * straightLength;

  function makeGeo(w, h, r) {
    const s = w - 2 * r;
    const cx = w / 2;
    const cy = h / 2;
    return { w, h, r, s, cx, cy };
  }

  const geo = makeGeo(beltWidth, beltHeight, radius);

  function halfSpan() {
    return geo.r;
  }

  function along(t) {
    const d = t * totalCirc;
    const arcLen = Math.PI * radius;
    if (d < arcLen) {
      const a = d / radius - Math.PI / 2;
      return { x: geo.cx + radius * Math.cos(a), y: geo.cy + radius * Math.sin(a) };
    }
    d -= arcLen;
    if (d < straightLength) {
      return { x: geo.cx + radius + d, y: geo.cy + radius };
    }
    d -= straightLength;
    if (d < arcLen) {
      const a = d / radius + Math.PI / 2;
      return { x: geo.cx + radius * Math.cos(a), y: geo.cy + radius * Math.sin(a) };
    }
    d -= arcLen;
    return { x: geo.cx - d, y: geo.cy - radius };
  }

  function project(point) {
    const perspective = 0.85;
    return { x: point.x, y: point.y * perspective };
  }

  function edgePath() {
    const { cx, cy, r, s } = geo;
    return `
      M ${cx - r} ${cy - r}
      A ${r} ${r} 0 0 1 ${cx + r} ${cy - r}
      L ${cx + r + s} ${cy - r}
      A ${r} ${r} 0 0 1 ${cx + r + s} ${cy + r}
      L ${cx + r + s} ${cy + r}
      A ${r} ${r} 0 0 1 ${cx - r} ${cy + r}
      L ${cx - r} ${cy - r} Z
    `.trim();
  }

  function slatPath() {
    const { cx, cy, r, s } = geo;
    return `
      M ${cx - r} ${cy - r}
      L ${cx - r} ${cy + r}
      M ${cx + r} ${cy - r}
      L ${cx + r} ${cy + r}
      M ${cx + r + s} ${cy - r}
      L ${cx + r + s} ${cy + r}
    `.trim();
  }

  function hitTest(point, plate) {
    const plateRect = plate.getBoundingClientRect();
    return (
      point.x >= plateRect.left &&
      point.x <= plateRect.right &&
      point.y >= plateRect.top &&
      point.y <= plateRect.bottom
    );
  }

  function pose(point, plateSize) {
    const scale = 0.5 + point.y / beltHeight * 0.5;
    const opacity = 0.4 + scale * 0.6;
    return { scale, opacity };
  }

  function centerOf(plates) {
    if (!plates.length) return { x: geo.cx, y: geo.cy };
    const sum = plates.reduce((acc, p) => {
      const t = p.getAttribute("transform") || "";
      const match = t.match(/translate\(([^,]+),\s*([^)]+)\)/);
      if (match) {
        acc.x += parseFloat(match[1]);
        acc.y += parseFloat(match[2]);
      }
      return acc;
    }, { x: 0, y: 0 });
    return { x: sum.x / plates.length, y: sum.y / plates.length };
  }

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "belt-path");
  path.setAttribute("d", edgePath());
  svg.appendChild(path);

  const slatsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  slatsGroup.setAttribute("class", "slats");
  svg.appendChild(slatsGroup);

  let springProgress = 0;
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

  let totalTime = 0;
  let cruiseSpeed = 1;
  let isPaused = false;
  let isDragging = false;
  let dragStartX = 0;
  let currentPlateIdx = 0;
  let plates = [];
  let plateData = [];

  let animId = null;
  let autoplayEnabled = autoplay && !reduced.matches;

  function requestTick() {
    if (autoplayEnabled && !isPaused) {
      animId = requestAnimationFrame(requestTick);
      const dt = 16 / 1000;
      totalTime += dt;
      updateBelt(cruiseSpeed * totalCirc * dt);
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

  const iObs = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) resumeAutoplay();
      else pauseAutoplay();
    },
    { threshold: 0.2 }
  );
  iObs.observe(theContainer);

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
    flickVelocity = dX / (theContainer.clientWidth * 2);
  }

  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    theContainer.releasePointerCapture(e.pointerId);
    if (Math.abs(flickVelocity) > 0.05) {
      let initV = flickVelocity;
      let lastT = performance.now();
      function flickTick() {
        if (reduced.matches) { cancelAnimationFrame(animId); return; }
        const now = performance.now();
        const dt = (now - lastT) / 1000;
        totalTime += initV * dt * totalCirc;
        updateBelt(totalCirc * 0.6 * Math.abs(initV));
        updatePlates();
        lastT = now;
        initV *= 0.85;
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

  theContainer.addEventListener("mouseenter", pauseAutoplay);
  theContainer.addEventListener("mouseleave", resumeAutoplay);

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

  function renderPlates(dishArray) {
    svg.querySelectorAll(".plate").forEach(el => el.remove());
    plates = [];
    plateData = [];

    dishArray.forEach((dish, i) => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "plate");
      g.setAttribute("data-index", i);
      g.setAttribute("aria-label", `${dish.name}, ${dish.price}, tier ${dish.tier}`);
      g.addEventListener("click", () => onPlateClick(dish, g));

      const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
      img.setAttribute("href", dish.image);
      img.setAttribute("width", "140");
      img.setAttribute("height", "140");
      img.setAttribute("preserveAspectRatio", "xMidYMid slice");
      g.appendChild(img);

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

    const plateCount = plates.length;
    plates.forEach((plateEl, i) => {
      const t = i / plateCount;
      const point = along(t);
      const projected = project(point);
      plateEl.setAttribute(
        "transform",
        `translate(${projected.x - 70}, ${projected.y - 70})`
      );
    });

    addSlats(plateCount);
  }

  function addSlats(n) {
    slatsGroup.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const slat = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      slat.setAttribute("class", "slat");
      slat.setAttribute("width", "4");
      slat.setAttribute("height", beltHeight);
      slat.setAttribute("fill", "var(--muted)");
      slatsGroup.appendChild(slat);
    }
  }

  function updateSlats() {
    if (!plates.length) return;
    const t = totalTime / totalCirc;
    slatsGroup.querySelectorAll(".slat").forEach((slat, i) => {
      const offset = (t + i / plates.length) * totalCirc;
      const pos = ((offset % totalCirc) / totalCirc) * beltWidth - beltWidth;
      slat.setAttribute("x", pos);
    });
  }

  function updateBelt(dt) {
    totalTime += dt * cruiseSpeed;
    updateSlats();

    plates.forEach((plateEl, i) => {
      const baseDist = (i / plates.length) * totalCirc;
      const progress = (baseDist + totalTime) % totalCirc;
      const t = progress / totalCirc;
      const point = along(t);
      const projected = project(point);
      plateEl.setAttribute(
        "transform",
        `translate(${projected.x - 70}, ${projected.y - 70})`
      );
    });
  }

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
    dPlateImg.src = dish.image;
    dPlateImg.alt = dish.name;

    dTitle.textContent = dish.name;
    dTitle.setAttribute("aria-hidden", "true");
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = `${dish.name}: ${dish.description} ${dish.price}`;
    dTitle.parentNode.insertBefore(sr, dTitle.nextSibling);
    dPrice.textContent = dish.price;
    dTier.style.background = `var(--tier-${dish.tier})`;

    dChips.innerHTML = "";
    dish.details.forEach(desc => {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = `${desc.label}: ${desc.value}`;
      dChips.appendChild(span);
    });

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

    pauseAutoplay();
  }

  function closeDialog() {
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
      const retPlate = plates[plateIdx];
      if (retPlate) retPlate.focus();
    }, 350);

    resumeAutoplay();
  }

  dAdd.addEventListener("click", () => {
    const dish = dishes.find(d => d.id === dialog.dataset.dishId);
    onPlateSelect?.(dish);
    closeDialog();
  });
  dClose.addEventListener("click", closeDialog);

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeDialog();
  });

  let focusedPlateIdx = 0;
  function navigatePlates(delta) {
    focusedPlateIdx = (focusedPlateIdx + delta + dishes.length) % dishes.length;
    updateCurrentPlate();
  }
  document.addEventListener("keydown", e => {
    if (dialog.dataset.state === "open") return;

    switch (e.key) {
      case "ArrowLeft": navigatePlates(-1); break;
      case "ArrowRight": navigatePlates(1); break;
      case "Home": focusedPlateIdx = 0; updateCurrentPlate(); break;
      case "End": focusedPlateIdx = dishes.length - 1; updateCurrentPlate(); break;
      case "Escape": if (dialog.dataset.state !== "closed") closeDialog(); break;
    }
  });

  function onPlateClick(dish, plateEl) {
    openDialog(dish);
  }

  renderPlates(dishes.slice(0, Math.max(1, dishes.length)));
  updateCurrentPlate();

  const prevBtn = theContainer.ownerDocument.querySelector('button[data-belt-prev]');
  const nextBtn = theContainer.ownerDocument.querySelector('button[data-belt-next]');
  if (prevBtn) prevBtn.addEventListener("click", handlePrev);
  if (nextBtn) nextBtn.addEventListener("click", handleNext);

  function reload(dishArray) {
    dishes.length = 0;
    dishes.push(...dishArray);
    renderPlates(dishes);
    updateCurrentPlate();
  }

  if (autoplayEnabled) playAutoplay();

  return { reload, play: playAutoplay, pause: pauseAutoplay, toggle: () => isPaused ? resumeAutoplay() : pauseAutoplay() };
}

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