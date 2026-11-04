import { initBelt } from "./belt.js";
import { cart } from "./cart.js";
import { dishes, legend } from "../data/menu.js";
import { restaurant } from "../config/restaurant.js";

const BELT_SPEED = 60;

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

  const legendWrapper = document.createElement("div");
  legendWrapper.className = "legend";
  legend.forEach((item) => {
    const el = document.createElement("div");
    el.className = "legend-item";
    const circle = document.createElement("span");
    circle.className = "legend-circle";
    circle.style.background = `var(--tier-${item.tier})`;
    el.appendChild(circle);
    el.appendChild(document.createTextNode(item.label));
    legendWrapper.appendChild(el);
  });
  menuGrid.appendChild(legendWrapper);

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
      img.alt = `${d.name} ${d.price}`;
      img.width = 120;
      img.height = 120;
      img.loading = "lazy";
      img.style.borderRadius = "999px";
      img.style.objectFit = "contain";

      const content = document.createElement("div");
      const h4 = document.createElement("h4");
      h4.textContent = d.name;
      const pDesc = document.createElement("p");
      pDesc.textContent = d.description;
      const pPrice = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = d.price;
      pPrice.appendChild(strong);

      content.appendChild(h4);
      content.appendChild(pDesc);
      content.appendChild(pPrice);

      li.appendChild(img);
      li.appendChild(content);

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
