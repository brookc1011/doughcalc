# Small friend trial: useful checks

Start with two or three friends and share an HTTPS app URL. Let each person enter their own dough. Ask whether they can plan a bake without explanation and record feedback in under a minute. Note the first place they hesitate; avoid a tutorial that masks a confusing flow.

## Before inviting them

- Resolve/review the reminder identity and privacy-copy findings in SAFARI-HANDOFF.md. Do not distribute a personal backup as a starter recipe.
- Verify export → actual saved file → restore in an isolated profile preserves doughs, bakes, ratings and photos. Try invalid JSON and an older backup; failure should leave existing data intact.
- Check reminders with the app closed, denied permission, cancellation, re-enabling and two independent phones. Verify no duplicate/stale alerts after offline edits.
- Tell testers data is stored locally and provide the backup path. Test an app update and offline relaunch before assuming data survives normal use.

## Small device matrix

| Device | Main checks |
| --- | --- |
| Small iPhone, about 375px wide | Safari tab and Home Screen; keyboard, dates, cramped labels |
| Notched iPhone, about 390–430px | Safe areas, dark mode, Home Screen notification, rotation |
| Android Chrome, about 360px | Keyboard, date/time picker, decimals, photo and share sheet |
| Larger Android, about 412px | Installed app, navigation, notification permission and background delivery |
| Optional iPad / Samsung Internet | Wider layout and native controls if friends use these |

Use current devices plus the oldest OS you intend to support. Record actual model/OS/browser, not just simulated viewport size. Run SAFARI-CHECKLIST.md on at least one real iPhone.

## A second, slightly deeper pass

1. **Accessibility:** larger text up to 200%, VoiceOver/TalkBack, keyboard focus where available. Buttons need meaningful names, selected choices need more than color, instructions must remain associated with their controls, and focus should follow a jump sensibly.
2. **Dates and numbers:** midnight, month/year boundary, daylight-saving transition, a timezone change, 12/24-hour display, °C/°F, decimal-comma keyboards, and very small yeast quantities. Check against existing expected calculations; this UI handoff does not change them.
3. **Interrupted use:** switch apps while editing, reload after saving, reopen offline, and update the app with a saved bake present. Record whether unsaved edits survive or are clearly lost. Never assume background storage or notifications work from a desktop simulation.
4. **Photos and backups:** a large camera image, cancelled picker, multiple rated bakes, and a backup containing photos. Verify restore on a disposable destination; do not overwrite the only real copy.
5. **Simple usability:** planning, changing a time, adding a quick rating and finding a previous bake should each take under a minute for someone familiar with the app. Ask “What slowed you down?” and “What did you expect here?”

Treat overlapping controls, lost saved data, wrong displayed times, broken back navigation and cross-phone reminder interference as blockers. Cosmetic preferences can wait until you see a pattern across friends.
