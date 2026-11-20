# FWSY general notes (pizza and bread)

Source: Ken Forkish, *Flour Water Salt Yeast*, from CJ's photos of the book, 2026-11-13. These are paraphrased notes and figures with page numbers, not a copy of the text. Page numbers come from the page footers. Where a footer was cut off or missing, the note says so. **Status: Checked by CJ against the book, 2026-11-13.**

Second pass (2026-11-13): every photo was re-read against these notes by three independent reviewers. No figure was wrong. Fixed: the pizza baking-stone exception, the oven-temperature claim, the log water rule, fold timing, and a few added "about"s. Missing items added and marked "(2nd pass)". Two ch. 4 pages were never photographed: p.68 (the end of the mixing instructions) and p.76 (the middle of the bake). Step 2 and Step 8 below have gaps there.

## How the book is organized (intro, "Using This Book", page number not shown)
- All bread recipes share basic techniques. Ch. 4 is the Basic Bread Method (weighing, autolyse, mixing, folds, shaping, proofing, baking). Ch. 8 is the Levain Method (starting a levain culture, feeding it, storing it in the fridge, restoring it). Ch. 12 is the Pizza and Focaccia Method.
- The book suggests starting with Saturday White Bread (p.81).
- Part 2, Basic Bread Recipes: ch. 5 is straight doughs (store-bought instant yeast), and ch. 6 is pre-ferment doughs (biga and poolish, which take five to ten minutes of work the evening before).
- Part 3, Levain Bread Recipes: making a culture from whole wheat flour and water in five days. Ch. 9 is hybrid levain (levain plus a little commercial yeast). Ch. 10 is pure levain (no commercial yeast). Ch. 11 has two advanced levain recipes.
- Building your own recipe: "Making a Bread (or Pizza) Dough You Can Call Your Own" (p.190).
- Part 4 is pizza and focaccia: ch. 13 has four dough recipes, ch. 14 has sauces and toppings.

## Recipe yields and schedules (intro, page number not shown; the photo was upside down)
- Every bread recipe in the book makes **two loaves**.
- Each recipe offers more than one schedule (for example, mix in the morning and bake the same evening, or mix in the evening and bake the next morning). Each step is short, but the whole recipe can take a day.
- Some bread doughs make good pizza or focaccia with leftover dough, and each recipe says which.
- All baking is in a preheated Dutch oven, lid on so the loaf steams itself. The book says this beats a baking stone for bread. **Pizza and focaccia are the exception:** they bake best on a baking stone, with an iron skillet or sheet pan as alternatives. A 14-inch wood peel suits a home oven; a medium oven-proof skillet (the author uses a 9-inch cast iron one) makes a thicker-crust pizza (p.49).

## Time and temperature (p.26, p.29-30)
- Time and temperature trade off against each other. A warm dough develops faster, and a cool dough develops slower. Less yeast plus more time gives more flavor (p.26).
- Even the simplest recipes take a little over seven hours from start to finish (p.26, 2nd pass).
- Too much fermentation time makes the dough too acidic or alcoholic and the structure collapses. Too little time means less flavor (p.29).
- Three ways to slow fermentation: less yeast, cooler dough or room, or both (p.29).
- Bakery example: a levain dough that matures in an 80°F room in 3 hours takes 12 hours in the bakery retarder at about 49°F (p.29-30). This is bakery data, not a home rule. The app does not model cold bulk.
- For home use, the book changed its overnight recipes to a room-temperature bulk with a small amount of yeast. Some doughs bulk at room temperature and then **proof overnight in the fridge at 37-40°F** (p.30).
- The book's timings already allow for this variation, so the recipes don't say "until doubled" (p.30).

## Final mix temperature (p.28; confirmed by text running from p.26 to p.29)
- Best flavor comes from a final dough temperature of **75-80°F**. Most recipes target **78°F**. Check it with a probe thermometer when mixing ends and adjust next time if it's off.
- Four things set it: water temperature, flour temperature, room temperature, and autolyse length. Water is the easiest to change.
- Book example: flour at about 70°F room temperature, water at 95°F, 30 minutes of autolyse gives about 78°F. In summer, water at 90°F.
- Commercial yeast dies at about 114°F.
- All recipes assume flour at room temperature. Take flour out of the fridge or freezer a day before.
- Keep a log: dough temperature at mixing, the time of each step, and how the bread turned out.

**Check against the app:** the current pizza preset uses 90-95°F water and a 77-78°F target (`src/engine/presets.ts` L36-37, sourced to the recipe pages). That agrees with p.28.

## Weight vs. volume (p.27)
- Weigh everything. Volume measures are approximate, and the recipes were tested with King Arthur flour.
- Many recipes use **100 g of levain** (a bit more than 1/3 cup). Scooping levain into a cup degasses it, which is one more reason to weigh.

## Pre-ferments (p.30-31)
- Two approaches to flavor: (1) a straight dough with a slow rise, meaning less yeast and **at least 5 hours from mixing to shaping**; (2) a pre-fermented dough or a levain made hours ahead (p.30).
- A pre-ferment uses **30-80% of the recipe's total flour**, mixed ahead with water and a little yeast, usually overnight (p.30).
- Definitions (p.31, footer page number assumed):
  - **Straight dough:** made in one stage, with no pre-ferment or levain.
  - **Levain:** a natural culture of flour and water, wild yeast and bacteria.
  - **Pre-ferment:** part of the dough made ahead, usually **6-12 hours** before the final mix. The book uses poolish or biga.
  - **Biga:** a stiffer pre-ferment, **60-70% water**, flour, water and a very small amount of yeast, **6-12 hours**.
  - **Poolish:** equal flour and water by weight, a tiny amount of yeast, often **30-50% of total flour**, **6-12 hours**.
- A pre-ferment needs **at least 4 hours** to help the bread (p.31).

## Baking (p.40; consistent with page order)
- Use an oven thermometer. Home ovens are often off from their setting.
- Most bread recipes: **30 minutes with the Dutch oven lid on, then about 20 minutes with the lid off**. The book's example oven temperature is 475°F.
- Done in 30 minutes means the oven runs hot. An hour means it runs cool.
- Bake on a middle rack. Too low can scorch the bottom.
- Bake to dark brown, past blond.

## Troubleshooting questions (p.40-41)
Questions the book asks when a bread doesn't come out right:
- Dough temperature at the end of mixing: did it hit the target?
- Bulk fermentation time: how long did the dough take to reach the size the recipe gives? Too long or too short?
- Folds: enough?
- Room temperature: colder or warmer than usual?
- Pre-ferment (poolish, biga, levain) at mixing: under, over, or just right?
- Dough strength and hydration: did it feel right, too sticky or too stiff, usual volume?
- Scaling: any measuring error? Small yeast amounts (1-2 g) need a very accurate scale or teaspoons.
- Proof: under or over?
- Baking: oven temperature, steam, and time?
- Flour: a new bag? The same brand can vary.

## Guiding principles (p.41, footer number partly cut off)
- Time and temperature are ingredients and trade off against each other.
- Weigh everything. The exception is small amounts of yeast, where teaspoons are probably more accurate.
- Autolyse before the final mix.
- Use a thermometer to hit the target mix temperature.
- Use more water than conventional recipes.
- Learn to handle sticky dough. Fold wet doughs for strength.
- Push fermentation to just short of its limit.
- Bake to deep dark brown.
- Keep a log of dough temperatures, fermentation times and other details.
- **Retard levain loaves after shaping for at least 12 hours**, or use a very long overnight bulk.

## Baker's percentages (p.41-42)
- All ingredients are a percentage of total flour, and flour is always 100%, including blends. Every recipe gives both percentages and grams (p.42).
- **3 g fresh yeast = 1 g instant yeast** (p.42). The book's worked example: the 20 g fresh yeast below is about 7 g instant (2nd pass).
- The volume conversions (cups, teaspoons) in the recipe tables don't match the baker's percentages exactly. Scale by weight only (p.42 box, 2nd pass).
- The French base formula (Jean-Marc Berthomier): 1,000 g flour, 680 g water, 20 g salt, 20 g fresh yeast (100/68/2/2). Usually a 20-minute autolyse, a 75°F mix, 1.5 hours at room temperature, then 1 hour shaped and proofed (p.41-42). This is a reference, not a recipe from the book.

## Comparing recipes (p.43, footer page number assumed)
- Compare recipes by flour blend, leavening type and amount, hydration, water temperature, fermentation method, the temperatures of mix, bulk and proof, and total time.
- Overnight White Bread (**p.89**) compared with Lahey's no-knead bread: one-third the yeast, 3% more water, water at least 30°F warmer, a mix about 18°F warmer, an autolyse, and **two folds, preferably in the first 1.5 hours after mixing**.

## Ingredients (Equipment and Ingredients chapter, pp.49-53)
Page numbers: only p.53 shows a footer number. The four pages before it are counted back from p.53 by left and right page and are inferred as pp.49-52. Check them.

**Flour (p.49-50, inferred)**
- Use flour at room temperature for every recipe (repeats p.28).
- The book recommends **11-12% protein**. Lower-protein flour handles a long rise well and gives a more open crumb.
- Flour labeled "bread flour" is usually about **14% protein**. King Arthur Organic All-Purpose is **11.8%**. The author's bakery uses Shepherd's Grain Low-Gluten flour, about **11%**, for both bread and pizza.
- Use unbleached flour. Bleaching removes flavor.
- Sidebar: a wheat kernel is about 84% endosperm, 13% bran and 3% germ by weight. Whole wheat flour is the whole kernel. White flour is the endosperm only. Background, not used by the app.

**Flavor and gluten (p.51, inferred)**
- To get a French country-bread character, the book blends a small amount of whole wheat flour or wheat germ into white flour and uses a sweet levain with a long, slow fermentation.
- Gluten (glutenin plus gliadin) holds the gas. Mixing and folding organize it, which bakers call strength. Background, not used by the app.

**Water and salt (p.52, inferred)**
- Water good enough to drink. Temperature is the thing that matters.
- Use sea salt or mined salt, ideally fine sea salt. Kosher salt is fine but dissolves more slowly. **Avoid iodized salt**, because iodine slows fermentation and affects taste. Weigh salt, since grain size varies.
- Salt slows fermentation.
- Standard salt is **2% of flour weight**. The accepted range is **1.8-2.2%**. The author sometimes uses 2.2% for flavor and a little extra strength in high-hydration doughs.

**Yeast (p.52-53)**
- Every recipe in the book calls for **instant dried yeast**. Active dry, rapid-rise and instant are the same species and differ in coating, manufacture and performance (p.52, inferred). The author uses SAF Red Instant.
- Store it airtight in the **fridge, for six months**. Do not freeze it, because freezing kills a small part of the yeast (p.52, inferred).
- Most recipes don't need the yeast dissolved first. It can go on top of the dough during mixing. The exception: **dough at 70% hydration or less, mixed by hand**, needs the yeast dissolved in water first, for example a stiff biga (p.52, inferred).
- Sidebar repeats the conversion: 3 g fresh yeast = 1 g instant (p.52, inferred; agrees with p.42).
- Levain is a community of wild yeasts, less vigorous than commercial yeast. Levain bread has more tang, a heartier crust, and keeps longer (p.53).
- The author often adds a **small amount of commercial yeast to levain doughs** for a lighter crumb (p.53).
- **Never add commercial yeast to the levain culture itself.** It crowds out the wild yeasts (p.53).

**Check against the app:**
- Pizza presets use 2% salt (`src/engine/presets.ts` L29, L70). That agrees with p.52.
- The pizza mix step already dissolves the yeast in some of the water (FWSY p.220, `src/engine/stepText.ts` L5-7), which fits the 70%-or-less hand-mix rule for the 70% preset.

## Basic Bread Method, ch. 4 (p.64 onward)
Page numbers: only p.64 shows a footer number. By left and right placement and text continuity the pages run 64, 65, 66, 67, (68 not photographed), 69, 70 (fold photos), 71, 72, 73 (photos), 74, 75, (76 not photographed), 77.

Original note: only p.64 shows a footer number. The book's own cross-references put "when to hydrate the yeast" on p.66 and the fold photos on p.70. Every other page below is marked "ch. 4" without a number. Check them. The book says the pizza recipes use these same steps up to shaping the balls.

**Step 1, autolyse (p.64-65)**
- Mix only the flour and water, then rest at least **15 minutes** before adding salt and yeast. The book recommends **20-30 minutes**. About 5 minutes of hands-on work, by hand in a 12-quart tub. Flour at room temperature.
- Weigh the water. Being off by 20-30 g makes a real difference to the dough.
- Mix until no dry flour is left, cover, and rest 20-30 minutes.

**Water temperature (p.65)**
- Every recipe except the poolish and biga ones targets a final mix of about **78°F**, and the dough doesn't need to stay there through the rise.
- Book test: water at 95°F, flour at 70°F, a 20-minute autolyse gave about 78°F (p.65). The same example on p.28 says 30 minutes; the book gives both, so 20-30 min is the range. In summer the author dropped the water to 90°F.
- The autolyse can run to 40 or even 60 minutes if that's more convenient. The mixture cools, so the water may need to be warmer, but **never above 110°F**, which can kill the yeast. (p.28 gives about 114°F as the point where yeast dies. The 110°F limit here is the working rule.)
- If the mix misses 78°F, check the water temperature and the autolyse timing and adjust next time.

**When not to autolyse (p.65 sidebar)**
- Recipes with **half or more of the flour in the pre-ferment** (poolish or biga) skip the autolyse.

**Pre-ferment doughs in a cool house (p.66)**
- These rarely hit 78°F, because the pre-ferment sits at room temperature overnight. In the author's house, about **65°F** overnight, pre-ferment doughs usually mixed at **73-74°F**.

**When to hydrate the yeast (p.66 sidebar)**
- Dried yeast dissolves slowly in a stiff dough (70% hydration or less) mixed by hand. Most doughs in the book have enough water that it isn't needed.
- The exceptions are **biga (68% hydration)** and the **pizza doughs (70%)**, where the recipe dissolves the yeast first. This narrows the p.52 rule.

**Step 2, mix (ch. 4)**
- Hand mixing takes about 5 minutes, in the same tub. Sprinkle the salt and (in most recipes) the yeast over the dough, add the whole pre-ferment or the stated amount of levain, then mix with a wet hand.
- A missed mix temperature can be made up by putting the tub in a **warm spot at 75-80°F** for the rise.
- Keep a log: when the mix ended, room temperature, how long the dough took to double or triple, when it was divided and shaped, when it was baked, and how it came out. Next time use a little more yeast if the dough was slow, a little less if it was fast, and warmer or cooler water if the mix came out below or well above 78°F. If the dough wasn't ready in 5 or 6 hours, use a little more yeast. After mixing, the dough stays in the same tub until it's divided, about 5 or 6 hours later depending on the recipe.

**Letting it rise (ch. 4)**
- Cover the tub. Rise time depends on room temperature and the final mix temperature. Use the recipe's visual cues. Expect a little more volume in warm months and a little less in cool ones.

**Step 3, folds (ch. 4, photos p.70)**
- Saturday White Bread needs just **two folds**. Wetter doughs need **three or four**. Each takes about 1 minute.
- Fold when the dough has relaxed and flattened. The author tries to fit the folds into the first hour or two, but later folds can come an hour or two after the previous one; whatever is convenient. The firm limits: fold only once it has relaxed and flattened, and **no folds in the last hour** of bulk.

**Step 4, divide (ch. 4)**
- Divide when the dough has doubled or tripled, whichever the recipe says. Cut into **two equal pieces**.
- Volume cue (2nd pass): dough that starts at a little over 1 quart in the tub should be near the 4-quart line once tripled.

**Step 5, shape (ch. 4)**
- Shape each piece into a medium-tight round. Proof seam side down in a floured basket (banneton) or a towel-lined bowl. Lightly flour the tops before covering (2nd pass). Cover with a towel or a non-perforated plastic bag.

**Step 6, proof (ch. 4)**
- Proof time ranges from a little over **1 hour** (the Saturday breads) to **overnight in the fridge** (most levain breads and Overnight 40% Whole Wheat).
- Finger-dent test: poke about ½ inch deep. Springs back at once: needs more time. Springs back slowly and not fully: ready. Doesn't spring back: overproofed.
- Straight doughs (ch. 5) rise faster than levain doughs, and the window at the right proof can be as short as **10-15 minutes**. Proofing levain loaves overnight in the fridge widens that window to **up to a couple of hours**.

**Step 7, preheat (ch. 4)**
- Rack in the middle. A 4-quart Dutch oven with its lid on, preheated at **475°F for at least 45 minutes**.
- Most home ovens run hotter or cooler than set. The author's own runs about **25°F cool** (set to 500°F to get 475°F). Use an oven thermometer.
- **One Dutch oven:** with a room-temperature proof, put the second loaf in the fridge about **15-20 minutes before baking the first**. With a fridge proof, leave the second loaf in the fridge while the first bakes. Reheat the Dutch oven about **5 minutes** before the second loaf.

**Step 8, bake (ch. 4)**
- **475°F, covered, 30 minutes**, then lid off for **usually 15-20 minutes more**. Each recipe gives its own times. (p.40 says about 20 minutes lid off. The range here is 15-20.)
- Check about 5 minutes before the time is up. Bake until dark brown all over, with spots of very dark brown. The author suggests trying one loaf, at least once, baked just short of burnt (2nd pass). Part of the bake text is on the unphotographed p.76.
- Turn out onto a rack and rest at least **20 minutes before slicing**.

**Pizza from bread dough (ch. 4)**
- With half the dough, make **340 g balls** for the pizza recipes, rested in the fridge from several hours to a couple of days. Focaccia guidance is on p.215.

**Storing bread (ch. 4)**
- In a plastic bag: straight doughs keep **2-3 days**, pre-ferment breads **one day longer**, levain breads **5-6 days**.

## What this changes in the plan (docs/BREAD-PLAN.md)
- **Bread step list is now sourced end to end:** autolyse (20-30 min, skipped when half or more of the flour is pre-fermented), mix, folds (2 for Saturday White, 3-4 for wetter doughs, usually early in bulk but flexible, none in the last hour), divide in two, shape, proof, preheat 45 min at 475°F, bake 30 covered plus 15-20 uncovered, rest 20 min. "Ready to slice" = out of the oven + 20 minutes.
- **One or two Dutch ovens (new plan input):** with one, the two loaves bake back to back. The schedule adds the second loaf's fridge hold and a 5-minute reheat, which moves "Ready to slice" for loaf two.
- **Proof check:** the finger-dent test is the proof-step check, in the same pattern as "Is the levain ready?".
- **Replan slack:** straight-dough loaves have a 10-15 minute window, so late means the bake moves. Fridge-proofed levain loaves have up to a couple of hours.
- **Bake log:** the book's log list (mix end time, room temperature, time to double or triple, divide time, bake time, result) matches what check-offs already record. Mix temperature would be the one new field.
- **Bakes "keeps until":** 2-3 days straight, +1 day pre-ferment, 5-6 days levain. Optional.
- **Pizza side (current app):** the 75-80°F warm-spot range (ch. 4) is a sourced figure for the "find a warmer spot" note from the rise-temperature change (72d83af), which currently gives no figure. The 65°F overnight house with a 73-74°F pre-ferment mix (p.66) is also a sourced reference for CJ's own kitchen. Both are for CJ to decide on; nothing changes now.

- **Hybrid leavening (changes the plan):** the book's ch. 9 breads use levain plus a small amount of commercial yeast (p.53). The plan's `leaven: 'yeast' | 'levain'` needs a third value, or levain with an optional yeast amount. The batch's instant or active dry choice then applies to hybrid doughs too.
- **Starter manager note:** never put commercial yeast in the starter (p.53). A one-line tip on the Starter screen.
- **Salt check for custom recipes:** a sourced range of 1.8-2.2% (p.52). A custom recipe outside it could show a note. Direction only, never blocked.
- **Dissolve-first rule for bread:** dough at 70% hydration or less and mixed by hand gets its yeast dissolved first (p.52). Higher-hydration bread doughs can take the yeast on top. Bread step text follows the hydration.
- **Yeast storage tip:** fridge, airtight, six months, not the freezer (p.52).
- **Flour:** 11-12% protein recommended (p.49-50). Fits the parked "flour blends" idea. No app change now.

- **Retard window, minimum:** levain loaves retard at least 12 hours after shaping (p.41). The maximum still comes from each recipe.
- **Fridge temperature:** the overnight proof is at 37-40°F (p.30). This is a description only, since the app does not model cold.
- **Default loaf count:** 2 (every recipe makes two loaves).
- **Dutch oven bake:** 30 minutes lid on, then about 20 lid off (p.40). The app can show the "oven runs hot or cool" reading after the bake.
- **Fresh yeast:** a sourced conversion now exists (3:1, p.42), so fresh yeast can be added as a third yeast type if CJ wants it.
- **Folds:** two folds in the first 1.5 hours after mixing (p.43, for Overnight White). Confirm against each recipe.
- **Rating and advice:** the troubleshooting list (p.40-41) maps onto the after-bake questions, for bread and largely for pizza too: mix temperature, bulk time vs. target size, folds, room temperature, pre-ferment readiness, dough feel, scaling, proof, oven, flour.
- **Logging:** the book's own advice is to record dough temperature at mixing and the time of each step. The app already records step times when steps are checked off. A measured mix temperature field would be the one addition (parked idea: friction calibration from measured dough temperature).
