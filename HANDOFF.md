# UI hand-off brief (for ChatGPT)

You are restyling the UI of a small personal pizza-dough app. The math and storage are finished and tested. Your job is look and feel only.

## What you may change
- Everything in `src/ui/` (React components and `styles.css`).
- `index.html` head tags, `public/` icons.
- You may add new files under `src/ui/` (components, CSS, fonts via Google Fonts).

## What you must not change
- `src/engine/`, `src/data/`, `src/api.ts`, `worker/`, `wrangler.jsonc`, `public/push-sw.js`. A check (`npm run guard`) fails the build if any of these change.
- UI code imports only from `../api` (and its own `src/ui` files). Never import `src/engine` or `src/data` directly.

## Files in the zip
- `src/ui/`: yours to change.
- `src/main.tsx`, `index.html`: small; you may touch the head tags and the CSS import only.
- `reference-read-only/`: `api.ts`, `engine-types.ts`, `data-types.ts`, `package.json`. These show every function and data shape the UI can use. Do not return them; they are not used from the zip.
- `screenshots/`: the current plain UI at phone width.

## Rules
- Keep every function call to `../api` exactly as it is: same function names, same arguments.
- Keep every input, button and piece of information that is on screen today. You may move, group, collapse or restyle them, and improve wording on labels and buttons.
- Keep any text that names a source (e.g. "FWSY p.220", "King Arthur", "PizzaBlab"). It can be smaller or tucked away, but it stays.
- No new npm packages. Plain CSS (or CSS modules) and Google Fonts are fine. Inline SVG icons are fine.
- Return complete files, not snippets.

## Screens (keep the flow, restyle freely)
1. **Plan** (`PlanScreen.tsx`): dough picker, dough balls (count x grams, extra lines for a second size), "Plan around" (Eat at / Start at / Both) with the matching time inputs and the ready-window note, room temperature. A "Details" drawer holds mixer, ferment hours, yeast override, hydration and salt, "Save as My Dough". Below: recipe, water temperature, timeline, and the big "Lock in & start" button. In Both mode, a card lists other doughs that fit.
2. **Batch** (`BatchScreen.tsx`): after lock-in. The **Steps checklist** (Done / "at…" / Undo per step, next step highlighted, "Running behind" note when dinner moves, "Remind me" toggle with its status line, calendar export), "Rate a bake" form (chips), list of bakes, "what actually happened" form, the frozen recipe.
3. **Bakes** (`HistoryScreen.tsx`): "Try next time" card, per-dough averages with a trend line, timing tally, all batches.
4. **Settings** (`SettingsScreen.tsx`): units, warm-up hours, kitchen yeast multiplier, water-temperature band and friction, ovens, backup and restore.

The small "i" buttons (`Info` in `common.tsx`) hold short explanations; keep their text and links.

## Design goals
- Phone first (375 px wide). Large tap targets. The Plan screen should feel like 4 inputs and a result.
- Warm, kitchen-friendly, uncluttered. Advanced items stay tucked away.
- Numbers (grams, temperatures, times) are the most important text on screen.
- Light and dark mode.

## Round trip
1. CJ sends you the `src/ui` folder (zip) plus this file.
2. You return the whole `src/ui` folder.
3. Claude drops it in, runs `npm run guard`, `npm test`, `npm run build`, and checks it in the browser at phone width.
