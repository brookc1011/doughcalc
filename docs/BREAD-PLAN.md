# Bread and sourdough for the dough app: roadmap (planning only)

## Context
The app is a pizza-only calculator and bake log today. CJ wants bread, sourdough first, in the same app, with naan possibly later. Bread can use either a sourdough starter or instant/active dry yeast. A starter manager tracks CJ's starter, and a bread bake made with it shows the levain build in its amounts and steps. The flow stays the same: plan, lock in, checklist, rate, notebook. This is a roadmap. Nothing is built until CJ decides to start, and figures wait for CJ's book screenshots.

Inputs so far: codebase map (2026-11-13), a one-seat skeptic review (central claim holds, 10 fixes applied, 1 ruled by CJ), and ChatGPT's design opinions (all adopted).

## Decided (2026-11-13)
- FWSY is the starting set of bread presets, from CJ's screenshots. Other sources (King Arthur and others) can add presets, each with a named source. CJ can clone, edit, create and delete bread doughs, as with pizza. Book recipes are a reference point, not fixed rules. This reuses the dough library (`cloneDough`, `saveDough`, `removeDough`, `restoreDough` in `src/api.ts`), filtered by product.
- The starter manager shows history only. It makes no peak forecast.
- Every feeding is kept. The long-run averages are computed when shown, and nothing is rolled up or thrown away. A rollup can be added later if storage is ever measured as a problem. Photos are the real storage cost.
- ChatGPT's UI direction is adopted (§4).
- **No active starter yet.** CJ has some frozen starter to try reviving as a base later, and may start a new one in the future. There are no immediate plans. The starter manager (phase 3) waits until there is a live starter. FWSY covers only fridge storage (about 1 month, p.137), not freezing, so reviving a frozen starter has no book source yet.
- **First release: Overnight White (FWSY p.89), yeast only** (CJ, 2026-11-13). Pain de Campagne follows once there's a live starter. CJ is sending the Overnight White method pages.
- **Pizza checklist:** when "Into the fridge" falls at the same time as "Divide and ball", the two merge into one step (CJ). This is a separate pizza change, not part of the bread work.

## What carries over and what does not
Reusable as is:
- baker's-percentage math (`formula.ts` L58-93)
- the yeast anchor plus rate-law approach (`yeast.ts`)
- the water-temperature math (`temperature.ts`)
- calendar export (`calendar.ts`)
- the `Step` shape
- the reminder plumbing, backup, the locked-plan-plus-actual layer, photos, history
- the shared survey fields (`ready`, `overall`, `makeAgain`)

Needs a bread version alongside the pizza one:
- **Sizing.** Pizza sizes by balls, ball weight and thickness factor (`geometry.ts`, `BallGroup`). Bread is sized as loaf count times loaf weight. The default weight comes from the book.
- **Steps.** `StepKey` (`schedule.ts` L5) and `stepText.ts`. Bread steps get their own names, and their own timer and cover table, so a bread fold never picks up pizza's sources (`stepText.ts` L211-229).
- **Timing modes.** `plan.ts` L80-100 calls the pizza `eatWindow` and falls back to shorter yeast anchors (L84-94). `defaultStageH` needs an anchor (L68). A levain dough has no yeast anchors, so the timing modes are chosen by product and `Formula.anchors` may be empty for levain.
- **Replan.** `progress.ts` assumes a ball step exists (L62). Bread protects "out of the oven", using the slack rule in §2.
- **Rating survey** (`advice.ts` L6-9) and **oven** (`methods.ts` L34-36).

Missing entirely: a product kind, levain as an ingredient key (`types.ts` L94), starters.

## Recommended approach

### 1. Product kind
Add an optional `product?: 'pizza' | 'bread'` to `Formula`. A missing value means pizza. Locked batches copy the full formula (`data/types.ts` L60), so existing data needs no migration. Bread behavior lives in its own modules (`engine/bread/schedule.ts`, `stepText.ts`, `timers.ts`, `advice.ts`, `plan.ts`) rather than as conditionals inside the pizza files. Levain pizza is out of scope, so pizza's part-count poolish detection (`stepText.ts` L101, `temperature.ts` L34, `ui/common.tsx` L69) stays untouched. Naan can be added later as a third value.

### 2. Leavening
- **The dough** carries `leaven: 'yeast' | 'levain'`. **The batch** keeps instant vs. active dry, as it does today (`Settings.yeastType`, `PlannedSnapshot.yeastType`, `PlanInput.yeastType`). That keeps a single source of truth.
- **Levain doughs** set `family` and `preferment` in a way phase 1 defines explicitly. They do not reuse `'poolish'`.
- **Yeasted bread** reuses the yeast path: book anchor first, then a rate-law estimate labeled "estimate".
- **Levain amounts.** The amount built and the amount used are separate fields. Only the used portion counts toward total flour and hydration. Leftover levain is shown as leftover. The phase 0 screenshots settle built vs. used for each recipe.
- **Levain timing.** There is no sourced rate law for levain fermentation. Between book anchors, the bulk time is an editable setting labeled as CJ's assumption, never a computed estimate.
- **Replan slack.** It is a book-sourced retard window (minimum and maximum hours) for each recipe. A room-proof recipe has no slack, so running late moves the bake. No retard is added unless the book allows one. Cold bulk stays unmodeled.

### 3. Starter manager
A new `starters` store, added by a new `if (oldVersion < 2)` block in `src/data/store.ts`.

**Each starter** has a name, flour, hydration, status (counter or fridge) and a feeding log. A feeding records the time, starter/flour/water grams (shown as 1:N:N) and room temperature. Peak time and rise are filled in later with "Record peak". The next feeding's amounts are prefilled from the last one.

**The screen** shows the name, last fed, time since feeding and a Log feeding button first. Recent feedings come next. Below them are the long-run averages by room-temperature band and feed ratio, each with its count of feedings. The averages are computed when shown, are display only, and never feed a calculation.

**Reminders.** A starter takes one reminder slot under its own ID (for example `starter-<id>`), counted against the worker's 5 slots per phone (`worker/logic.ts` L25). It gets its own pending-sync flag. `retryReminders` and the restore-time cancel cover starters too. A fridge starter's reminder must fall within the worker's 7-day limit (`logic.ts` L28). The reminder sends "Feed <starter name>", so the privacy text (`helpCopy.ts`) and its two tests change in phase 3.

**Backups.** Backups include starters, and the backup format gets a version bump. Restoring an older backup without starters restores everything it has and leaves the phone's starters untouched, with a test. A v2 backup on a v1 phone still fails, as today.

**Link to a batch.** A levain plan names its starter, with a picker only if there is more than one. The first checklist step is "Build levain", with the exact starter, flour and water. If the recipe calls for a feeding beforehand, that shows as a preparation step linked to the feeding log.

### 4. UI direction (from ChatGPT, adopted; designed through the usual hand-off)
- **Tabs and switch.** Keep Plan / Bakes / Settings. A Pizza | Bread switch sits at the top of Plan and remembers the last choice. Later it can become a dough-type picker.
- **Bread plan.** Same order as pizza: recipe, quantity (loaves times weight), leavening, room or overnight proof, "Bake at". The preview shows "Ready to slice" so cooling time is visible before locking in. Choosing instant or active dry removes the starter controls.
- **Starter screen.** Reached from a link on the Bread plan, plus "Manage starters" in Settings. There is no permanent Starter tab in the first release.
- **Batch checklist.** Reuses Up next, amounts, timers, Done and Undo. Each fold has its own check within bulk. "Take the lid off" is its own timed step. The checklist ends at "Ready to slice".
- **Levain readiness.** At the planned mix time the app asks "Is the levain ready?", with Ready to mix or Check again later (with a reminder). Confirming re-times the remaining steps and shows what moved, including bake and slice times. This uses the existing re-time-from-check-offs rule: the app says when to look, and the baker decides when to move on.
- **Rate.** A quick overall score can be saved right away. Crust, crumb, oven spring, sourness (levain only) and shape sit behind "Add bread details". Photo and note are shared with pizza.
- **Bakes.** One chronological list with a Pizza or Bread label, and an All / Pizza / Bread filter once both exist. Bread trends show only in the Bread view.
- **Advice.** Direction only, timing first, then oven, then dough, worded for bread and tied to a book source.
- **The test after one real loaf.** With floury hands, can CJ answer three things at a glance: what to do now, how much goes in, and when to check again?
- **HANDOFF.md** currently says the job is "look and feel only". It needs a revision for new screens and new api calls.

## Book intake so far (2026-11-13, not yet checked by CJ)
The intake is a reference library for research and learning, not a build list (CJ, 2026-11-13). Only what a release actually needs goes into code. The rest stays in `docs/sources/` to draw on later.

General FWSY notes for both pizza and bread are in `docs/sources/fwsy-general.md` (pp.26-31, 40-43, 49-53 and the intro). What they change here:
- **Leavening gets a hybrid option.** Ch. 9 breads are levain plus a little commercial yeast (p.53). §2's `leaven` field needs `'hybrid'` (or levain with an optional yeast amount). The batch's instant or active dry choice applies to hybrid too.
- **Retard minimum for levain loaves:** at least 12 hours after shaping (p.41).
- **Default loaf count:** 2 (every book recipe makes two).
- **Dutch oven bake:** 30 minutes lid on, then about 20 lid off (p.40).
- **Folds:** two, preferably in the first 1.5 hours after mixing (p.43, Overnight White). Confirm per recipe.
- **Bread rating and advice:** the book's troubleshooting list (p.40-41) maps onto the after-bake questions: mix temperature, bulk time, folds, room temperature, pre-ferment readiness, dough feel, scaling, proof, oven, flour.
- **Dissolve-first rule:** 70% hydration or less, mixed by hand, dissolve the yeast first (p.52).
- **Salt range for custom recipes:** 1.8-2.2%, standard 2% (p.52). A note outside the range, never a block.
- **Starter tip:** never add commercial yeast to the starter (p.53).
- **Fresh yeast:** 3 g fresh = 1 g instant (p.42, p.52), available if CJ wants a third yeast type.
- **Step list (ch. 4, p.64 on):** autolyse 20-30 min (skipped when half or more of the flour is pre-fermented), mix, folds usually early in bulk but flexible, none in the last hour, divide in two, shape, proof with the finger-dent check, preheat 45 min at 475°F, bake 30 covered plus 15-20 uncovered, rest 20 min before slicing.
- **New plan input, Dutch ovens: 1 or 2.** With one, loaf two waits in the fridge and bakes after a 5-minute reheat, which moves its slice time.
- **Proof window:** 10-15 minutes for straight doughs, up to a couple of hours for fridge-proofed levain. This sets the replan slack.
- **Pizza side:** a sourced 75-80°F warm-spot range (ch. 4) for the existing "find a warmer spot" note. CJ's call.
- **Recipes (`docs/sources/fwsy-bread.md`):** first pages of Saturday White (p.81), Saturday 75% Whole Wheat (p.85), Overnight White (p.89) with the Weeknight variation, Overnight 40% Whole Wheat, and White Bread with Poolish (p.98). Method pages still needed.
- **Levain build:** one feeding 6-9 hours before the final mix. Book levain is 80% hydration, a whole wheat and white blend, unsalted.
- **Levain method (ch. 8, pp.130-137, in `fwsy-bread.md`):** five-day start, the daily feed (100 g kept, 100 whole wheat, 400 white, 400 water at 85-90°F), 78-80°F after a feed, ripe 7-8 h after feeding, fridge storage up to a month with a two-feeding refresh starting two days before baking, and the hybrid vs. pure levain schedules. Starter screen gains an optional tub weight and after-feed temperature.
- **Levain recipes and the "own dough" essay (`fwsy-bread.md`):** Pain de Campagne, 75% Whole Wheat Levain and Field Blend #1 (hybrid, 360 g levain used), Overnight Country Blonde and Country Brown (pure, 216 g used), plus the p.190 essay on hydration, flour blends, schedule changes, slow dough, levain options, liquid levain and recipe shorthand. Built vs. used is settled. Straight doughs get sourced replan slack (fridge the shaped loaves). Slow-dough warm spot: oven light, door ajar, dough no warmer than about 80°F.
- **Fridge proof isn't levain-only:** straight doughs proof in the fridge too (Overnight 40%, 12-14 h; Weeknight White, about 10 h).
- **Checks against today's pizza presets:** 75-80°F mix target (p.28) and 2% salt (p.52) both agree with what the app already uses.

## Phases (each ships on its own; pizza behavior unchanged)
0. **Book intake.** CJ sends screenshots. Claude transcribes each recipe into `docs/sources/fwsy-bread.md` with page numbers, including levain built vs. used and any retard window. CJ checks it before any number goes into code.
1. **Foundation.** Product kind, the leaven field, `family`/`preferment` for levain, empty anchors allowed, a `progress.ts` that doesn't assume a ball step, and product-chosen timing modes. No visible change. Guard update.
2. **Bread engine, first release scope.** One bread recipe CJ actually bakes, loaf sizing, bread schedule, step text and timers, Dutch oven steps, the levain readiness re-time, bread survey and advice. Guard update.
3. **Starter manager.** Store and migration 2, a straightforward feeding log, reminder slot and sync, backup and restore rules, levain build linked to a starter. Guard update.
4. **UI hand-off to ChatGPT.** Switch, bread plan, checklist and rate screens, starter screens, Bakes filter. Imported through the usual checks.
5. **Polish.** More bread presets, iPhone Safari checklist pass, a real bake on the phone.

Deferred: flatbreads/naan, starter charts, a permanent Starter tab, and one-Dutch-oven timing (a second oven session, the pot reheat, and a separate ready-to-slice time for each loaf; ChatGPT's bread round, 2026-11-13). The Preheat step text covers one pot in words until then.

## Verification (per phase)
- `npm run guard`, `npm test` and `npm run build` all pass. Guard update in phases 1-3.
- Pizza engine and api tests pass unmodified through phases 1-2. In phase 3, only the two reminder privacy tests (`tests/reminders.test.ts`, `tests/ui/helpCopy.test.ts`) change, and only to add the feeding item.
- New tests:
  - A v1 database with batches opens as v2, with every batch intact and reading as pizza.
  - An older backup restores and leaves the phone's starters untouched.
  - A starter reminder slot counts against the 5-slot cap and retries after a failure.
  - The levain used amount (not the amount built) drives the totals.
- Browser pane at 375 px, light and dark.
- A real bread bake on the phone before calling the feature done.

## Appendix: prompt for ChatGPT (opinions only; sent, reply adopted in §4)
Kept for reference. The full text was given in the session on 2026-11-13. It asked for the switch placement, where starters live, Bakes layout, the levain handoff, and first-release scope, without building anything.

## Research notes (for later, not figures to use)
Forum and blog accounts of FWSY's levain breads are adaptations, and the book screenshots override them. Sources: thefreshloaf.com/comment/267076 and lemonsandanchovies.com/2018/01/sourdough-bread-ken-forkish-method/. Starter apps on the market (BakeReady, Doughy, Crumb) log ratio, temperature and rise, and several forecast peak time. The app deliberately does not forecast.
