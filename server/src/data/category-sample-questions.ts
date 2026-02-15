/**
 * Static sample questions per category — 2 sets each — for "get to know the category" pages.
 * correctIndex is 0-based; exposed only on category preview pages, not in paid gameplay.
 */

export type SampleQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

export type SampleSet = {
  title: string;
  questions: SampleQuestion[];
};

export type CategorySamples = {
  sets: SampleSet[];
};

const SAMPLES: Record<string, SampleSet[]> = {
  "Situational Reasoning": [
    {
      title: "Set 1: Everyday choices",
      questions: [
        {
          question: "You need to be at the station in 20 minutes. Bus A leaves in 5 min and takes 18 min. Bus B leaves in 12 min and takes 10 min. Which bus gets you there on time?",
          options: ["Bus A only", "Bus B only", "Both", "Neither"],
          correctIndex: 1,
        },
        {
          question: "Two queues: Queue 1 has 4 people, each taking 2 minutes. Queue 2 has 2 people, each taking 5 minutes. Which finishes first?",
          options: ["Queue 1", "Queue 2", "Same time", "Cannot tell"],
          correctIndex: 0,
        },
        {
          question: "A store closes in 30 minutes. You need to buy 3 items; each takes 12 minutes to find and pay. Can you get all three?",
          options: ["Yes, with time to spare", "Yes, barely", "No", "Only if you hurry"],
          correctIndex: 1,
        },
      ],
    },
    {
      title: "Set 2: Constraints and outcomes",
      questions: [
        {
          question: "You can take one bag. Bag A holds 3 heavy items. Bag B holds 6 light items. You have 4 heavy and 2 light items. Which bag do you take?",
          options: ["A", "B", "Either", "Neither fits"],
          correctIndex: 0,
        },
        {
          question: "Parking: Spot A is free but 10 min walk. Spot B costs $5 and is 2 min walk. You have 15 minutes and no cash. Where do you park?",
          options: ["A", "B", "Find another", "Either"],
          correctIndex: 0,
        },
        {
          question: "Meeting at 3pm. Task 1 takes 45 min, Task 2 takes 30 min. It's 1:30pm. You must do both. What do you do first?",
          options: ["Task 1", "Task 2", "Either order works", "Skip one"],
          correctIndex: 0,
        },
      ],
    },
  ],
  "Attention Traps": [
    {
      title: "Set 1: Reading carefully",
      questions: [
        {
          question: "All boxes except one are empty. There are 5 boxes. How many contain something?",
          options: ["0", "1", "4", "5"],
          correctIndex: 1,
        },
        {
          question: "The form says: 'Tick the box if you do NOT want a receipt.' You want a receipt. Do you tick the box?",
          options: ["Yes", "No", "Either", "Leave it blank"],
          correctIndex: 1,
        },
        {
          question: "Discount: '20% off the second item.' You buy one item. How much discount do you get?",
          options: ["20%", "10%", "0%", "Depends on price"],
          correctIndex: 2,
        },
      ],
    },
    {
      title: "Set 2: Wording precision",
      questions: [
        {
          question: "Rule: 'No dogs except guide dogs.' Is a guide dog allowed?",
          options: ["No", "Yes", "Only if registered", "Unclear"],
          correctIndex: 1,
        },
        {
          question: "'Offer valid Monday to Friday.' Is Saturday included?",
          options: ["Yes", "No", "Only if holiday", "Depends"],
          correctIndex: 1,
        },
        {
          question: "Sign: 'Reserved for customers only.' You are about to buy something. Can you park?",
          options: ["Yes", "No", "Only after buying", "Unclear"],
          correctIndex: 0,
        },
      ],
    },
  ],
  "Mental Shortcuts": [
    {
      title: "Set 1: Quick comparisons",
      questions: [
        {
          question: "Which is larger: 49 × 2 or 50 × 2 − 3?",
          options: ["49 × 2", "50 × 2 − 3", "Equal", "Cannot tell"],
          correctIndex: 0,
        },
        {
          question: "Which is greater: 1/3 + 1/3 or 3/4?",
          options: ["1/3 + 1/3", "3/4", "Equal", "Cannot tell"],
          correctIndex: 1,
        },
        {
          question: "Which is closer to 100: 97 or 104?",
          options: ["97", "104", "Equal", "Neither"],
          correctIndex: 0,
        },
      ],
    },
    {
      title: "Set 2: One-step reasoning",
      questions: [
        {
          question: "A shirt was $40, now 25% off. What is the sale price?",
          options: ["$10", "$30", "$35", "$32"],
          correctIndex: 1,
        },
        {
          question: "If 5 pens cost $2, how much do 10 pens cost?",
          options: ["$2", "$4", "$5", "$3"],
          correctIndex: 1,
        },
        {
          question: "Which is faster: 60 km in 1 hour, or 100 km in 90 minutes?",
          options: ["60 km/h", "100 km in 90 min", "Same", "Cannot tell"],
          correctIndex: 1,
        },
      ],
    },
  ],
  "Cause & Effect": [
    {
      title: "Set 1: Direct consequences",
      questions: [
        {
          question: "If everyone sets their clocks 10 minutes ahead, what changes first?",
          options: ["When people wake up", "What the clocks show", "Nothing", "Traffic"],
          correctIndex: 1,
        },
        {
          question: "You turn off the only heater in a small room. What happens next?",
          options: ["Room gets colder", "Room stays same", "Room gets warmer", "Depends outside"],
          correctIndex: 0,
        },
        {
          question: "You double the amount of sugar in a recipe. What is the first direct effect?",
          options: ["Dough tastes sweeter", "Oven temperature", "Baking time", "Color"],
          correctIndex: 0,
        },
      ],
    },
    {
      title: "Set 2: Single change, one effect",
      questions: [
        {
          question: "You close the only window in a noisy room. What is the immediate effect?",
          options: ["Less outside noise", "Room darker", "Colder", "Both noise and light"],
          correctIndex: 0,
        },
        {
          question: "You add one more lane to a congested road. What is the direct result?",
          options: ["More cars can pass per hour", "Speed limit changes", "Fewer accidents", "Longer queues"],
          correctIndex: 0,
        },
        {
          question: "A single bulb in a series string burns out. What happens to the others?",
          options: ["All go out", "Others stay on", "They flicker", "Depends on wiring"],
          correctIndex: 0,
        },
      ],
    },
  ],
  "Constraint Puzzles": [
    {
      title: "Set 1: Ordering rules",
      questions: [
        {
          question: "Meetings: A must be before B. B must be before C. C must be before A. How many can be scheduled?",
          options: ["All three", "Two", "One", "None"],
          correctIndex: 3,
        },
        {
          question: "Tasks 1, 2, 3. 1 before 2. 2 before 3. 3 before 1. A valid order is:",
          options: ["1, 2, 3", "3, 1, 2", "2, 3, 1", "No valid order"],
          correctIndex: 3,
        },
        {
          question: "Three slots: morning, noon, evening. Meeting A: morning or noon. B: noon or evening. C: morning only. Can all three be placed?",
          options: ["Yes", "No", "Only A and C", "Only B and C"],
          correctIndex: 0,
        },
      ],
    },
    {
      title: "Set 2: All constraints",
      questions: [
        {
          question: "Choose a number: even, less than 10, greater than 3. Which fits?",
          options: ["2", "4", "10", "3"],
          correctIndex: 1,
        },
        {
          question: "Seats: 1 window, 2 aisle, 3 middle. You want window and an even number. Which seat?",
          options: ["1", "2", "3", "None"],
          correctIndex: 0,
        },
        {
          question: "Codes: 3 digits, first is 1, last is 5, sum is 10. What is the middle digit?",
          options: ["2", "3", "4", "5"],
          correctIndex: 2,
        },
      ],
    },
  ],
  "Elimination Logic": [
    {
      title: "Set 1: One true statement",
      questions: [
        {
          question: "Exactly one is true: (A) It is Monday. (B) It is Tuesday. (C) Today is not Monday. If (A) is false, which is true?",
          options: ["A", "B", "C", "Cannot tell"],
          correctIndex: 2,
        },
        {
          question: "One of three people is lying. Alice: 'I did it.' Bob: 'Alice did it.' Carol: 'Bob did it.' If Alice did it, who is lying?",
          options: ["Alice", "Bob", "Carol", "More than one"],
          correctIndex: 2,
        },
        {
          question: "Three cards: 1, 2, 3. One statement true: 'The 2 is not in the middle.' 'The 1 is first.' 'The 3 is last.' What order?",
          options: ["1,2,3", "2,1,3", "3,2,1", "Cannot determine"],
          correctIndex: 1,
        },
      ],
    },
    {
      title: "Set 2: Ruling out",
      questions: [
        {
          question: "Prize is in one of three boxes. Label A says 'Prize here.' Label B says 'Prize not here.' Label C says 'B is lying.' Only one label is true. Where is the prize?",
          options: ["A", "B", "C", "Cannot tell"],
          correctIndex: 1,
        },
        {
          question: "Who is the knight (always tells truth)? A: 'I am the knight.' B: 'A is the knave.' C: 'B is the knave.' Only one is knight.",
          options: ["A", "B", "C", "None"],
          correctIndex: 0,
        },
        {
          question: "Three switches, one controls the light. You can flip switches once then check the room. Minimum flips to be sure which switch?",
          options: ["1", "2", "3", "More than 3"],
          correctIndex: 2,
        },
      ],
    },
  ],
  "Estimation Battles": [
    {
      title: "Set 1: Scale and closeness",
      questions: [
        {
          question: "Which is closer to one million: 990,000 or 1,050,000?",
          options: ["990,000", "1,050,000", "Equal", "Neither"],
          correctIndex: 0,
        },
        {
          question: "Roughly how many seconds in a day?",
          options: ["864", "8,640", "86,400", "864,000"],
          correctIndex: 2,
        },
        {
          question: "A bathtub holds about how many litres?",
          options: ["15", "150", "1,500", "15,000"],
          correctIndex: 1,
        },
      ],
    },
    {
      title: "Set 2: Reasonable range",
      questions: [
        {
          question: "Population of a large city is closest to:",
          options: ["10,000", "100,000", "1,000,000", "10,000,000"],
          correctIndex: 2,
        },
        {
          question: "Distance from Earth to Moon (km), order of magnitude:",
          options: ["4 thousand", "4 hundred thousand", "4 million", "4 billion"],
          correctIndex: 1,
        },
        {
          question: "How many pages in a typical paperback novel?",
          options: ["50", "300", "3,000", "30,000"],
          correctIndex: 1,
        },
      ],
    },
  ],
  "Ratios in Disguise": [
    {
      title: "Set 1: Proportional reasoning",
      questions: [
        {
          question: "If speed doubles but time halves, how does distance change?",
          options: ["Doubles", "Halves", "Stays same", "Quadruples"],
          correctIndex: 2,
        },
        {
          question: "Recipe for 4 uses 2 eggs. You want to make 10. How many eggs?",
          options: ["4", "5", "6", "8"],
          correctIndex: 1,
        },
        {
          question: "3 workers finish in 6 days. How long for 6 workers (same task)?",
          options: ["2 days", "3 days", "6 days", "12 days"],
          correctIndex: 1,
        },
      ],
    },
    {
      title: "Set 2: Everyday proportions",
      questions: [
        {
          question: "Mix 1 part juice to 3 parts water. You have 2 cups juice. How much water?",
          options: ["4 cups", "6 cups", "2 cups", "1 cup"],
          correctIndex: 1,
        },
        {
          question: "A car uses 5 L for 100 km. How much for 40 km?",
          options: ["1 L", "2 L", "4 L", "5 L"],
          correctIndex: 1,
        },
        {
          question: "Scale 1:100. 2 cm on the map is how many metres in reality?",
          options: ["2 m", "20 m", "200 m", "0.02 m"],
          correctIndex: 2,
        },
      ],
    },
  ],
  "Everyday Science": [
    {
      title: "Set 1: Common phenomena",
      questions: [
        {
          question: "Why does metal feel colder than wood at the same room temperature?",
          options: ["Metal is colder", "Metal conducts heat away faster", "Wood insulates", "Room temperature varies"],
          correctIndex: 1,
        },
        {
          question: "Why does a balloon expand when you blow into it?",
          options: ["Air is warm", "More particles inside", "Rubber stretches", "Pressure increases"],
          correctIndex: 1,
        },
        {
          question: "Why do we see lightning before we hear thunder?",
          options: ["Light is brighter", "Light travels faster than sound", "Thunder is delayed", "Sound is absorbed"],
          correctIndex: 1,
        },
      ],
    },
    {
      title: "Set 2: Simple explanations",
      questions: [
        {
          question: "Why does ice float on water?",
          options: ["Ice is lighter", "Ice is less dense", "Water is warmer", "Air in ice"],
          correctIndex: 1,
        },
        {
          question: "Why does a mirror reverse left and right but not up and down?",
          options: ["It doesn't", "Mirrors flip front-to-back", "Eyes see differently", "Convention"],
          correctIndex: 1,
        },
        {
          question: "Why do we add salt to boiling pasta water?",
          options: ["Faster boiling", "Raises boiling point slightly", "Flavor only", "Softens pasta"],
          correctIndex: 1,
        },
      ],
    },
  ],
  "One-Move Puzzles": [
    {
      title: "Set 1: Single action",
      questions: [
        {
          question: "Scale: left pan has 3 kg, right has 1 kg. You may move one weight. How do you balance?",
          options: ["Move 1 kg to left", "Move 3 kg to right", "Move 1 kg to right", "Move 3 kg to left"],
          correctIndex: 2,
        },
        {
          question: "Equation: 5 + 5 + 5 = 550. Change one thing to make it true.",
          options: ["Change + to ×", "Add a line to first 5 to make 545", "Add a line to make 5+5+5≠550", "Change one 5 to 0"],
          correctIndex: 1,
        },
        {
          question: "Nine dots in a 3×3 grid. Draw four straight lines through all dots without lifting the pen.",
          options: ["Impossible", "Lines must extend beyond grid", "Use curved lines", "Use three lines"],
          correctIndex: 1,
        },
      ],
    },
    {
      title: "Set 2: One change",
      questions: [
        {
          question: "IX in Roman numerals. Add one stroke to get 6.",
          options: ["Add I to get VII", "Add S to get SIX", "Add a line to make IV", "Add line to X: SIX"],
          correctIndex: 2,
        },
        {
          question: "Matchstick equation: 6 + 4 = 4. Move one match to make it true.",
          options: ["Move 6 to make 5+4=9", "Move one from 6 to make 0+4=4", "Move one from + to make 6-4=2", "Move one from 4 to make 6+1=7"],
          correctIndex: 2,
        },
        {
          question: "Four coins in a row: H H T T. Flip exactly one coin so that alternating pattern appears.",
          options: ["Flip first H", "Flip second H", "Flip first T", "Flip second T"],
          correctIndex: 1,
        },
      ],
    },
  ],
  "Patterns and Sequences": [
    {
      title: "Set 1: Simple patterns",
      questions: [
        {
          question: "Continue: 2, 4, 6, 8, …",
          options: ["9", "10", "12", "16"],
          correctIndex: 1,
        },
        {
          question: "AB → BC, BC → CD, DE → ?",
          options: ["EF", "DF", "ED", "EE"],
          correctIndex: 0,
        },
        {
          question: "1, 1, 2, 3, 5, 8, … Next number?",
          options: ["11", "12", "13", "14"],
          correctIndex: 2,
        },
      ],
    },
    {
      title: "Set 2: One consistent rule",
      questions: [
        {
          question: "O, T, T, F, F, S, S, ? Next letter?",
          options: ["E", "T", "N", "O"],
          correctIndex: 0,
        },
        {
          question: "2, 6, 12, 20, 30, ?",
          options: ["40", "42", "44", "36"],
          correctIndex: 1,
        },
        {
          question: "A, C, E, G, ?",
          options: ["H", "I", "J", "K"],
          correctIndex: 1,
        },
      ],
    },
  ],
};

export function getCategorySamples(category: string): CategorySamples | null {
  const sets = SAMPLES[category];
  if (!sets || sets.length === 0) return null;
  return { sets };
}

export function hasSamples(category: string): boolean {
  return category in SAMPLES && Array.isArray(SAMPLES[category]) && SAMPLES[category].length >= 2;
}
