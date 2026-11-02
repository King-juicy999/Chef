/**
 * /js/cart.js Cart logic: localStorage, totals, WhatsApp checkout
 *
 * Keeps cart state in localStorage under the key "chef-cart".
 * Exports functions the page can call:
 *   cart.add(dish)           - add a dish (with quantity 1)
 *   cart.remove(id)          - remove one dish by id
 *   cart.clear()             - empty the cart
 *   cart.getItems()          → array of { id, name, price, qty }
 *   cart.getTotal()          → total price string (or number of kobo)
 *   cart.openWhatsApp()      → opens wa.me with prefilled message
 *
 * The page is responsible for rendering the cart drawer UI from the
 * data returned by these functions.
 */

import { restaurant } from "../config/restaurant.js";

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function _save(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("cart: could not save to localStorage", e);
  }
}

// initialise from storage
let items = _load(); // array of { id, name, priceString, qty }

// ensure priceString is kept as‑is (we just store the price text from menu)

// ---- public API --------------------------------------------------------
const cart = {
  // add a dish; if already in cart, increment qty
  add(dish) {
    const existing = items.find((it) => it.id === dish.id);
    if (existing) {
      existing.qty += 1;
    } else {
      items.push({ ...dish, qty: 1 }); // dish already has price, image etc.
    }
    _save(items);
    // page should re‑render the drawer; we don't render here
    // so the caller can call renderCart()
    return this;
  },

  // remove one unit of a dish; if qty hits 0, remove entirely
  remove(id) {
    const existing = items.find((it) => it.id === id);
    if (existing) {
      if (existing.qty > 1) {
        existing.qty -= 1;
      } else {
        items = items.filter((it) => it.id !== id);
      }
      _save(items);
    }
    return this;
  },

  // empty the cart
  clear() {
    items = [];
    _save(items);
    return this;
  },

  // get the current items array
  getItems() {
    return items;
  },

  // total price as a string like "₦3,500" summed per item qty
  getTotal() {
    if (items.length === 0) return "₦0";
    // price strings are like "₦1,500"; strip the symbol and comma, sum as numbers
    const sum = items.reduce((total, it) => {
      const num = Number(it.price.replace(/[₦,]/g, ""));
      return total + num * it.qty;
    }, 0);
    // format with thousands separator and ₦ prefix
    return `₦${sum.toLocaleString()}`;
  },

  // open a prefilled WhatsApp message (wa.me) with the order details
  openWhatsApp() {
    if (items.length === 0) {
      const msg = document.createElement("div");
      msg.className = "inline-msg err";
      msg.textContent = "Your cart is empty. Add dishes before checking out.";
      document.body.prepend(msg);
      setTimeout(() => msg.remove(), 3000);
      return;
    }

    const number = restaurant?.whatsapp || "";
    if (!number) {
      return;
    }

    // format whatsapp number to digits only
    const digitsOnly = number.replace(/\D/g, "");

    // build the message text
    const lines = [];
    items.forEach((it) => {
      lines.push(`${it.name} × ${it.qty} - ${it.price}`);
    });
    const total = cart.getTotal();
    const message = `
      Order from ${restaurant?.name || "Chef's Table"}:
      ${lines.join("\n")}
      Total: ${total}
      Name: ____________________
      Phone: ____________________
      Address: ____________________

      Please confirm my order. Thank you!
    `.trim();

    const url = `wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    // also allow the page to react (e.g. close drawer)
    return this;
  },
};

// expose the restaurant config for the openWhatsApp use of restaurant number
Object.defineProperty(cart, "restaurant", {
  get: () => restaurant,
  set: (v) => { /* stored elsewhere; just keep ref */ },
});

export { cart };