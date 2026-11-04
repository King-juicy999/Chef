import { initBelt } from "./belt.js";
import { cart } from "./cart.js";
import { dishes, legend } from "../data/menu.js";
import { restaurant } from "../config/restaurant.js";

const BELT_SPEED = 60;

const headerName = document.getElementById("header-name");
const cartBadge = document.getElementById("cart-badge");
const seeFullMenu = document.getElementById("see-full-menu");
const menuGrid = document.getElementById("menu-grid");
const heroLegend = document.getElementById("hero-legend");
const footerAddr = document.getElementById("footer-address");
const footerHours = document.getElementById("footer-hours");
const footerWa = document.getElementById("footer-whatsapp");
const cartDrawer = document.getElementById("cart-drawer");
const cartItems = document.getElementById("cart-items");
const cartTotal = document.querySelector(".total");
const checkoutBtn = document.getElementById("checkout-btn");
const deliveryForm = document.getElementById("delivery-form");
const beltHeading = document.getElementById("belt-heading");

document.title = restaurant.name;
headerName.textContent = restaurant.name;
beltHeading.textContent = restaurant.tagline;
footerAddr.textContent = restaurant.address;
footerHours.textContent = restaurant.hours;

if (footerWa && restaurant.whatsapp) {
  const digits = String(restaurant.whatsapp).replace(/\D/g, "");
  footerWa.href = `https://wa.me/${digits}`;
  footerWa.textContent = `WhatsApp ${restaurant.name}`;
}

const tierLegend = {};
dishes.forEach((d) => {
  if (d.tier && !tierLegend[d.tier]) {
    tierLegend[d.tier] = d.price;
  }
});

function renderHeroLegend() {
  if (!heroLegend) return;
  while (heroLegend.firstChild) heroLegend.removeChild(heroLegend.firstChild);
  legend.forEach((item) => {
    const price = tierLegend[item.tier];
    if (!price) return;
    const el = document.createElement("span");
    el.className = "hero-legend-item";

    const ring = document.createElement("span");
    ring.className = `hero-legend-ring hero-legend-ring-${item.tier}`;

    const label = document.createElement("span");
    label.textContent = price;

    el.appendChild(ring);
    el.appendChild(label);
    heroLegend.appendChild(el);
  });
}

function updateCartBadge() {
  const count = cart.getItems().reduce((sum, it) => sum + it.qty, 0);
  cartBadge.textContent = count;
}
updateCartBadge();

let belt;

function renderMenuGrid(dishList) {
  while (menuGrid.firstChild) menuGrid.removeChild(menuGrid.firstChild);
  const byTier = {};
  dishList.forEach((d) => {
    if (!byTier[d.tier]) byTier[d.tier] = [];
    byTier[d.tier].push(d);
  });

  Object.entries(byTier).forEach(([tier, tierDishes]) => {
    const section = document.createElement("div");
    section.className = "tier-section";
    const tierHeading = document.createElement("h3");
    const priceLabel = tierLegend[tier] || "";
    tierHeading.textContent = `${priceLabel} plates`;
    section.appendChild(tierHeading);

    tierDishes.forEach((d) => {
      const li = document.createElement("li");
      li.className = "menu-item";

      const img = document.createElement("img");
      img.src = d.image;
      img.alt = `${d.name}, ${d.price}`;
      img.width = 72;
      img.height = 72;
      img.loading = "lazy";

      const body = document.createElement("div");
      body.className = "menu-item-body";

      const h4 = document.createElement("h4");
      h4.className = "menu-item-name";
      h4.textContent = d.name;

      const pDesc = document.createElement("p");
      pDesc.className = "menu-item-desc";
      pDesc.textContent = d.description;

      const footer = document.createElement("div");
      footer.className = "menu-item-footer";

      const price = document.createElement("span");
      price.className = "menu-item-price";
      price.textContent = d.price;

      const addBtn = document.createElement("button");
      addBtn.className = "menu-item-add";
      addBtn.setAttribute("aria-label", `Add ${d.name} to order`);
      addBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>';
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        addDishToCart(d);
      });

      footer.appendChild(price);
      footer.appendChild(addBtn);

      body.appendChild(h4);
      body.appendChild(pDesc);
      body.appendChild(footer);

      li.appendChild(img);
      li.appendChild(body);

      const index = dishes.findIndex((item) => item.id === d.id);
      li.addEventListener("click", () => {
        if (belt && index !== -1) {
          belt.open(index);
        }
      });

      section.appendChild(li);
    });
    menuGrid.appendChild(section);
  });
}

function addDishToCart(dish) {
  cart.add(dish);
  updateCartBadge();
  const msg = document.createElement("div");
  msg.className = "inline-msg";
  msg.textContent = `${dish.name} added to your order`;
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 2500);
}

function renderBelt() {
  const beltContainer = document.querySelector(".belt-container");
  if (!beltContainer) return;
  while (beltContainer.firstChild) beltContainer.removeChild(beltContainer.firstChild);

  return initBelt(beltContainer, {
    dishes,
    container: beltContainer,
    speed: BELT_SPEED,
    autoplay: false,
    legend: tierLegend,
    onPlateSelect: (dish) => addDishToCart(dish),
  });
}

belt = renderBelt();
renderHeroLegend();
renderMenuGrid(dishes);

if (seeFullMenu) {
  seeFullMenu.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("menu-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

let cartOpen = false;
function toggleCartDrawer() {
  cartOpen = !cartOpen;
  cartDrawer.classList.toggle("open", cartOpen);
  const focusTarget = cartOpen
    ? cartDrawer.querySelector("button, [href], input")
    : document.querySelector(".cart-btn");
  focusTarget?.focus();
}
document.querySelector(".cart-btn")?.addEventListener("click", toggleCartDrawer);
cartDrawer.querySelector(".close")?.addEventListener("click", toggleCartDrawer);
cartDrawer.addEventListener("click", (e) => {
  if (e.target === cartDrawer) toggleCartDrawer();
});

function renderCartItems() {
  while (cartItems.firstChild) cartItems.removeChild(cartItems.firstChild);
  const items = cart.getItems();
  if (items.length === 0) {
    const emptyP = document.createElement("p");
    emptyP.textContent = "Your cart is empty";
    cartItems.appendChild(emptyP);
  } else {
    items.forEach((it) => {
      const div = document.createElement("div");
      div.className = "item";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = it.name;

      const controls = document.createElement("div");
      controls.className = "qty-controls";

      const decBtn = document.createElement("button");
      decBtn.className = "qty-btn";
      decBtn.setAttribute("data-id", it.id);
      decBtn.setAttribute("data-delta", "-1");
      decBtn.textContent = "-";
      decBtn.addEventListener("click", () => {
        cart.remove(it.id);
        updateCartBadge();
        renderCartItems();
      });

      const qtySpan = document.createElement("span");
      qtySpan.className = "qty";
      qtySpan.textContent = String(it.qty);

      const incBtn = document.createElement("button");
      incBtn.className = "qty-btn";
      incBtn.setAttribute("data-id", it.id);
      incBtn.setAttribute("data-delta", "1");
      incBtn.textContent = "+";
      incBtn.addEventListener("click", () => {
        cart.increment(it.id);
        updateCartBadge();
        renderCartItems();
      });

      controls.appendChild(decBtn);
      controls.appendChild(qtySpan);
      controls.appendChild(incBtn);

      const priceSpan = document.createElement("span");
      priceSpan.textContent = it.price;

      div.appendChild(nameSpan);
      div.appendChild(controls);
      div.appendChild(priceSpan);
      cartItems.appendChild(div);
    });
  }
  cartTotal.textContent = cart.getTotal();
}

renderCartItems();

if (checkoutBtn) {
  checkoutBtn.addEventListener("click", () => {
    cart.openWhatsApp();
    toggleCartDrawer();
  });
}

if (deliveryForm) {
  deliveryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = {
      name: deliveryForm.querySelector("input[placeholder='Name']").value,
      phone: deliveryForm.querySelector("input[placeholder='Phone']").value,
      address: deliveryForm.querySelector("input[placeholder='Delivery address']").value,
    };
    cart.openWhatsApp(formData);
    toggleCartDrawer();
    deliveryForm.reset();
  });
}
