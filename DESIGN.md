# DESIGN.md

## 1. Direction

Premium, neutral, restrained. The look follows the original 21st.dev sushi conveyor demo: a near black or near white canvas, quiet greys, and the food photos and four tier accent colours doing the only colour work on the page. No warm or brown tones anywhere; if a decoration does not make the food look better, it does not ship.

## 2. Colour tokens

All colours are CSS variables in `:root` from `css/styles.css`, with a dark mode under `prefers-color-scheme`. Both palettes share the same tier ring colours; the neutrals are effectively a zinc scale:

```css
:root {
  --background: #fafafa;
  --foreground: #0a0a0a;
  --card: #ffffff;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --border: #e4e4e7;
  --ring: #3b82f6;              /* focus ring, blue */
  --accent: #3b82f6;
  /* tier ring colours, tiers 1 to 5 */
  --tier-1: #3b82f6;            /* blue */
  --tier-2: #10b981;            /* green */
  --tier-3: #f59e0b;            /* amber */
  --tier-4: #a855f7;            /* violet */
  --tier-5: #f43f5e;            /* rose */
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0b0b0c;
    --foreground: #fafafa;
    --card: #18181b;
    --muted: #27272a;
    --muted-foreground: #a1a1aa;
    --border: #27272a;
    --ring: #60a5fa;
    --accent: #60a5fa;
  }
}
```

The tier variables are identical in both schemes; only the neutrals switch.

### Belt surfaces

The belt reads as furniture: a neutral dark grey belt with light grey rails in dark mode, a light grey belt with white rails in light mode. The surface colours stay derived from the theme tokens so white labelling still restyles the belt automatically:

```css
/* :root (light) */
--belt: color-mix(in oklab, var(--foreground) 6%, var(--background));   /* light grey belt */
--belt-side: color-mix(in oklab, var(--foreground) 12%, var(--background));
--rail: color-mix(in oklab, white 88%, var(--muted-foreground));        /* white rails */
--island: color-mix(in oklab, var(--foreground) 8%, var(--background));
--island-low: color-mix(in oklab, var(--foreground) 4%, var(--background));
--island-wall: color-mix(in oklab, var(--foreground) 18%, var(--background));

/* dark scheme */
--belt: color-mix(in oklab, var(--foreground) 9%, var(--background));   /* dark grey belt */
--belt-side: color-mix(in oklab, var(--foreground) 4%, var(--background));
--rail: color-mix(in oklab, var(--muted-foreground) 60%, var(--background)); /* light grey rails */
--island: color-mix(in oklab, var(--foreground) 3%, var(--background));
--island-low: color-mix(in oklab, var(--foreground) 1%, var(--background));
--island-wall: color-mix(in oklab, var(--foreground) 16%, var(--background));
```

There is no decorative glow behind the belt. The old radial `.belt-glow` was removed; the page background does the work.

## 3. Typography

- **Inter** everywhere, headings and body. Loaded from Google Fonts with `font-display: swap`, system `system-ui` fallback.
- No serif fonts anywhere.
- Headings are medium weight (500 to 600), never bold poster weight, with tight tracking: about `-0.02em` on headings, `-0.03em` on the hero h1.
- Body stays near 0 tracking. Small uppercase labels (section label, tier headings) use `0.2em` letter spacing at 500 weight.
- Numbers that line up (prices, counts, the dialog counter) use `font-variant-numeric: tabular-nums`.

## 4. Spacing, radius and shadows

- Pill shapes (`border-radius: 999px`) for every button, chip and badge; 1rem radius for cards and 0.75rem for inputs.
- Thin 1px borders from `--border` define surfaces; shadows stay soft and low opacity (`0 1px 2px rgba(0,0,0,0.05)` on buttons, `0 8px 24px rgba(0,0,0,0.06)` on card hover). The dialog card carries the one deep shadow.
- Generous spacing on an 8px scale. The header and main content cap at 80rem and centre.
- Focus rings use `--ring` (blue) with visible offset, never removed, plus every button gets `transform: scale(0.97)` on `:active` as press feedback.

## 5. Belt visuals

- Plates are round dishes rendered on the loop, sized by their 3D position so perspective comes for free out of geometry rather than a hack.
- Each plate carries a **tier ring**: a coloured ring around the plate whose colour comes from `--tier-1` through `--tier-5`.
- Under the hero heading sits a **price legend**: for each tier, a ringed dot in the tier colour followed by the tier's price, rendered by `main.js` from `data/menu.js`. No tier words (Starter, Main, and so on) are displayed; the colours carry the meaning with the price next to them.
- When a plate is selected it lifts off the belt with a spring and a **price chip** appears above it.
- The back lane is smaller and shaded so the front lane owns the eye.
- The rail keeps its slat seams as CSS/SVG gradients, not images.
- The control buttons under the belt are small ghost circles: transparent background, hairline border in mixed foreground, muted icon, colour fill on hover.
- The dialog keeps plate left, details right, stacked on mobile, with the solid foreground pill as the Add to order button.

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
- Contrast held in both themes: `#a1a1aa` on `#18181b` and `#71717a` on `#fafafa` for secondary text, tier rings never the only signal.

## 9. Imagery

- Top down plate photos with one consistent key light, transparent square canvas around 800px, webp compressed.
- Broken images fall back to a neutral round placeholder rendered by JS.

## 10. Copy tone

- Warm, plain and friendly. Direct, confident, no marketing filler.
- Short sentences. The voice of a person behind the counter.
- Prices formatted like ₦3,500, in Naira with a thousands separator, from `config/restaurant.js`.
- No hyphens used as dashes anywhere. Sentence punctuation is commas, full stops, colons or parentheses instead.
