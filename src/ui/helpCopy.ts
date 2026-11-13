/** Existing explanations, shared with the source-retention tests. */
export const HELP_COPY = {
  "dough balls": "How many balls and how heavy each one is. Their total sets the recipe. Add a second line only if you want a second size, like a couple of small focaccia balls.",
  "saved defaults": "Saves this dough’s ball sizes and counts, bake hour, and mixing method for next time.",
  "planning times": "Bake at is when the first pizza goes in. The plan works back from it and adds a preheat step before it. Start at tells you when it’s ready. Both fits the dough between the two by using fridge time, which doesn’t change the yeast (FWSY p.219).",
  "room temperature": "Warmer rooms ferment faster. Sets the water temperature and, off the book schedule, the yeast estimate.",
  "rise temperature": "Optional. If the house cools during the rise (a thermostat set back overnight), enter the average over the whole rise, including the evening before it cools. Don’t enter the overnight low. It sets the yeast only. Forkish doesn’t state a temperature for the overnight dough; the app assumes 70°F for the book amount, and cooler rises get more yeast as an estimate.",
  "yeast override": "Leave blank. Type a % only to use your own amount, e.g. from another recipe. 0.08 means 0.08% of the flour weight.",
  "reminder privacy": "To buzz you, the app’s reminder server holds this phone’s notification address, a random ID for this phone, and for each step left: its name, its time and the dough’s name, plus your heads-up minutes. While a step timer runs, it also holds that step’s name, the dough’s name and when the timer ends. Weights, notes, photos and ratings stay on your phone. Checking a step off re-sends the times; turning reminders off clears them.",
  "heads-up time": "Reminders buzz this many minutes before each step, so a 1:40 step with a 5 minute heads-up buzzes at 1:35. 0 buzzes right at the step time. Up to 60. Changing it re-sends the times for batches with reminders on.",
  "warm-up time": "How long balls sit out of the fridge before you stretch them. Cold dough tears and springs back. PizzaBlab: typically 0.5-3 h, until the ball is at least 50°F.",
  "kitchen adjustment": "Multiplies the yeast for every bake. 1 means as calculated. The Bakes tab counts how often your dough was early, on time or late. Mostly early: go a little below 1. Mostly late: a little above. Change it in small steps.",
  "mixing method": "Changes the mix step. By hand: Forkish’s pinch-and-fold until no dry flour is left. Stand mixer: dough hook on speed 2 for about 5 minutes (KitchenAid, America’s Test Kitchen); change the minutes in Settings. Either way, at this much water the dough is still soft and sticky after mixing; it should hold together as one mass, and the folds build its strength. The folds stay the same either way. A mixer warms the dough more, so with a mixer the water is always calculated to hit the target dough temperature, and comes out cooler.",
  "yeast type": "Both kinds go into the water, as Forkish does. Active dry is weaker, so the app uses 25% more (Fleischmann’s, America’s Test Kitchen, Bob’s Red Mill). King Arthur and Red Star call them 1:1. The book’s teaspoons are for instant, so active dry shows grams only. Active dry goes in a cup of the water warmed to 100-110°F (Fleischmann’s).",
  "flour": "The steps don’t change with flour. Forkish prefers 00 and names a good all-purpose as the substitute. King Arthur suggests all-purpose for a basic crust, bread flour for pan pizza and 00 for Neapolitan. The app records your flour so the Bakes tab can show your average score for each one.",
  "mixer time": "Minutes on the dough hook at speed 2. America’s Test Kitchen says about 5. Any other number is your own setting, and the mix step says so. The mix step’s timer counts down this long.",
  "preheat time": "How long the oven and stone or steel heat before the first pizza. The plan adds a Preheat step this long before Bake at. King Arthur: at least an hour. Baking Steel: 45-60 min.",
  "water temperature and friction": "The math is King Arthur’s: 3 × target dough temp, minus room, flour and friction temps (4 × with a poolish). Friction is the heat mixing adds. A mixer adds much more than hands."
} as const;

export const FLOUR_SOURCES = [
  {
    href: 'https://www.kingarthurbaking.com/blog/2024/03/13/which-flour-is-best-for-your-pizza',
    text: 'King Arthur: Which flour is best for your pizza',
  },
];

export const WATER_SOURCES = [
  {
    href: 'https://www.kingarthurbaking.com/blog/2018/05/29/desired-dough-temperature',
    text: 'King Arthur: Desired dough temperature',
  },
  {
    href: 'https://www.kingarthurbaking.com/blog/2018/08/27/determining-the-friction-factor-in-baking',
    text: 'King Arthur: Determining the friction factor',
  },
];
