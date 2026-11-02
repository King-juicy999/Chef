/**
 * /data/menu.js Dishes and legend
 *
 * Each dish has:
 *   id          - short key, matches the image file name (without .webp)
 *   name        - display name
 *   description - one or two sentences
 *   price       - placeholder price in Naira (will be replaced per client)
 *   tier        - 1 to 5, maps to a ring colour in DESIGN.md
 *   image       - relative path to the .webp, normally images/dishes/<id>.webp
 *   details     - array of { label, value } for chips (portion, spice level, allergens)
 *
 * Legend maps tier numbers to human readable labels.
 */

export const legend = [
  { tier: 1, label: "Starter" },
  { tier: 2, label: "Main" },
  { tier: 3, label: "Special" },
  { tier: 4, label: "Premium" },
  { tier: 5, label: "Chef's Choice" },
]

export const dishes = [
  {
    id: "dodo",
    name: "Dodo",
    description: "Ripe fried plantain, golden and sweet.",
    price: "₦1,500",
    tier: 1,
    image: "images/dishes/dodo.webp",
    details: [
      { label: "Portion", value: "2 pcs" },
      { label: "Spice level", value: "Mild" },
    ],
  },
  {
    id: "puff-puff",
    name: "Puff Puff",
    description: "Light and airy deep‑fried dough, dusted with sugar.",
    price: "₦1,500",
    tier: 1,
    image: "images/dishes/puff-puff.webp",
    details: [
      { label: "Portion", value: "3 pcs" },
      { label: "Spice level", value: "Mild" },
    ],
  },
  {
    id: "moi-moi",
    name: "Moi Moi",
    description: "Steamed bean pudding wrapped in banana leaf.",
    price: "₦2,500",
    tier: 2,
    image: "images/dishes/moi-moi.webp",
    details: [
      { label: "Portion", value: "1 medium slice" },
      { label: "Spice level", value: "Medium" },
    ],
  },
  {
    id: "akara-pap",
    name: "Akara and Pap",
    description: "Spiced bean cake served with fermented corn pudding.",
    price: "₦2,500",
    tier: 2,
    image: "images/dishes/akara-pap.webp",
    details: [
      { label: "Portion", value: "2 pcs + pap bowl" },
      { label: "Spice level", value: "Medium" },
      { label: "Allergens", value: "Contains soy" },
    ],
  },
  {
    id: "jollof-chicken",
    name: "Jollof Rice and Chicken",
    description: "Tomato‑based rice with succulent chicken pieces.",
    price: "₦3,500",
    tier: 3,
    image: "images/dishes/jollof-chicken.webp",
    details: [
      { label: "Portion", value: "1.5 cups rice + 2 pc chicken" },
      { label: "Spice level", value: "Medium" },
    ],
  },
  {
    id: "fried-rice-turkey",
    name: "Fried Rice and Turkey",
    description: "Stir‑fried rice with turkey, peas and carrots.",
    price: "₦3,500",
    tier: 3,
    image: "images/dishes/fried-rice-turkey.webp",
    details: [
      { label: "Portion", value: "1.5 cups rice + 2 pc turkey" },
      { label: "Spice level", value: "Mild" },
    ],
  },
  {
    id: "suya",
    name: "Suya",
    description: "Spiced beef skewers grilled over open flame, served with onions and cabbage.",
    price: "₦4,500",
    tier: 4,
    image: "images/dishes/suya.webp",
    details: [
      { label: "Portion", value: "2 skewers" },
      { label: "Spice level", value: "Hot" },
      { label: "Allergens", value: "Contains nuts (peanut rub)" },
    ],
  },
  {
    id: "amala-ewedu-gbegiri",
    name: "Amala, Ewedu and Gbegiri",
    description: "Traditional trio of yam flour, jute leaf soup and melon seed soup.",
    price: "₦4,500",
    tier: 4,
    image: "images/dishes/amala-ewedu-gbegiri.webp",
    details: [
      { label: "Portion", value: "1 small bowl each" },
      { label: "Spice level", value: "Medium" },
    ],
  },
  {
    id: "pounded-yam-egusi",
    name: "Pounded Yam and Egusi",
    description: "Pounded yam with melon seed soup and assorted meats.",
    price: "₦6,000",
    tier: 5,
    image: "images/dishes/pounded-yam-egusi.webp",
    details: [
      { label: "Portion", value: "1 large swallow" },
      { label: "Spice level", value: "Hot" },
    ],
  },
  {
    id: "goat-pepper-soup",
    name: "Goat Meat Pepper Soup",
    description: "Hearty broth with goat meat, peppers and aromatic herbs.",
    price: "₦6,000",
    tier: 5,
    image: "images/dishes/goat-pepper-soup.webp",
    details: [
      { label: "Portion", value: "1 bowl" },
      { label: "Spice level", value: "Hot" },
      { label: "Allergens", value: "Contains fish stock" },
    ],
  },
]