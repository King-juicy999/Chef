# DESIGN.md

## 1. Direction

"Nzu chalk" - warm ivory page like chalk, cocoa ink text, one bold hibiscus accent. Light and premium.
This replaces the previous neutral grey and blue theme completely. Single light theme only - no dark mode.
Warm browns are used only as accent tier rings; every decoration should make the food look better, nothing else ships.

## 2. Colour tokens

All colours are CSS variables in `:root` from `css/styles.css`. OKLCH equivalents follow each hex value as fallback.
No pure #000 or #fff for text or surfaces.

```css
:root {
  --background: #F4EEE2;      /* page: warm ivory chalk */
  --foreground: #261A14;      /* ink: cocoa text */
  --card: #FBF7EE;            /* card surface */
  --muted: #E2D7C3;           /* card border / placeholder */
  --muted-foreground: #6E5E52;/* muted ink */
  --border: #E2D7C3;          /* card border */
  --ring: #7A1E46;            /* focus ring, accent */
  --accent: #7A1E46;          /* hibiscus accent */

  /* accent text on accent */
  --accent-foreground: #FFF6EC;

  /* tier ring colours, tiers 1 to 5 */
  --tier-1: #7A1E46;          /* hibiscus */
  --tier-2: #C2562B;          /* burnt sienna */
  --tier-3: #D9A21B;          /* mustard */
  --tier-4: #2F6F5E;          /* sage green */
  --tier-5: #3E4A9E;          /* indigo */

  /* belt surfaces - light grey warm belt with white rails */
  --belt: #D3C5AE;
  --belt-side: #BFAF95;
  --rail: #FFFAF0;
  --island: #E6DBC8;
  --island-low: #DACDB7;
  --island-wall: #C8B99F;

  --belt-glow: color-mix(in oklab, var(--accent) 3%, transparent);
}
```

No `prefers-color-scheme` dark palette - single light theme only.

### Belt surfaces

The belt reads as furniture: a warm grey belt with ivory rails. Belt slat seams are soft - ink (#261A14) at about 18 percent opacity, not black at 42 percent. Plate shadows are lighter than before. No decorative glow behind the belt (the old radial `.belt-glow` was removed); the page background does the work.

## 3. Typography

Two families only:

- **Instrument Serif** - hero heading, dish names in menu grid and dialog, section headings. Loaded from Google Fonts with `display=swap`, system serif fallback.
- **Instrument Sans** - body, labels, buttons, prices, cart, drawer, footer. Loaded from Google Fonts with `display=swap`, system `system-ui` fallback.

No Inter anywhere. No serif mixed into body copy except where the design calls for Instrument Serif.

- Headings are medium weight (500 to 600), tight tracking: about `-0.02em` on headings, `-0.03em` on the hero h1.
- Body stays near 0 tracking. Small uppercase labels (section label, tier headings) use `0.2em` letter spacing at 500 weight.
- Numbers that line up (prices, counts, the dialog counter) use `font-variant-numeric: tabular-nums`.
- Check that the naira sign (₦) renders in the chosen fonts; if it does not, set prices to fall back to a system font that has it.

## 4. Spacing, radius and shadows

- Pill shapes (`border-radius: 999px`) for every button, chip and badge; 1rem radius for cards and 0.75rem for inputs.
- Thin 1px borders from `--border` define surfaces; shadows stay soft and low opacity (`0 1px 2px rgba(0,0,0,0.05)` on buttons, `0 8px 24px rgba(0,0,0,0.06)` on card hover). The dialog card carries the one deep shadow.
- Generous spacing on an 8px scale. The header and main content cap at 80rem and centre.
- Focus rings use `--ring` (hibiscus) with visible offset, never removed, plus every button gets `transform: scale(0.97)` on `:active` as press feedback.

## 5. Belt visuals

- Plates are round dishes rendered on the loop, sized by their 3D position so perspective comes for free out of geometry rather than a hack.
- Each plate carries a tier ring: a coloured ring around the plate whose colour comes from `--tier-1` through `--tier-5`.
- Under the hero heading sits a price legend: for each tier, a ringed dot in the tier colour followed by the tier's price, rendered by `main.js` from `data/menu.js`. No tier words; the colours carry the meaning with the price next to them.
- When a plate is selected it lifts off the belt with a spring and a price chip appears above it.
- Price chips use the card colour with ink text and a tier dot.
- The back lane is smaller and shaded so the front lane owns the eye. Plate shade is `--foreground` at 5 percent opacity (lighter than before).
- The rail keeps its slat seams as CSS/SVG gradients, not images. Seam colour is ink at 18 percent opacity.
- The control buttons under the belt are small ghost circles: transparent background, hairline border in mixed foreground, muted icon, colour fill on hover.
- The dialog keeps plate left, details right, stacked on mobile, with the solid hibiscus pill as the Add to order button.
- A faint warm glow behind the belt is kept very subtle.

## 6. Behaviour and motion

- Hover stops the belt. Leaving resumes it.
- Drag or flick spins it. A small flick imparts momentum, but the belt never becomes uncontrollable.
- The lifted plate springs up with the spring physics already described in PROJECT.md, not a linear ease.
- Dialog opens with the plate flying from its belt position into the large plate slot, then the text panel fades in after. Closing reverses the flight.
- The cart drawer slides in from the right with a drawer curve `cubic-bezier(0.32, 0.72, 0, 1)`.
- Hover styles are gated behind `@media (hover: hover) and (pointer: fine)` so touch devices only ever get `:active` press feedback. UI transitions stay under 300ms and ease out.
- Under `prefers-reduced-motion`: the belt does not autoplay, lifted plates appear in place, the dialog opens without the flight, the drawer appears without slide, and transitions collapse to nothing. The belt still functions fully.

## 7. Responsive

Mobile first, then scale up:

- **Under 480px**: the narrow geometry. Belt takes almost the full width, controls sit below it.
- **Under 1024px**: one column, hero text centred above the belt with 1rem side padding. Menu grid is one column.
- **1024px and up**: two column hero, text left (label, heading, price legend, caption, button) and belt right, max 80rem. Menu grid becomes two or three columns.
- Phone baseline: `viewport-fit=cover` with safe area padding on the header, drawer and footer; per scheme `theme-color` meta tags; 16px inputs so iOS never zooms; `touch-action: manipulation` on controls; tap highlight off.

## 8. Accessibility

- Visible focus rings on every interactive element, using `--ring` and `outline-offset`.
- Full keyboard control of the belt: left and right arrows, Enter opens the dialog, Escape closes, and previous, next and pause are real buttons.
- Dialog focus trap, focus return, and `aria-label` per plate.
- The belt caption is a live region.
- Contrast held in the light theme: ink #261A14 on page #F4EEE2, muted ink #6E5E52 on page, accent text #FFF6EC on accent #7A1E46. Each pair at least 4.5:1. Tier rings never the only signal.

## 9. Imagery

- Top down plate photos with one consistent key light, transparent square canvas around 800px, webp compressed.
- Broken images fall back to a neutral round placeholder rendered by JS.
- Plate image background stays transparent; plate rim glow #FFFDF8.

## 10. Copy tone

- Warm, plain and friendly. Direct, confident, no marketing filler.
- Short sentences. The voice of a person behind the counter.
- Prices formatted like ₦3,500, in Naira with a thousands separator, from `config/restaurant.js`.
- No hyphens used as dashes anywhere. Sentence punctuation is commas, full stops, colons or parentheses instead.

## 11. Chalk detail

A very fine paper grain sits on the page background, and hand drawn nzu style hairlines appear under section headings. Both are quiet and never compete with the food photos.