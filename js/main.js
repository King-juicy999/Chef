import { initBelt } from "./belt.js";
import { cart, formatWhatsAppNumber } from "./cart.js";
import { dishes, legend } from "../data/menu.js";
import { restaurant } from "../config/restaurant.js";

const headerName = document.getElementById("header-name");
const cartBadge = document.getElementById("cart-badge");
const seeFullMenu = document.getElementById("see-full-menu");
const menuGrid = document.getElementById("menu-grid");
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

function updateCartBadge() {
  const count = cart.getItems().reduce((sum, it) => sum + it.qty, 0);
  cartBadge.textContent = count;
}
updateCartBadge();

function renderMenuGrid(dishList) {
  menuGrid.innerHTML = "";
  const byTier = {};
  dishList.forEach((d) => {
    if (!byTier[d.tier]) byTier[d.tier] = [];
    byTier[d.tier].push(d);
  });

  const legendWrapper = document.createElement("div");
  legendWrapper.className = "legend";
  legend.forEach((item) => {
    const el = document.createElement("div");
    el.className = "legend-item";
    el.innerHTML = `<span class="legend-circle" style="background:var(--tier-${item.tier})"></span>${item.label}`;
    legendWrapper.appendChild(el);
  });
  menuGrid.appendChild(legendWrapper);

  Object.entries(byTier).forEach(([tier, tierDishes]) => {
    const section = document.createElement("div");
    section.className = "tier-section";
    const tierHeading = document.createElement("h3");
    tierHeading.textContent = `Tier ${tier}`;
    section.appendChild(tierHeading);

    tierDishes.forEach((d) => {
      const li = document.createElement("li");
      li.className = "menu-item";
      li.innerHTML = `
        <img src="${d.image}" alt="${d.name} ${d.price}" width="120" height="120" loading="lazy" style="border-radius:999px;object-fit:contain;">
        <div>
          <h4>${d.name}</h4>
          <p>${d.description}</p>
          <p><strong>${d.price}</strong></p>
        </div>
      `;
      li.querySelector("img").addEventListener("click", () => openPlateDialog(d));
      li.addEventListener("click", (e) => {
        if (e.target.tagName !== "IMG") addDishToCart(d);
      });
      section.appendChild(li);
    });
    menuGrid.appendChild(section);
  });
}

function openPlateDialog(dish) {
  // menu grid items sit outside the belt, so their dialog goes straight to the cart
  addDishToCart(dish);
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
  beltContainer.innerHTML = "";

  window.chefDishes = dishes; // read by belt.js when reduced motion preference changes
  const belt = initBelt(beltContainer, {
    dishes,
    container: beltContainer,
    autoplay: true,
    speed: 18000,
    onPlateSelect: (dish) => addDishToCart(dish),
  });
  return belt;
}

renderBelt();
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
    ? cartDrawer.querySelector('button, [href], input')
    : document.querySelector(".cart-btn");
  focusTarget?.focus();
}
document.querySelector(".cart-btn")?.addEventListener("click", toggleCartDrawer);
cartDrawer.querySelector(".close")?.addEventListener("click", toggleCartDrawer);
cartDrawer.addEventListener("click", (e) => {
  if (e.target === cartDrawer) toggleCartDrawer();
});

function renderCartItems() {
  cartItems.innerHTML = "";
  const items = cart.getItems();
  if (items.length === 0) {
    cartItems.innerHTML = `<p>Your cart is empty</p>`;
  } else {
    items.forEach((it) => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <span>${it.name}</span>
        <div class="qty-controls">
          <button class="qty-btn" data-id="${it.id}" data-delta="-1">−</button>
          <span class="qty">${it.qty}</span>
          <button class="qty-btn" data-id="${it.id}" data-delta="1">+</button>
        </div>
        <span>${it.price}</span>
      `;
      div.querySelectorAll(".qty-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (Number(btn.getAttribute("data-delta")) > 0) {
            cart.increment(it.id);
          } else {
            cart.remove(it.id);
          }
          updateCartBadge();
          renderCartItems();
        });
      });
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

if (footerWa && restaurant.whatsapp) {
  footerWa.href = `wa.me/${formatWhatsAppNumber(restaurant.whatsapp)}`;
  footerWa.textContent = `WhatsApp ${restaurant.name}`;
}
