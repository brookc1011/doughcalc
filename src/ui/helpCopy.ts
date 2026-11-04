/** Existing explanations, shared with the source-retention tests. */
export const HELP_COPY = {
  "dough balls": "How many balls and how heavy each one is. Their total sets the recipe. Add a second line only if you want a second size, like a couple of small focaccia balls.",
  "saved defaults": "Saves this dough’s ball sizes and counts, dinner hour, and mixing method for next time.",
  "planning times": "Eat at works back from dinner. Start at tells you when it’s ready. Both fits the dough between the two by using fridge time, which doesn’t change the yeast (FWSY p.219).",
  "room temperature": "Warmer rooms ferment faster. Sets the water temperature and, off the book schedule, the yeast estimate.",
  "yeast override": "Leave blank. Type a % only to use your own amount, e.g. from another recipe. 0.08 means 0.08% of the flour weight.",
  "reminder privacy": "To buzz you, the app’s reminder server holds this phone’s notification address, a random ID for this phone, and for each step left: its name, its time and the dough’s name. Weights, notes, photos and ratings stay on your phone. Checking a step off re-sends the times; turning reminders off clears them.",
  "warm-up time": "How long balls sit out of the fridge before you stretch them. Cold dough tears and springs back. PizzaBlab: typically 0.5-3 h, until the ball is at least 50°F.",
  "kitchen adjustment": "Multiplies the yeast for every bake. 1 means as calculated. The Bakes tab counts how often your dough was early, on time or late. Mostly early: go a little below 1. Mostly late: a little above. Change it in small steps.",
  "water temperature and friction": "The math is King Arthur’s: 3 × target dough temp, minus room, flour and friction temps (4 × with a poolish). Friction is the heat mixing adds. A mixer adds much more than hands."
} as const;

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
