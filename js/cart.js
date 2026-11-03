import { restaurant } from "../config/restaurant.js";

const STORAGE_KEY = "chef-cart";

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("cart: could not read localStorage", e);
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

// item shape: { id, name, price, qty }, price kept as the menu price string
let items = _load();

const cart = {
  add(dish) {
    const existing = items.find((it) => it.id === dish.id);
    if (existing) {
      existing.qty += 1;
    } else {
      items.push({ ...dish, qty: 1 });
    }
    _save(items);
    return this;
  },

  // removes one unit, and the item itself once the last one is gone
  remove(id) {
    const existing = items.find((it) => it.id === id);
    if (!existing) return this;
    if (existing.qty > 1) {
      existing.qty -= 1;
    } else {
      items = items.filter((it) => it.id !== id);
    }
    _save(items);
    return this;
  },

  increment(id) {
    const existing = items.find((it) => it.id === id);
    if (existing) {
      existing.qty += 1;
      _save(items);
    }
    return this;
  },

  clear() {
    items = [];
    _save(items);
    return this;
  },

  getItems() {
    return items;
  },

  // menu prices are strings like "₦1,500", so strip symbol and separator to sum
  getTotal() {
    const sum = items.reduce((total, it) => {
      const num = Number(it.price.replace(/[₦,]/g, ""));
      return total + num * it.qty;
    }, 0);
    return restaurant.currency + sum.toLocaleString();
  },

  openWhatsApp(formData = {}) {
    if (items.length === 0) {
      const msg = document.createElement("div");
      msg.className = "inline-msg err";
      msg.textContent = "Your cart is empty. Add dishes before checking out.";
      document.body.prepend(msg);
      setTimeout(() => msg.remove(), 3000);
      return this;
    }

    const digitsOnly = formatWhatsAppNumber(restaurant?.whatsapp || "");
    if (!digitsOnly) return this;

    const lines = items.map((it) => `${it.name} × ${it.qty}, ${it.price}`);
    const blank = "____________________";
    const message = [
      `Order from ${restaurant?.name || "Chef"}:`,
      ...lines,
      `Total: ${cart.getTotal()}`,
      `Name: ${formData.name || blank}`,
      `Phone: ${formData.phone || blank}`,
      `Address: ${formData.address || blank}`,
      "",
      "Please confirm my order. Thank you!",
    ].join("\n");

    window.open(`https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    return this;
  },
};

export function formatWhatsAppNumber(number) {
  return String(number || "").replace(/\D/g, "");
}

export { cart };
