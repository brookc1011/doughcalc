# UI hand-off brief (for ChatGPT)

You work on the UI of a small personal dough app (pizza and bread). The math and storage are finished and tested. Your job is the screens: look and feel, and, when a round says so, new screens that use api calls that already exist.

## What you may change
- Everything in `src/ui/` (React components and `styles.css`).
- `index.html` head tags, `public/` icons.
- You may add new files under `src/ui/` (components, CSS, fonts via Google Fonts).

## What you must not change
- `src/engine/`, `src/data/`, `src/api.ts`, `worker/`, `wrangler.jsonc`, `public/push-sw.js`. A check (`npm run guard`) fails the build if any of these change.
- UI code imports only from `react`, `../api` and `./` (its own `src/ui` files). Never import `src/engine` or `src/data` directly.

## Files in the zip
- `src/ui/`: yours to change.
- `readonly/`: `api.ts`, `engine/types.ts`, `data/types.ts`, `package.json`. These show every function and data shape the UI can use. Do not return them.
- `screenshots/`: the current UI at phone width.

## Rules
- Keep every existing call to `../api` as it is: same names, same arguments. A round may ask you to add calls; use only functions `readonly/api.ts` exports, with the arguments it declares.
- Keep every input, button and piece of information that is on screen today. You may move, group, collapse or restyle them, and improve wording on labels and buttons.
- Keep any text that names a source (e.g. "FWSY p.89", "King Arthur", "PizzaBlab"). It can be smaller or tucked away, but it stays.
- No new npm packages and no network calls. Plain CSS and Google Fonts are fine. Inline SVG icons are fine.
- Return complete files, not snippets.
- iPhone Safari is a standing target: 16px inputs, 44px taps, safe-area insets.

## Screens (keep the flow, restyle freely)
1. **Plan** (`PlanScreen.tsx`): dough picker, dough balls (count x grams, extra lines for a second size), a "Room | Fridge" rise chip pair (the fridge hours show right under the Fridge chip), "Plan around" (Bake at / Start at / Both) with the matching time inputs and the ready-window note, a "Record a bake I already started" checkbox, and "Room temperature now". The optional rise temperature field (for a house that cools overnight) sits behind "Room temperature will change". Problems with a field show in red under that field. A "Details" drawer holds mixer, ferment hours, yeast override, hydration and salt, "Save as My Dough". Below: recipe, water temperature, timeline, and the big "Save bake plan" button. In Both mode, a card lists other doughs that fit.
2. **Batch** (`BatchScreen.tsx`): after the plan is saved. Steps checklist (Up next, amounts, cover, step timers (a countdown with its source, or a stopwatch where the book gives no time), Done / Choose time / Undo, "Running behind" note when the time moves, "Remind me", calendar export), Recipe, and "Rate a bake".
3. **Bakes** (`HistoryScreen.tsx`): "Try next time" card, per-dough averages with a trend line, timing tally, all batches.
4. **Settings** (`SettingsScreen.tsx`): units, warm-up hours, reminder heads-up time (minutes before each step), kitchen yeast multiplier, water-temperature band and friction, ovens, backup and restore.
5. **Doughs** (`DoughsScreen.tsx`): the dough library (book and mine), edit, clone, hide, reset.

The small "i" buttons (`Info` in `common.tsx`) hold short explanations; keep their text and links.

## Bread (added 2026-11-13)
Bread lives in the same app and the same flow: plan, save the bake plan, checklist, rate, Bakes. The first bread is Forkish's Overnight White (FWSY p.89), yeast only.

What the api offers for bread:
- `Product` is `'pizza' | 'bread'`. `productOf(formula)` tells which a dough is (a dough with no `product` is pizza).
- `allDoughs(product)` and `doughLibrary(product)` list one product's doughs. Called with no argument they return pizza, exactly as today.
- `findDough(id, product)` finds any dough by id; if the id is missing it falls back to the first dough of `product`.
- `lastDoughId(product)` is the dough to open on. `settings.lastLoaves` (may be missing) is the last loaves locked in; fall back to the dough's `defaults.balls`.
- `timingModes(formula)` lists the "Plan around" choices a dough allows. Bread returns `['eat', 'start']`: no Both.
- `makePlan` and `lockIn` are unchanged. For bread, `balls` are loaves (`label: 'loaf'`), `eatAt` is when the loaves go in the oven, and `lockIn` always records hand mixing and titles the batch "N loaves".

### Bread round 2 (2026-11-20)
- Oil goes in the mix step (with the salt and yeast, after the autolyse).
- Done steps keep their instructions on screen (the code calls these done-step instructions).
- Bread has a Room | Fridge rise: after the folds the tub goes into the fridge for 2-3 days, then out to warm up, shape and proof. Pizza has the same chips, using Ooni's cold-proof method (24-72 h, then 5 h on the counter).
- Loaf weights show in whole grams.
- `DoughDefaults.eatMinute` (new, optional): bread's default bake time is 9:15 (book sample schedule). Use `eatMinute ?? 0` with `eatHour`.
- Bread step keys: `autolyse`, `mix`, `fold`, `fold2`, `fold3`, `shape`, `proofCheck`, `preheat`, `bake`, `lidOff`, `out`, `slice`. The last step is `slice`, "Ready to slice".
- `batchProgress(batch).movedTo`: for bread it is set when the bake moved earlier or later (the room proof has no hold, so a late shape moves the bake).
- `Survey` has three optional bread fields: `crust` ('pale' | 'good' | 'dark'), `loaf` ('flat' | 'good' | 'tight'), `crumb` ('gummy' | 'good'). `suggestions(survey)` already turns them into advice with FWSY sources.

## Design goals
- Phone first (375 px wide). Large tap targets. The Plan screen should feel like 4 inputs and a result.
- Warm, kitchen-friendly, uncluttered. Advanced items stay tucked away.
- Numbers (grams, temperatures, times) are the most important text on screen.
- Light and dark mode.
- The test after a real bake: with floury hands, can the baker see at a glance what to do now, how much goes in, and when to check again?

## Round trip
1. CJ sends you the zip plus a prompt for this round.
2. You return the whole `src/ui` folder.
3. Claude checks the imports and api calls, drops it in, runs `npm run guard`, `npm test`, `npm run build`, and checks it in the browser at phone width, light and dark.
