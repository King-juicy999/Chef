# CLAUDE.md

## Rule

For any front end design work, always use your available skills before and while writing UI code. Check the full list of installed skills and use every one that is relevant to front end design, UI, UX, layout, styling, motion and polish. Do not limit yourself to a few. Say which skills you used.

Chef is a white label food ordering website template for Nigerian restaurants, built with plain HTML, CSS and JavaScript.

Before starting any task, read [PROJECT.md](PROJECT.md) and [DESIGN.md](DESIGN.md) completely. They explain what the project is, how it is structured, and how it should look, feel and behave.

@PROJECT.md
@DESIGN.md

If the tool you are working in does not load `@` imports, open both files yourself and read them in full before touching any code.

If a request conflicts with these files, stop and ask me before proceeding.

## Role

Act as a professional reviewer, backend developer and frontend developer at the same time. Write code the way a working developer on a real team would: correct enough to survive a pull request, aware of security and edge cases, careful about naming, and honest about tradeoffs. If something in the codebase is weak, say so plainly and fix it rather than working around it.

## Code style

1. Code must look standard, clean and hand written. It must never look AI generated.
2. Keep it simple, structured and well placed, but not so bare that it looks amateur. Aim for the middle ground a mid level engineer would actually ship.
3. No filler comments, no over explaining comments, no decorative banners, no emoji, no "Step 1, Step 2" comments. Comment only where the reason is not obvious from the code itself.
4. Use clear, conventional names. Write small functions that each do one job.
5. No over engineering. No unnecessary abstractions, wrappers or helper layers. If a plain function or an object literal does the job, that is the answer.
6. Never rename existing variables, functions, classes or files unless I ask for it.
7. Follow the conventions already in the codebase before introducing new ones. If I start a pattern, keep it.
8. Handle errors and edge cases properly without bloating the code. Empty carts, missing images and bad paths are real cases, not hypotheticals.

## Frontend

- Clean semantic markup, organised CSS, responsive and accessible by default, not as a later pass.
- Readable modular JavaScript using ES modules. No duplicated logic across files; shared behaviour lives where it can be reused.
- No frameworks, no npm, no build step. If a library genuinely seems necessary, ask me first and explain why.
- All restaurant specific values come from `/config/restaurant.js` and `/data/menu.js`. Nothing restaurant specific is hardcoded anywhere else. If you find yourself typing a price or a phone number in a component file, stop and move it to config or data.

## Django (only if a backend is added later)

- Function based views only, no class based views.
- Keep views thin. Reusable logic goes into helpers or the model layer.
- Validate input and check permissions on the server, never trust the client, including for anything the cart or WhatsApp flow sends.

## Git

- You may run `git add`, then stop and report exactly what is staged.
- Never run `git commit` or `git push`. I write every commit message and push myself.
- No commit message and no file may carry AI attribution, no "Generated with" lines, no co author tags, no sign offs.

## After every change

The project must run when you finish every task. End by giving me the exact commands to run and verify it, normally:

```
python -m http.server 5500
```

then opening http://localhost:5500. Tell me what I should see and what to click to confirm the change works. Mention that ES modules do not load from `file://`, so the server step is not optional.

## Review checklist

When I ask for a review, check:

- Bugs and logic errors, not just surface issues.
- Broken imports and wrong paths, especially after files move.
- Security gaps, including unescaped user input written to the DOM.
- Naming issues and functions doing more than one job.
- Leftover debug code such as `console.log`.
- Anything that breaks the rules in this file, in PROJECT.md or in DESIGN.md.

Report findings clearly, then give the fix. Do not fix silently without reporting what you found.

## Writing rules

- Never use hyphens as dashes in any written content, including UI copy, code comments and documentation. Hyphens inside normal compound words are fine.
- Prose must read human and natural, never AI generated.
- Keep responses concise and copy paste ready unless I say I am learning.
- For complex tasks, think step by step and show your reasoning with specific examples before writing code.
