# PROJECT.md

## 1. What Chef is

Chef is a white label food ordering website template for Nigerian restaurants. The plan is to sell it to restaurants that want a simple online menu and ordering flow without paying for a fully custom build.

The target restaurant type is not decided yet. It could suit a buka, a fast food spot or a caterer, so every restaurant specific detail must be easy to swap per client:

- Name, tagline, logo, colours and contact details live in `/config/restaurant.js`.
- Dishes, prices and images live in `/data/menu.js` and `/images/dishes/`.
- No dish name, price, phone number or address appears in layout or component code.

## 2. Stack

Plain HTML, CSS and JavaScript only.

- JavaScript is native ES modules loaded with `type="module"`.
- No React, no Next.js, no Tailwind, no npm, no build step, no bundler.
- The site must run by opening the folder through any static host: Vercel, Netlify or GitHub Pages.

## 3. Folder structure

| Path | Responsibility |
| --- | --- |
| `index.html` | The single page. Header, belt section, menu grid, footer, cart drawer and dialog markup. Loads the ES modules. |
| `css/styles.css` | All styling. Design tokens in `:root` as defined in DESIGN.md, then layout, components and motion. |
| `js/belt.js` | The conveyor belt component. Geometry, physics, rendering, dragging, dialog opening and controls. |
| `js/cart.js` | Cart state. localStorage persistence, quantity changes, totals and the WhatsApp checkout message. Kept separate so Paystack can replace or join WhatsApp later. |
| `js/main.js` | Glue code. Renders the belt from menu data, wires buttons, renders the menu grid, links cart to the drawer. |
| `config/restaurant.js` | Restaurant identity and settings per client. |
| `data/menu.js` | The dishes and tier legend. |
| `images/dishes/` | Top down plate photos, one per dish, webp. |

## 4. Conveyor belt

The hero is a conveyor belt of food plates, ported from the 21st.dev sushi conveyor menu by dhxwhy: https://21st.dev/@dhxwhy/components/sushi-conveyor-menu. That component is React. In this repo it is rewritten in vanilla JavaScript in `/js/belt.js`, keeping the geometry and physics:

- Stadium shaped loop with perspective projection, so plates travel an oval path.
- Back lane plates are smaller and shaded, front lane plates are full size.
- Spring physics for the lifted plate.
- Hover stops the belt, drag or flick spins it.
- Plates lift off the belt when selected, with a price chip above the lifted plate.
- Autoplay by default.
- Previous, pause and next controls.
- A dialog where the plate flies from the belt into a large view with an Add to order button.
- Keyboard support for navigation and the dialog.
- IntersectionObserver pause when the belt is off screen.
- `prefers-reduced-motion` support: all motion is off or reduced.

## 5. Menu data

`/data/menu.js` exports:

- `dishes`: an array of objects with `id`, `name`, `description`, `price`, `tier` (1 to 5), `image` path, and `details` chips such as portion, spice level and allergens.
- `legend`: what each tier means, shown near the menu grid.

The starting 10 dishes, with placeholder prices:

| Dish | Price | Tier |
| --- | --- | --- |
| Dodo (fried plantain) | ₦1,500 | 1 |
| Puff puff | ₦1,500 | 1 |
| Moi moi | ₦2,500 | 2 |
| Akara and pap | ₦2,500 | 2 |
| Jollof rice and chicken | ₦3,500 | 3 |
| Fried rice and turkey | ₦3,500 | 3 |
| Suya | ₦4,500 | 4 |
| Amala, ewedu and gbegiri | ₦4,500 | 4 |
| Pounded yam and egusi | ₦6,000 | 5 |
| Goat meat pepper soup | ₦6,000 | 5 |

Prices are placeholders. They get replaced per client, which is one more reason they only ever appear in `/data/menu.js`.

## 6. Page layout

- **Header**: restaurant name on the left, cart button with item count on the right.
- **Belt section**: eyebrow "Lunch belt", heading "Fresh Nigerian food, turning right on the page.", caption "Hover to stop the belt, flick to spin it, pick a plate to order." and a "See full menu" button that smooth scrolls to the menu grid.
- **Menu grid**: the same dishes grouped by tier 1 to 5 with the legend, so customers who do not want the belt can still browse.
- **Footer**: address, opening hours and a WhatsApp link to message the restaurant directly.

## 7. Ordering

1. Add to order puts the dish in a cart saved in `localStorage`.
2. The cart drawer shows items, quantities with plus and minus, and the total in Naira.
3. Below the items is a form for name, phone number and delivery address.
4. Checkout opens a prefilled WhatsApp message (`wa.me`) addressed to the restaurant's number, listing the items, total and delivery details.

`cart.js` stays separate from everything else so Paystack can be added later without touching the belt or the layout.

## 8. White label config

`/config/restaurant.js` holds everything that changes per client:

- Restaurant name
- Tagline
- Logo path
- WhatsApp number
- Address
- Opening hours
- Accent colour
- Currency

Changing to a new client means editing this file and `/data/menu.js` and dropping in new dish images. Nothing else should need touching.

## 9. Priorities

- Mobile first. Most Nigerian food customers order on phones, so the phone layout is designed first and the desktop layout is a bonus, not the other way round.
- Fast on slow connections. Compressed webp images, lazy loading, and no libraries at all, so the page is light enough for a weak network.
- Zero setup pain. A new client gets a working site by editing two files.

## 10. Status and build order

Nothing is built yet. The repo currently holds only these documents and the README.

Build order:

1. Belt first, ported and running in vanilla JS. Confirm it spins before anything else is built on top.
2. Menu data in `/data/menu.js`.
3. Cart with localStorage and WhatsApp checkout.
4. Page layout around the working belt and cart.
5. Config extraction once, near the end, when the real names of things are known.
