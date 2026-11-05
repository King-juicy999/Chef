# DESIGN.md

## 1. Direction

"Nzu chalk". Warm ivory page like chalk paper, cocoa ink text, one bold hibiscus accent used sparingly. Light, premium, single theme: there is no dark mode and no `prefers-color-scheme` palette in this project any more. If a decoration does not make the food look better, it does not ship.

## 2. Colour tokens

All colours are CSS variables in `:root` from `css/styles.css`. Each token is declared twice, hex first and OKLCH after, so browsers without OKLCH support fall back to the hex.

```css
:root {
  --background: #F4EEE2;        /* page, warm ivory (shine shine chalk) */
  --card: #FBF7EE;              /* cards, chips, drawers */
  --border: #E2D7C3;            /* 1px hairlines */
  --ink: #261A14;               /* foreground, cocoa ink */
  --foreground: var(--ink);
  --muted: color-mix(in oklab, var(--card) 70%, var(--border));
  --muted-foreground: #6E5E52;  /* secondary text */
  --accent: #7A1E46;            /* hibiscus */
  --text-on-accent: #FFF6EC;
  --ring: var(--accent);
  /* tier ring colours, tiers 1 to 5 */
  --tier-1: #7A1E46;            /* hibiscus */
  --tier-2: #C2562B;            /* terracotta */
  --tier-3: #D9A21B;            /* ochre gold */
  --tier-4: #2F6F5E;            /* forest green */
  --tier-5: #3E4A9E;            /* indigo */
  /* belt furniture */
  --belt: #D3C5AE;
  --belt-side: #BFAF95;
  --rail: #FFFAF0;              /* chalk white rails */
  --island: #E6DBC8;
  --island-low: #DACDB7;
  --island-wall: #C8B99F;
  --rim-glow: #FFFDF8;          /* plate rim glow */
}
```

No pure `#000` or `#fff` anywhere in text or surfaces. Shadows and plate shades use warm ink `rgba(38, 26, 20, x)` or `var(--ink)`, never neutral black.

### Where the hibiscus accent is allowed

Sparingly, by rule: the See full menu pill, the header cart count badge, focus rings and active states, and prices (menu card price, dialog price, belt caption price, hero legend prices, cart line prices). Everything else is ivory and ink. The checkout and Add to order buttons stay ink pills.

## 3. Typography

- **Instrument Serif** for the hero heading, the restaurant name, dish names (menu cards, dialog title, belt caption title). Regular 400 only; the family has no other weight.
- **Instrument Sans** for body text, labels, buttons, chips and UI text: weights 400, 500, 600, 700.
- Two families only. Fallbacks: `"Instrument Serif", Georgia, serif` and `"Instrument Sans", system-ui, sans-serif`.
- Hero heading is a large serif at tight leading (`line-height: 1.05`, tracking about `-0.015em`). Small uppercase labels use `0.2em` letter spacing at 500 weight.
- Prices use a dedicated stack, `--font-price: "Instrument Sans", "Segoe UI", system-ui, sans-serif`, because neither Instrument family contains the naira sign (verified: no U+20A6 in the Google Fonts subsets). The browser falls back per glyph to a system font that has it. Prices keep `tabular-nums`.

## 4. Spacing, radius and shadows

- Pill shapes (`border-radius: 999px`) for buttons, chips and badges; 1rem radius for cards, 0.75rem for inputs.
- Thin 1px borders from `--border` define surfaces; shadows are warm and low opacity (`0 1px 2px rgba(38, 26, 20, 0.06)` on buttons, `0 8px 24px rgba(38, 26, 20, 0.08)` on card hover). The dialog card carries the one deep shadow.
- Generous spacing on an 8px scale. Header and main content cap at 80rem and centre.
- Every button gets `transform: scale(0.97)` (or `0.98`) on `:active` as press feedback; hovers are gated behind `@media (hover: hover) and (pointer: fine)`.

## 5. Signature detail: nzu chalk hairline

A short hand drawn hairline sits under the hero heading and under each menu group heading (`.section-heading::after` and `.tier-section h3::after`): an inline SVG stroke in muted ink at 38 percent opacity, quiet by design. Nothing else on the page is decorated.

## 6. Belt visuals

- Plates are round dishes on the loop, sized by their 3D position; geometry and physics live in `js/belt.js` and are not restyled from CSS.
- Each plate carries a tier ring in `--tier-1` to `--tier-5`. Menu card images wear the same ring (border set per item via `data-tier`).
- Belt surfaces come from the belt tokens above through the SVG's CSS variables, so white labelling still restyles the belt.
- The slat seams on the belt are soft: `js/belt.js` draws them in `var(--ink)` at `stroke-opacity: 0.18`, not the old hard black 42 percent. Keep that value soft if themes change.
- Plate shadows are light: track shadow at 0.14 ink, plate base shadow at 0.3, dialog figure shadow at 0.14 with a 24px blur.
- Plates get a faint `--rim-glow` halo via `drop-shadow` so the rim reads against the belt.
- One very subtle warm glow sits behind the belt (`.belt-stage::before`, a radial in `--tier-3` gold at 14 percent). It must stay barely there.
- Selected plates lift with a spring and a price chip in the card colour, ink text and a tier dot.
- Controls under the belt are small pill circles in the card colour with a hairline border; the paused state (`aria-pressed="true"`) is the one accent filled control.
- Dialog: plate left, details right, stacked on mobile; ink pill Add to order, price in accent.

## 7. Behaviour and motion

- Hover stops the belt; leaving resumes it. Drag or flick spins it with momentum that never becomes uncontrollable.
- Dialog opens with the plate flying from its belt position into the large plate slot, text panel fades in after; closing reverses.
- Cart drawer slides in with `cubic-bezier(0.32, 0.72, 0, 1)` over 300ms.
- UI transitions stay under or near 300ms and ease out. Nothing animates under `prefers-reduced-motion` beyond instant state changes; the belt still functions.

## 8. Responsive

- **Under 1024px**: one column, hero text centred above the belt, 1rem side padding; hairline centres itself; menu grid one column.
- **1024px and up**: two column hero, text left (label, heading with hairline, price legend, caption, accent pill), belt right; menu grid two or three columns; content caps at 80rem.
- Phone baseline: `viewport-fit=cover` with safe area padding on header, drawer and footer; single light `theme-color` `#F4EEE2`; `color-scheme: light`; 16px inputs so iOS never zooms; `touch-action: manipulation`; tap highlight off.

## 9. Accessibility

- Focus rings in hibiscus accent with visible offset on every interactive element.
- Full keyboard control of the belt (arrows, Enter, Escape, real buttons), dialog focus trap and focus return, `aria-label` per plate, live region caption.
- Verified contrast (WCAG): ink on page 14.65:1, muted ink on page 5.37:1, text on accent 9.35:1, ink on card 15.84:1, accent on page 8.65:1.
- Tier rings are a supporting cue, never the only signal.

## 10. Imagery

- Top down plate photos, transparent square canvas around 800px, webp. Card and plate images keep transparent backgrounds (no filled circles behind them).
- Broken images fall back to the neutral round placeholder rendered by JS.

## 11. Copy tone

- Warm, plain, friendly. Short sentences, the voice of a person behind the counter.
- Prices like ₦3,500 from `config/restaurant.js`, never hardcoded.
- No hyphens used as dashes in copy, UI, comments or documents. Sentence punctuation is commas, full stops, colons or parentheses.
