# DESIGN.md

## 1. Direction

Warm, appetising, clean. Nigerian food is the hero and the interface stays quiet so the plates carry the page. The visual idea is a paper menu and a wooden table rather than an app dashboard: soft cream background, deep brown text, one warm orange accent, and photos doing the heavy lifting. If a decoration does not make the food look better, it does not ship.

## 2. Colour tokens

All colours are CSS variables in `:root` from `css/styles.css`, with a dark mode under `prefers-color-scheme`:

```css
:root {
  --background: #FBF6EE;        /* warm paper */
  --foreground: #2A1A12;        /* deep brown */
  --card: #FFFFFF;
  --muted: #F1E7D8;             /* soft sand */
  --muted-foreground: #7A6657;
  --border: #E6D8C4;
  --ring: #C2410C;              /* focus ring */
  --accent: #C2410C;            /* burnt orange */
  /* tier ring colours, chart 1 to 5 */
  --tier-1: #4C8C4A;            /* leaf green */
  --tier-2: #D9A21B;            /* gold */
  --tier-3: #E4761B;            /* pap orange */
  --tier-4: #C0392B;            /* palm red */
  --tier-5: #6B2D5C;            /* deep aubergine */
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #1D130C;
    --foreground: #F5EBDD;
    --card: #271B13;
    --muted: #2E211A;
    --muted-foreground: #B8A292;
    --border: #3D2C21;
    --ring: #F4874B;
    --accent: #E46A33;
    --tier-1: #5FA45D;
    --tier-2: #E5B444;
    --tier-3: #EF8A42;
    --tier-4: #D65445;
    --tier-5: #9A5290;
  }
}
```

The belt, rail and island colours are derived from `--foreground` and `--background` with `color-mix()`, matching how the original component derives its surfaces, so the belt always matches the theme even after white labelling changes the tokens.

## 3. Typography

- **Fraunces** for headings. A serif with personality, warm enough for food.
- **Manrope** for body, buttons, chips and captions.
- Both loaded from Google Fonts with `font-display: swap`.
- System fallback stacks so text is readable even if fonts fail: `"Fraunces", Georgia, serif` and `"Manrope", system-ui, sans-serif`.
- Two families only. No third font for accent cases.

## 4. Spacing, radius and shadows

- Pill shaped buttons and chips: `border-radius: 999px`. Nothing rectangular except the page edges and plates.
- Cards get a soft radius, around 16px, enough to feel round without being bubbly.
- Soft shadows only: low opacity, large blur, no hard edges. Example card shadow: `0 8px 24px rgba(42, 26, 18, 0.08)`. Plates on the belt get their own shadow tight to the plates so they sit on the belt and float slightly when lifted.
- Generous spacing. An 8px base scale (8, 16, 24, 32, 48, 64). Sections breathe; the page is not cramped because a menu page that feels calm sells more.
- Focus rings use `--ring` with visible offset, never removed.

## 5. Belt visuals

- Plates are round dishes rendered on the loop, sized by their 3D position so perspective comes for free out of geometry rather than a hack.
- Each plate carries a **tier ring**: a coloured ring around the plate whose colour comes from `--tier-1` through `--tier-5`, so a customer can see at a glance whether a dish is light, mid or premium from the legend.
- When a plate is selected it lifts off the belt with a spring and a **price chip** appears above it, showing the formatted Naira price.
- The **back lane** is smaller and shaded, lower opacity plus a soft darkening, so the front lane owns the eye.
- The rail has **slat seams**: repeating subtle lines across the belt top, like painted wooden slats, done with CSS gradients, not images.
- The dialog layout puts the large plate on the left and the details on the right: name, description, price, tier, detail chips like portion and spice level, an Add to order button and a close button. On mobile it stacks: plate on top, details below.

## 6. Behaviour and motion

- Hover stops the belt. Leaving resumes it.
- Drag or flick spins it. A small flick imparts momentum, but the belt never becomes uncontrollable.
- The lifted plate springs up with the spring physics already described in PROJECT.md, not a linear ease.
- Dialog opens with the plate flying from its belt position into the large plate slot, then the text panel fades in after. Closing reverses the flight back to the belt.
- The cart drawer slides in from the right on desktop, from beneath the header edge on mobile.
- Everything animates nothing under `prefers-reduced-motion`: the belt does not autoplay, lifted plates appear in place without spring, the dialog opens without the flight, the drawer appears without slide, and transitions collapse to short fades only. The belt still functions fully.

## 7. Responsive

Mobile first, then scale up:

- **Under 480px**: the narrow layout. Belt takes almost the full width, controls sit below it, menu grid is one column, dialog is stacked vertically.
- **Under 1024px**: stacked layout. Belt first, then menu, then footer, all in one column. Two finger gestures still work beside tap.
- **1024px and up**: two column hero with the text (eyebrow, heading, caption, See full menu button) on the left and the belt on the right. Menu grid becomes two or three columns.

## 8. Accessibility

- Visible focus rings on every interactive element, using `--ring` and `outline-offset`.
- Full keyboard control of the belt: left and right arrows move between plates, Enter opens the dialog, Escape closes it, and the previous, next and pause buttons are real buttons.
- The dialog traps focus while open, focuses its first useful element on open, and returns focus to the plate that opened it on close.
- `aria-label` on each plate, so a screen reader hears the dish name, price and tier instead of "image".
- The belt caption is a live region so changes like "belt paused" are announced.
- Contrast is sufficient in both light and dark themes for text, chips and tier rings on their backgrounds. Tier rings are an additional cue, never the only one, because colour alone is not an accessible signal.

## 9. Imagery

- Top down plate photos shot with consistent lighting: one warm key light from the top so every plate reads the same way.
- Transparent square canvas, around 800px, plate centred and round, no table surface or background bleeding in.
- webp format, compressed for slow connections.
- The same framing for every dish, so the belt looks like one kitchen made all of it.
- Broken images fall back to a neutral round plate placeholder rendered by JS, showing the dish name, so a missing file is never an empty box on the belt or in the menu.

## 10. Copy tone

- Warm, plain and friendly, written the way a Nigerian restaurant would speak to its customers. Direct, confident, no marketing filler. "Need to eat now?" from a caption, not "Discover a delightful culinary journey".
- Short sentences. The voice of a person behind the counter, not a brand deck.
- Prices formatted like ₦3,500, in Naira, always with a thousands separator, using the currency value from `config/restaurant.js` so the symbol is never hardcoded.
- No hyphens used as dashes anywhere in the copy, in the UI, in comments or in documents. Hyphens inside normal compound words are fine. Sentence punctuation is commas, full stops, colons or parentheses instead.
