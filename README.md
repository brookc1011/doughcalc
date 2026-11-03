# Dough

Personal pizza dough calculator and bake log. Installable web app (PWA) for Android; data stays on the phone.

## How it works
- **Plan**: pick a dough, balls, when you want to eat. The app gives grams, water temperature and a timeline you can add to your calendar.
- **Lock in**: freezes that plan as a batch.
- **Rate**: after each bake from the batch, a 30-second chip survey. The app suggests one thing to try next time.

## Where the numbers come from
- Default doughs are Ken Forkish, *Flour Water Salt Yeast* (pp. 218-226): Overnight Straight, Same-Day Straight, Overnight Poolish.
- Yeast: the book's own dose when your schedule matches the book. Between book schedules, it scales from the nearest one with the PizzaOvenCalc rate law and labels the result "estimate". Fridge bulk is not modeled; enter yeast yourself.
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
npm run guard      # confirms engine/data/api are unchanged
npm run guard:update   # after an intentional engine change, with tests passing
```

## Deploy (Cloudflare Pages, private repo)
1. Push this folder to a private GitHub repo.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick the repo.
3. Build command `npm run build`, output directory `dist`.
4. Open the site in Chrome on the phone → menu → Install app.

## Backups
Browser storage can be cleared. The app asks the phone to protect it, reminds you every 5 bakes, and backs up a JSON file through the share sheet (pick Google Drive). Restore from Settings.
