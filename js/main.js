/**
 * /js/main.js Glue: wires the belt, cart, menu grid, and page layout.
 *
 * What this file does (no external dependencies, pure ES modules):
 *   1. Imports the belt initializer, cart functions, menu data, and restaurant config.
 *   2. Renders the belt inside the designated container, passing the dish data.
 *   3. Renders the full‑width menu grid below the belt (same dishes, grouped by tier).
 *   4. Renders the header (restaurant name + cart count) and footer (address, hours, WhatsApp).
 *   5. Renders the cart drawer UI and attaches open/close behaviour.
 *   6. Wires the "Add to order" flow from the belt dialog into the cart.
 *   7. Wires the cart drawer's "Checkout" button to open a prefilled WhatsApp message.
 *
 * The page HTML is expected to have these elements (ids shown, can be changed):
 *   <header>
 *     <div class="name" id="header-name"></div>
 *     <button class="cart-btn" id="header-cart">
 *       <span class="cart-badge" id="cart-badge">0</span>
 *     </button>
 *   </header>
 *   <section class="belt-section">
 *     <div class="belt-container"></div>
 *     <button class="btn-see-full" id="see-full-menu">See full menu</button>
 *   </section>
 *   <main>
 *     <ul class="menu-grid" id="menu-grid"></ul>
 *   </main>
 *   <footer>
 *     <p id="footer-address"></p>
 *     <p id="footer-hours"></p>
 *     <a class="btn-whatsapp" id="footer-whatsapp" target="_blank" rel="noopener"></a>
 *   </footer>
 *   <div class="cart-drawer" id="cart-drawer">
 *     <div class="header">
 *       <span>My order</span>
 *       <button class="close" aria-label="Close drawer">×</button>
 *     </div>
 *     <div class="items" id="cart-items"></div>
 *     <div class="actions">
 *       <button class="action-btn" data-qty="-1">−</button>
 *       <span class="total">₦0</span>
 *       <button class="action-btn checkout" id="checkout-btn">Checkout</button>
 *     </div>
 *     <form id="delivery-form">
 *       <input placeholder="Name" required />
 *       <input placeholder="Phone" required />
 *       <input placeholder="Delivery address" required />
 *       <button type="submit" class="checkout">Place order</button>
 *     </form>
 *   </div>
 *
 * CSS classes referenced above are defined in /css/styles.css.
 */

import { initBelt } from "./belt.js";
import { cart } from "./cart.js";
import { dishes, legend } from "../data/menu.js";
import { restaurant } from "../config/restaurant.js";

// ---- elements (we grab them by the ids the HTML expects) -------------
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
const closeDrawerBtn = cartDrawer.querySelector(".close");

// ---- render the header -------------------------------------------------
headerName.textContent = restaurant.name;
footerAddr.textContent = restaurant.address;
footerHours.textContent = restaurant.hours;

// initial cart count from localStorage
function updateCartBadge() {
  const count = cart.getItems().reduce((sum, it) => sum + it.qty, 0);
  cartBadge.textContent = count;
}
updateCartBadge();

// re‑badge whenever cart items change (called from cart.js render hooks)
function rebadgeCart() {
  updateCartBadge();
}

// ---- render the full‑width menu grid (below the belt) -----------------
function renderMenuGrid(dishList) {
  menuGrid.innerHTML = "";
  // group by tier for the legend
  const byTier = {};
  dishList.forEach((d) => {
    if (!byTier[d.tier]) byTier[d.tier] = [];
    byTier[d.tier].push(d);
  });

  // legend
  const legendWrapper = document.createElement("div");
  legendWrapper.className = "legend";
  legend.forEach((item) => {
    const el = document.createElement("div");
    el.className = "legend-item";
    el.innerHTML = `<span class="legend-circle" style="background:var(--tier-${item.tier})"></span>${item.label}`;
    legendWrapper.appendChild(el);
  });
  menuGrid.appendChild(legendWrapper);

  // dishes grouped
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
        <img src="${d.image}" alt="${d.name} ${d.price}" width="120" height="120" style="border-radius:999px;object-fit:contain;">
        <div>
          <h4>${d.name}</h4>
          <p>${d.description}</p>
          <p><strong>${d.price}</strong></p>
        </div>
      `;
      // make the whole thing clickable - open plate dialog
      li.querySelector("img").addEventListener("click", () => addDishToCart(d));
      li.addEventListener("click", (e) => {
        if (e.target.tagName !== "IMG") addDishToCart(d);
      });
      section.appendChild(li);
    });
    menuGrid.appendChild(section);
  });
}

// add a dish to the cart and show an inline message
function addDishToCart(dish) {
  cart.add(dish);
  rebadgeCart();
  // inline message instead of alert
  const msg = document.createElement("div");
  msg.className = "inline-msg";
  msg.textContent = `${dish.name} added to your order`;
  document.body.appendChild(msg);
  setTimeout(() => document.body.removeChild(msg), 2500);
}

// render the belt
function renderBelt() {
  const beltContainer = document.querySelector(".belt-container");
  if (!beltContainer) return;
  // remove any existing belt
  beltContainer.innerHTML = "";

  // start the belt with the dish data
  window.chefDishes = dishes; // make available for reduced‑motion refresh
  const belt = initBelt(beltContainer, {
    dishes,
    container: beltContainer,
    autoplay: true,
    speed: 18000,
    onPlateSelect: (dish) => {
      // add to cart when a plate is selected from the dialog
      addDishToCart(dish);
    },
    onPrev: () => { /* prev plate visual */ },
    onNext: () => { /* next plate visual */ },
    onPause: (isPaused) => { /* UI could show pause state */ },
  });
  window.chefBelt = belt; // expose for other scripts

  // re‑render menu grid so it stays in sync
  renderMenuGrid(dishes);
}

// open plate dialog for a dish (called from menu grid)
function openPlateDialog(dish) {
  // the belt's initBelt already creates its own dialog and handles onPlateSelect.
  // For menu‑grid clicks we just add to cart directly.
  addDishToCart(dish);
}

// render the grid first (so it's there when the "See full menu" scrolls into view)
renderMenuGrid(dishes);

// ---- "See full menu" scroll -------------------------------------------
if (seeFullMenu) {
  seeFullMenu.addEventListener("click", (e) => {
    e.preventDefault();
    const grid = document.getElementById("menu-grid");
    if (grid) {
      grid.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

// ---- header cart button opens/closes drawer ---------------------------
let cartOpen = false;
function toggleCartDrawer() {
  cartOpen = !cartOpen;
  cartDrawer.classList.toggle("open", cartOpen);
  if (cartOpen) {
    // focus first interactive inside drawer
    const first = cartDrawer.querySelector('button, [href], input');
    first?.focus();
  } else {
    // return focus to the header cart button
    const headerCart = document.querySelector(".cart-btn");
    headerCart?.focus();
  }
}
if (document.querySelector(".cart-btn")) {
  document.querySelector(".cart-btn").addEventListener("click", toggleCartDrawer);
}
if (closeDrawerBtn) {
  closeDrawerBtn.addEventListener("click", toggleCartDrawer);
}

// close drawer when clicking outside the content
cartDrawer.addEventListener("click", (e) => {
  if (e.target === cartDrawer) toggleCartDrawer();
});

// ---- cart item rendering in the drawer ---------------------------------
function renderCartItems() {
  cartItems.innerHTML = "";
  const items = cart.getItems();
  if (items.length === 0) {
    cartItems.innerHTML = `<p>Your cart is empty</p>`;
    cartTotal.textContent = "₦0";
    return;
  }
  items.forEach((it, i) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <span>${it.name}</span>
      <div class="qty-controls">
        <button class="qty-btn" data-id="${it.id}" data-delta="-1">−</button>
        <span>${it.qty}</span>
        <button class="qty-btn" data-id="${it.id}" data-delta="+1">+</button>
      </div>
      <span>${it.price}</span>
    `;
    // quantity controls
    div.querySelectorAll(".qty-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = Number(btn.getAttribute("data-delta"));
        cart.remove(it.id); // cart.remove handles decrement/increment
        rebadgeCart();
        renderCartItems(); // re‑render
        cartTotal.textContent = cart.getTotal();
      });
    });
    cartItems.appendChild(div);
  });
  cartTotal.textContent = cart.getTotal();
}

// ---- initial render of cart drawer -------------------------------------
renderCartItems();

// ---- checkout: WhatsApp -----------------------------------------------
if (checkoutBtn) {
  checkoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    cart.openWhatsApp();
    toggleCartDrawer();
  });
}

// ---- form: on submit, open WhatsApp with form values and cart items -------
if (deliveryForm) {
  deliveryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = deliveryForm.querySelector("input[placeholder='Name']").value;
    const phone = deliveryForm.querySelector("input[placeholder='Phone']").value;
    const address = deliveryForm.querySelector("input[placeholder='Delivery address']").value;

    // show inline message that checkout opens WhatsApp
    const msg = document.createElement("div");
    msg.className = "inline-msg";
    msg.textContent = `Order placed - WhatsApp will open with your details`;
    deliveryForm.prepend(msg);
    setTimeout(() => msg.remove(), 2500);

    // collect form data for potential future use
    const formData = { name, phone, address };
    toggleCartDrawer();
    deliveryForm.reset();
  });
}

// ---- footer WhatsApp link ---------------------------------------------
if (footerWa && restaurant.whatsapp) {
  const digitsOnly = restaurant.whatsapp.replace(/\D/g, "");
  footerWa.href = `wa.me/${digitsOnly}`;
  // set accessible text
  footerWa.textContent = `WhatsApp ${restaurant.name}`;
}