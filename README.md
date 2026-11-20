# Dough

Personal pizza and bread dough calculator and bake log. Installable web app (PWA) for Android; bake data stays on the phone. A small server sends optional step reminders.

## How it works
- **Plan**: pick pizza or bread, a dough, balls or loaves, and when you want to bake. The app gives grams, water temperature and a timeline you can add to your calendar.
- **Save bake plan**: freezes that plan as a batch with a step checklist, timers and optional phone reminders.
- **Rate**: after each bake from the batch, a 30-second chip survey. The app suggests one thing to try next time.

## Where the numbers come from
- Default pizza doughs are Ken Forkish, *Flour Water Salt Yeast* (pp. 218-226): Overnight Straight, Same-Day Straight, Overnight Poolish.
- Bread: Forkish's Overnight White (FWSY p.89), yeast only. Loaves are sized in whole grams.
- Yeast: the book's own dose when your schedule matches the book. Between book schedules, it scales from the nearest one with the PizzaOvenCalc rate law and labels the result "estimate". Cold bulk is not modeled, with two exceptions. Bread has a Fridge rise option (2-3 days) that keeps the book's yeast dose, labeled as an assumption. Pizza has a Fridge rise that uses Ooni's cold-proof method and dose as is (24-72 h in the fridge, then 5 h on the counter). Sources are in `docs/sources/`.
- Ball size for a new diameter keeps the thickness of the ball you already use.
- Water temperature: the book's figure in a normal room; outside your set range, King Arthur's desired-dough-temperature formula.
- Advice: direction only, from the troubleshooting research; timing first, oven before dough.

## Assumptions to know
- Forkish does not state a room temperature for the straight-dough bulk. The app assumes 70°F for those book schedules.
- Friction defaults (hand 2°F, mixer 23°F) are picks inside King Arthur's ranges.
- Warm-up 1.5 h and the normal-room band 66-74°F are starting values; change them in Settings.

## Commands
```
npm install
npm run dev        # local preview
npm test           # engine + data tests
npm run build      # production build into dist/
npm run guard      # confirms the protected files are unchanged (below)
npm run guard:update   # after an intentional change to them, with tests passing
npm run vapid      # makes the reminder keys; run it yourself in your own terminal
```

The guard protects `src/engine/`, `src/data/`, `src/api.ts`, `worker/`, `wrangler.jsonc` and `public/push-sw.js`. A screen-only change must leave it passing untouched.

## Deploy (Cloudflare Workers)
The project is `doughcalc`. Cloudflare Workers serves the built `dist/` folder and rebuilds on every push to `main` (config in `wrangler.jsonc`). Only `/api/*` runs worker code; every other path is a static file.
1. Push to `main` on GitHub.
2. Open the site in Chrome on the phone, then menu, Install app.

## Step reminders
Reminders run on a small Cloudflare Worker with a Durable Object (`worker/`). It holds only the phone's push address, a random device id, and the step names and times needed to send each notification. The secret `VAPID_PRIVATE_KEY` is set in the Cloudflare dashboard, never in a file. The in-app privacy text lists exactly what is sent. Settings has a heads-up time (minutes before each step).

## Backups
Browser storage can be cleared. The app asks the phone to protect it, reminds you every 5 bakes, and backs up a JSON file through the share sheet (pick Google Drive). Restore from Settings.
