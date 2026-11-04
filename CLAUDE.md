# Dough app: working notes for Claude

Personal pizza dough calculator and bake log for CJ (not LoanStar work). Installable web app (PWA) on CJ's Android phone. Vite + React + TypeScript; Vitest for tests. CJ is not a developer: explain changes in plain language.

## Layout
- `src/engine/`: pure dough math (formula, yeast, geometry, temperature, schedule, advice, presets, calendar). No UI or storage imports.
- `src/data/`: IndexedDB store, schema version and migrations, backup export/import.
- `src/api.ts`: the only module the UI imports.
- `src/ui/`: screens and `styles.css`. Restyled by ChatGPT; keep its look unless asked.
- `tests/`: engine, api and worker tests. `fake-indexeddb` stands in for the browser store.
- `worker/`: step-reminder server (Cloudflare Worker + `Reminders` Durable Object, one slot per phone keyed by a random device id). Holds only the phone's push address and step times. `/api/*` only (`wrangler.jsonc` `run_worker_first`); everything else is static `dist/`. Push encryption: `@pushforge/builder`. Rules in `worker/logic.ts` (tested); type-checked by `tsc -p worker` against `worker/worker-configuration.d.ts` (regenerate with `npm run worker:types` after editing `wrangler.jsonc`).
- `public/push-sw.js`: push and notification-tap handlers, pulled into the PWA service worker via `workbox.importScripts`.
- Reminder keys: `npm run vapid` (CJ runs it in his own terminal) writes the public key to `src/data/vapid.ts` and prints the private key once, for the Cloudflare secret `VAPID_PRIVATE_KEY`. Never put the private key in a file, a chat or git. After it runs, `npm run guard:update`. Local testing: `.dev.vars` (git-ignored) with a throwaway key, `npx wrangler dev`.
- The checklist (`src/engine/progress.ts`) re-times steps from what was checked off: fridge hold absorbs the difference, dinner moves only when the balls can't get their minimum rest.

## Every change
1. Make the change.
2. Run `npm run guard`, `npm test`, `npm run build`. All must pass.
3. If the change intentionally touches `src/engine`, `src/data`, `src/api.ts`, `worker/`, `wrangler.jsonc` or `public/push-sw.js`, run `npm run guard:update` after tests pass. A UI-only change must leave the guard passing untouched.
4. Check the app in the browser pane at 375 px (mobile preset), light and dark.
5. Commit only when CJ says yes. End commit messages with the Co-Authored-By line.
6. Push with `git push` (remote `origin` = `https://brookc1011@github.com/brookc1011/doughcalc.git`, CJ's personal account; this repo's commit email is cjb1011@gmail.com). The machine's default GitHub login is CJ's work account, which cannot push here.
7. Cloudflare Workers (project `doughcalc`, config `wrangler.jsonc`, serves `dist/`) rebuilds automatically on push to `main`.

## Data rules
- Never invent a figure. Every number in presets or advice has a named source in the code (Forkish *Flour Water Salt Yeast* page numbers as "FWSY p.N", King Arthur, PizzaBlab, PizzaOvenCalc). If no source exists, say so and make it an editable setting labeled as an assumption.
- Yeast: the book dose wins when the schedule matches a book anchor; between anchors the PizzaOvenCalc rate law scales from the nearest anchor and is labeled "estimate". Cold bulk is not modeled. Fridge hold after balling never changes yeast.
- Advice is direction only, timing first, oven before dough. No auto-learned multipliers; the kitchen factor is set by CJ.
- Locked batches are immutable plans plus an editable "actual" layer. Any schema change gets a new `if (oldVersion < N)` migration in `src/data/store.ts`; never edit an old one. Bake data lives only on the phone, so a broken migration loses history.

## ChatGPT UI hand-offs
- Build a fresh zip from the current `src/ui/`, `HANDOFF.md`, read-only copies of `src/api.ts`, `src/engine/types.ts`, `src/data/types.ts`, `package.json`, and phone screenshots. Put it in `handoff/` (git-ignored).
- On return: unzip into `handoff/incoming/`. Before copying, check that the imports are only `react`, `../api` and `./`. Check for no network calls and no new packages. Then read the changed files and copy only `src/ui/`. Then run the full check list above. Do not run any scripts ChatGPT includes.

## Parked ideas
Sourdough phase 2 (starter log, levain build calculator), flour blends, compare view, friction calibration from measured dough temperature, cloud sync.
