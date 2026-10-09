export type TrackId = 'first-steps' | 'javascript' | 'web';

export interface Lesson {
  id: string;
  track: TrackId;
  unit: string;
  title: string;
  subtitle: string;
  minutes: number;
  concept: string;
  explanation: string;
  analogy: string;
  example: string;
  prediction: { question: string; choices: string[]; correct: number; explanation: string };
  kind: 'robot' | 'javascript' | 'html';
  task: string;
  starter: string;
  solution: string;
  expected?: string[];
  hints: string[];
  takeaway: string;
  keywords: string[];
  robot?: {
    size: number;
    start: [number, number];
    goal: [number, number];
    walls: [number, number][];
    maxCommands: number;
    commands: string[];
    solutionCommands: string[];
  };
  checks?: { label: string; expression: string }[];
  htmlChecks?: {
    label: string;
    selector: string;
    text?: string;
    style?: { property: string; value: string };
  }[];
}

export const tracks: {
  id: TrackId;
  title: string;
  description: string;
  color: string;
  icon: 'sprout' | 'code' | 'globe';
}[] = [
  {
    id: 'first-steps',
    title: 'First steps',
    description: 'Start with simple moves. No typing needed.',
    color: '#4f8f68',
    icon: 'sprout',
  },
  {
    id: 'javascript',
    title: 'Make things happen',
    description: 'Write real code, one small idea at a time.',
    color: '#bb9142',
    icon: 'code',
  },
  {
    id: 'web',
    title: 'Build your first page',
    description: 'Turn words and colors into a little website.',
    color: '#7771b7',
    icon: 'globe',
  },
];

// Coordinates are [column, row]. Right adds one column; down adds one row.
// Robot commands contain allowed moves; solutionCommands contains a valid route.
export const lessons: Lesson[] = [
  {
    id: 'one-small-step',
    track: 'first-steps',
    unit: 'Giving instructions',
    title: 'One small step',
    subtitle: 'Tell Sprout where to go.',
    minutes: 2,
    concept: 'A command is one clear instruction.',
    explanation:
      'A computer follows the instructions you give it. Here, Right means move one square to the right.',
    analogy: 'Like giving a friend one direction: take one step to the right.',
    example: 'Right → move one square',
    prediction: {
      question: 'What will one Right move do?',
      choices: ['Move one square right', 'Jump to any square', 'Move two squares'],
      correct: 0,
      explanation: 'Each move changes Sprout’s position by exactly one square.',
    },
    kind: 'robot',
    task: 'Add one Right move to reach the star. Then run your steps.',
    starter: '',
    solution: 'right',
    hints: ['The star is beside Sprout.', 'Add one Right move. That is the whole plan.'],
    takeaway: 'One clear command makes one action happen.',
    keywords: ['command', 'instruction'],
    robot: {
      size: 4,
      start: [0, 1],
      goal: [1, 1],
      walls: [],
      maxCommands: 1,
      commands: ['right'],
      solutionCommands: ['right'],
    },
  },
  {
    id: 'a-few-steps',
    track: 'first-steps',
    unit: 'Giving instructions',
    title: 'A few steps',
    subtitle: 'Build a short plan.',
    minutes: 2,
    concept: 'A sequence is a list of steps in order.',
    explanation:
      'Sprout follows your moves from first to last. Add several moves to make a little program.',
    analogy: 'Putting on socks, then shoes, is a sequence. Each step happens in turn.',
    example: 'Right → Right → Up',
    prediction: {
      question: 'After Right, Right, how far right has Sprout moved?',
      choices: ['One square', 'Two squares', 'Four squares'],
      correct: 1,
      explanation: 'One Right move plus another Right move makes two steps right.',
    },
    kind: 'robot',
    task: 'Move two squares right and one square up to reach the star.',
    starter: '',
    solution: 'right right up',
    hints: ['Count the squares between Sprout and the star.', 'Add Right twice, then Up once.'],
    takeaway: 'A program can be a simple list of instructions.',
    keywords: ['sequence', 'program'],
    robot: {
      size: 4,
      start: [0, 2],
      goal: [2, 1],
      walls: [],
      maxCommands: 3,
      commands: ['right', 'up'],
      solutionCommands: ['right', 'right', 'up'],
    },
  },
  {
    id: 'order-matters',
    track: 'first-steps',
    unit: 'Thinking step by step',
    title: 'Order matters',
    subtitle: 'Go around an obstacle.',
    minutes: 3,
    concept: 'The order of your instructions can change the result.',
    explanation:
      'Sprout cannot move through a stone. Look at the first move before planning the next one.',
    analogy:
      'Open a door before walking through it. The same actions in a different order can fail.',
    example: 'Up → Up → Right → Right',
    prediction: {
      question: 'A stone is directly to Sprout’s right. Which first move is safe?',
      choices: ['Right', 'Up'],
      correct: 1,
      explanation: 'Up reaches a clear square. Right would hit the stone.',
    },
    kind: 'robot',
    task: 'Reach the star in four moves. Start by going up to avoid the stone.',
    starter: '',
    solution: 'up up right right',
    hints: [
      'Right is blocked at the starting square.',
      'Move Up twice to reach the star’s row.',
      'Then move Right twice.',
    ],
    takeaway: 'Think about what each step does before adding the next one.',
    keywords: ['sequence', 'order'],
    robot: {
      size: 4,
      start: [0, 2],
      goal: [2, 0],
      walls: [[1, 2]],
      maxCommands: 4,
      commands: ['right', 'up'],
      solutionCommands: ['up', 'up', 'right', 'right'],
    },
  },
  {
    id: 'try-and-fix',
    track: 'first-steps',
    unit: 'Thinking step by step',
    title: 'Try, notice, fix',
    subtitle: 'A mistake is useful information.',
    minutes: 3,
    concept: 'Debugging means finding and fixing a mistake.',
    explanation:
      'If a move hits a stone or leaves the board, pause at that step. Change the move and try again. You do not need to get it right the first time.',
    analogy: 'If a walking route reaches a closed gate, you adjust the route.',
    example: 'Blocked: Right → Right → Up\nWorks: Up → Right → Right',
    prediction: {
      question: 'Your first move hits a stone. What is a useful next step?',
      choices: ['Run the same moves again', 'Change the first move', 'Give up'],
      correct: 1,
      explanation: 'Changing the step that caused the problem lets you try a better route.',
    },
    kind: 'robot',
    task: 'The square to the right is blocked. Find a clear route to the star in three moves.',
    starter: '',
    solution: 'up right right',
    hints: [
      'Look for a clear square beside Sprout.',
      'Up gets you around the stone.',
      'After Up, add Right twice.',
    ],
    takeaway: 'Trying and fixing is part of coding.',
    keywords: ['debugging', 'mistake'],
    robot: {
      size: 4,
      start: [1, 2],
      goal: [3, 1],
      walls: [[2, 2]],
      maxCommands: 3,
      commands: ['right', 'left', 'up', 'down'],
      solutionCommands: ['up', 'right', 'right'],
    },
  },
  {
    id: 'same-step-again',
    track: 'first-steps',
    unit: 'Spotting patterns',
    title: 'The same step again',
    subtitle: 'Spot a repeating pattern.',
    minutes: 2,
    concept: 'Repetition means doing a step more than once.',
    explanation:
      'Sometimes a plan repeats the same move. Count how many times it needs to happen. Later, code can help you repeat steps automatically.',
    analogy: 'Clapping four times repeats the same action four times.',
    example: 'Right → Right → Right → Right',
    prediction: {
      question: 'The star is four squares right. How many Right moves do you need?',
      choices: ['Two', 'Three', 'Four'],
      correct: 2,
      explanation: 'Each Right moves one square, so four squares need four Right moves.',
    },
    kind: 'robot',
    task: 'Add four Right moves to reach the star.',
    starter: '',
    solution: 'right right right right',
    hints: ['All the moves are the same this time.', 'Add Right four times.'],
    takeaway: 'Repeating steps is a pattern you can use in code.',
    keywords: ['repetition', 'pattern'],
    robot: {
      size: 5,
      start: [0, 4],
      goal: [4, 4],
      walls: [],
      maxCommands: 4,
      commands: ['right'],
      solutionCommands: ['right', 'right', 'right', 'right'],
    },
  },
  {
    id: 'your-first-program',
    track: 'first-steps',
    unit: 'Spotting patterns',
    title: 'Your first program',
    subtitle: 'Put your new ideas together.',
    minutes: 4,
    concept: 'A bigger problem becomes easier when you split it into small steps.',
    explanation:
      'Plan a short piece of the route, then the next piece. You already know how to give commands, put them in order, and fix a blocked step.',
    analogy: 'A long walk is still made of individual steps.',
    example: 'Up → Up | Right → Right | Up → Up | Right → Right',
    prediction: {
      question: 'How can you make a longer route easier to plan?',
      choices: ['Guess every move at once', 'Plan one small part at a time'],
      correct: 1,
      explanation: 'Small parts are easier to check and combine into a working route.',
    },
    kind: 'robot',
    task: 'Guide Sprout to the star in eight moves. Follow the open squares around the stones.',
    starter: '',
    solution: 'up up right right up up right right',
    hints: [
      'Start with Up twice. Right is blocked near the start.',
      'From there, go Right twice, then Up twice.',
      'Finish with Right twice.',
    ],
    takeaway: 'You can build a working program one small step at a time.',
    keywords: ['program', 'sequence', 'debugging', 'repetition'],
    robot: {
      size: 5,
      start: [0, 4],
      goal: [4, 0],
      walls: [
        [1, 4],
        [1, 3],
        [1, 1],
        [3, 2],
        [3, 1],
      ],
      maxCommands: 8,
      commands: ['right', 'left', 'up', 'down'],
      solutionCommands: ['up', 'up', 'right', 'right', 'up', 'up', 'right', 'right'],
    },
  },
  {
    id: 'say-hello',
    track: 'javascript',
    unit: 'Your first lines',
    title: 'Say hello',
    subtitle: 'Make your first line of real code.',
    minutes: 3,
    concept: 'console.log shows a message in the output.',
    explanation:
      'JavaScript is a language for giving computers instructions. console.log(...) shows what you put inside the parentheses. Put words between quotation marks.',
    analogy: 'Think of the output as a little message board for your program.',
    example: 'console.log("Hello!");',
    prediction: {
      question: 'What does console.log("Hello!"); show?',
      choices: ['Hello!', 'console.log', 'Nothing'],
      correct: 0,
      explanation: 'The quoted message inside the parentheses appears in the output.',
    },
    kind: 'javascript',
    task: 'Change the message to Hello, world! Keep the quotation marks around it.',
    starter: 'console.log("Hello!");',
    solution: 'console.log("Hello, world!");',
    expected: ['Hello, world!'],
    hints: [
      'Edit only the words between the quotation marks.',
      'The message must include the comma, space, and exclamation mark.',
      'Use console.log("Hello, world!");',
    ],
    takeaway: 'You just wrote a real JavaScript instruction.',
    keywords: ['JavaScript', 'output', 'console.log'],
  },
  {
    id: 'little-calculator',
    track: 'javascript',
    unit: 'Your first lines',
    title: 'A little calculator',
    subtitle: 'Let the computer do the math.',
    minutes: 3,
    concept: 'Code can work with numbers.',
    explanation:
      'Numbers do not need quotation marks. The + sign adds two numbers. Put a calculation inside console.log to see the answer.',
    analogy: 'It works like typing a sum into a calculator.',
    example: 'console.log(1 + 2); // shows 3',
    prediction: {
      question: 'What does console.log(2 + 3); show?',
      choices: ['2 + 3', '23', '5'],
      correct: 2,
      explanation: 'Both values are numbers, so + adds them to make 5.',
    },
    kind: 'javascript',
    task: 'Show the answer to 7 + 3 in the output.',
    starter: 'console.log(7 + 0);',
    solution: 'console.log(7 + 3);',
    expected: ['10'],
    hints: ['The + sign is already there.', 'Change the second number from 0 to 3.'],
    takeaway: 'Numbers and words behave differently in code.',
    keywords: ['number', 'addition', 'output'],
  },
  {
    id: 'give-it-a-name',
    track: 'javascript',
    unit: 'Remembering things',
    title: 'Give it a name',
    subtitle: 'Keep a value for later.',
    minutes: 4,
    concept: 'A variable gives a value a name.',
    explanation:
      'const apples = 4; stores the number 4 under the name apples. Use apples later to read that value. The name goes on the left; the value goes on the right.',
    analogy: 'A labeled jar helps you remember what you put inside.',
    example: 'const apples = 4;\nconsole.log(apples);',
    prediction: {
      question: 'If const apples = 4;, what does console.log(apples); show?',
      choices: ['apples', '4', '0'],
      correct: 1,
      explanation: 'Using the name apples reads its stored value, 4.',
    },
    kind: 'javascript',
    task: 'Store 6 in a variable named apples, then show apples in the output.',
    starter: 'const apples = 0;\nconsole.log(apples);',
    solution: 'const apples = 6;\nconsole.log(apples);',
    expected: ['6'],
    checks: [
      {
        label: 'apples stores the number 6',
        expression: 'typeof apples === "number" && apples === 6',
      },
    ],
    hints: [
      'Change the value after the = sign.',
      'Keep apples as the variable name and set it to 6.',
    ],
    takeaway: 'A named value can be used again without retyping it.',
    keywords: ['variable', 'const', 'value'],
  },
  {
    id: 'change-a-value',
    track: 'javascript',
    unit: 'Remembering things',
    title: 'Change a value',
    subtitle: 'Keep track of a growing score.',
    minutes: 4,
    concept: 'Use let when a value needs to change.',
    explanation:
      'let creates a variable you can update. score = score + 3; reads the old score, adds 3, then stores the new score. const variables cannot be assigned a new value.',
    analogy: 'A scoreboard keeps the same label while the number changes.',
    example: 'let score = 2;\nscore = score + 3;\nconsole.log(score);',
    prediction: {
      question: 'A score starts at 2. After score = score + 3;, what is it?',
      choices: ['2', '3', '5'],
      correct: 2,
      explanation: 'The old score was 2. Adding 3 makes the new score 5.',
    },
    kind: 'javascript',
    task: 'Start score at 10. Add 5 to score, then show the new score.',
    starter: 'let score = 10;\nscore = score + 0;\nconsole.log(score);',
    solution: 'let score = 10;\nscore = score + 5;\nconsole.log(score);',
    expected: ['15'],
    checks: [
      { label: 'score now stores 15', expression: 'typeof score === "number" && score === 15' },
    ],
    hints: ['Keep the starting score at 10.', 'On the second line, replace 0 with 5.'],
    takeaway: 'let lets your program remember a changing value.',
    keywords: ['variable', 'let', 'assignment'],
  },
  {
    id: 'make-a-message',
    track: 'javascript',
    unit: 'Remembering things',
    title: 'Make a message',
    subtitle: 'Join words with a name.',
    minutes: 4,
    concept: 'A string is text. + can join text together.',
    explanation:
      'Words between quotation marks are called a string. "Hi " + name joins the greeting and the value of name. The space after Hi keeps the words apart.',
    analogy: 'It is like joining two pieces of a sentence.',
    example: 'const name = "Mia";\nconsole.log("Hi " + name);',
    prediction: {
      question: 'If name is "Mia", what does "Hi " + name make?',
      choices: ['Hi Mia', 'Hi name', 'HiMia'],
      correct: 0,
      explanation: 'The value of name is Mia. The space inside "Hi " separates the words.',
    },
    kind: 'javascript',
    task: 'Keep name as "Sam". Change the greeting so the output says Hi Sam.',
    starter: 'const name = "Sam";\nconsole.log("Hello " + name);',
    solution: 'const name = "Sam";\nconsole.log("Hi " + name);',
    expected: ['Hi Sam'],
    checks: [{ label: 'name stores the text Sam', expression: 'name === "Sam"' }],
    hints: ['Change "Hello " to "Hi ".', 'Keep a space after Hi, inside the quotation marks.'],
    takeaway: 'You can combine stored values to make useful messages.',
    keywords: ['string', 'concatenation', 'variable'],
  },
  {
    id: 'make-a-choice',
    track: 'javascript',
    unit: 'Making decisions',
    title: 'Make a choice',
    subtitle: 'Run a step only when it makes sense.',
    minutes: 4,
    concept: 'if runs code when a condition is true.',
    explanation:
      'A condition is a question with a true or false answer. points >= 5 asks whether points is at least 5. If it is true, JavaScript runs the code inside the curly brackets: { and }.',
    analogy: 'If the light is green, cross the road. The action depends on a condition.',
    example: 'const points = 8;\nif (points >= 5) {\n  console.log("Level up!");\n}',
    prediction: {
      question: 'With 8 points, is points >= 5 true?',
      choices: ['Yes', 'No'],
      correct: 0,
      explanation: '8 is greater than 5, so the condition is true.',
    },
    kind: 'javascript',
    task: 'Set points to 8 so the program shows Level up! Keep the if condition.',
    starter: 'const points = 2;\nif (points >= 5) {\n  console.log("Level up!");\n}',
    solution: 'const points = 8;\nif (points >= 5) {\n  console.log("Level up!");\n}',
    expected: ['Level up!'],
    checks: [{ label: 'points is 8', expression: 'points === 8' }],
    hints: ['Only the first line needs to change.', 'Change points from 2 to 8.'],
    takeaway: 'Conditions let a program decide when to do something.',
    keywords: ['if', 'condition', 'comparison'],
  },
  {
    id: 'choose-either-way',
    track: 'javascript',
    unit: 'Making decisions',
    title: 'Choose either way',
    subtitle: 'Give your program a backup plan.',
    minutes: 4,
    concept: 'else runs when the if condition is false.',
    explanation:
      'true and false are two special values called booleans. An if/else chooses one of two paths. When isRaining is false, the else path runs.',
    analogy: 'If it rains, take an umbrella. Otherwise, enjoy a walk.',
    example:
      'const isRaining = false;\nif (isRaining) {\n  console.log("Take an umbrella");\n} else {\n  console.log("Take a walk");\n}',
    prediction: {
      question: 'isRaining is false. Which message appears?',
      choices: ['Take an umbrella', 'Take a walk', 'Both messages'],
      correct: 1,
      explanation: 'The condition is false, so only the else path runs.',
    },
    kind: 'javascript',
    task: 'Set isRaining to false so the output says Take a walk.',
    starter:
      'const isRaining = true;\nif (isRaining) {\n  console.log("Take an umbrella");\n} else {\n  console.log("Take a walk");\n}',
    solution:
      'const isRaining = false;\nif (isRaining) {\n  console.log("Take an umbrella");\n} else {\n  console.log("Take a walk");\n}',
    expected: ['Take a walk'],
    checks: [{ label: 'isRaining is the boolean false', expression: 'isRaining === false' }],
    hints: [
      'Look at the value on the first line.',
      'Replace true with false. Do not put quotation marks around false.',
    ],
    takeaway: 'if/else lets a program respond to two possible situations.',
    keywords: ['else', 'boolean', 'true', 'false'],
  },
  {
    id: 'keep-a-list',
    track: 'javascript',
    unit: 'Working with lists',
    title: 'Keep a list',
    subtitle: 'Store a few things together.',
    minutes: 4,
    concept: 'An array is an ordered list of values.',
    explanation:
      'Put a list between square brackets and separate its items with commas. The first item is at position 0, the second at position 1. colors[0] reads the first item.',
    analogy: 'A row of labeled cubbies starts with cubby 0 in JavaScript.',
    example: 'const colors = ["red", "blue", "green"];\nconsole.log(colors[0]); // red',
    prediction: {
      question: 'Which item does colors[1] read?',
      choices: ['red', 'blue', 'green'],
      correct: 1,
      explanation: 'JavaScript counts positions from 0. Position 1 is the second item, blue.',
    },
    kind: 'javascript',
    task: 'Show blue by reading the second item from colors.',
    starter: 'const colors = ["red", "blue", "green"];\nconsole.log(colors[0]);',
    solution: 'const colors = ["red", "blue", "green"];\nconsole.log(colors[1]);',
    expected: ['blue'],
    checks: [
      {
        label: 'colors keeps all three colors in order',
        expression:
          'Array.isArray(colors) && colors.length === 3 && colors[0] === "red" && colors[1] === "blue" && colors[2] === "green"',
      },
    ],
    hints: [
      'The list is already correct. Change the position in console.log.',
      'Use colors[1] for the second item.',
    ],
    takeaway: 'An array keeps related values together in a set order.',
    keywords: ['array', 'index', 'list'],
  },
  {
    id: 'grow-a-list',
    track: 'javascript',
    unit: 'Working with lists',
    title: 'Grow a list',
    subtitle: 'Add one more item.',
    minutes: 4,
    concept: 'push adds an item to the end of an array.',
    explanation:
      'fruits.push("pear") adds pear after the existing items. fruits.length tells you how many items are in the list. A const array can have its contents changed; the name still refers to the same array.',
    analogy: 'Add one more item to the end of a shopping list.',
    example:
      'const fruits = ["apple", "banana"];\nfruits.push("pear");\nconsole.log(fruits.length);',
    prediction: {
      question: 'A list has two fruits. After adding one fruit, what is its length?',
      choices: ['1', '2', '3'],
      correct: 2,
      explanation: 'The two original items plus one new item make three.',
    },
    kind: 'javascript',
    task: 'Add "pear" to fruits using push. The output should show 3.',
    starter: 'const fruits = ["apple", "banana"];\n// Add pear here.\nconsole.log(fruits.length);',
    solution:
      'const fruits = ["apple", "banana"];\nfruits.push("pear");\nconsole.log(fruits.length);',
    expected: ['3'],
    checks: [
      {
        label: 'pear is the third fruit',
        expression:
          'Array.isArray(fruits) && fruits.length === 3 && fruits[0] === "apple" && fruits[1] === "banana" && fruits[2] === "pear"',
      },
    ],
    hints: [
      'Add a line before console.log.',
      'Use fruits.push with the new fruit inside the parentheses.',
      'The new line is fruits.push("pear");',
    ],
    takeaway: 'Lists can grow as your program runs.',
    keywords: ['array', 'push', 'length'],
  },
  {
    id: 'repeat-for-each',
    track: 'javascript',
    unit: 'Repeating and reusing',
    title: 'Repeat for each',
    subtitle: 'Use a loop to visit a list.',
    minutes: 5,
    concept: 'A loop repeats a step for each item.',
    explanation:
      'for (const fruit of fruits) visits each item in fruits, in order. Each time, fruit holds the current item. The code inside the braces runs once for each fruit.',
    analogy: 'Read a shopping list aloud, one item at a time.',
    example:
      'const fruits = ["apple", "pear"];\nfor (const fruit of fruits) {\n  console.log(fruit);\n}',
    prediction: {
      question: 'With two fruits, how many times does the loop show a fruit?',
      choices: ['Once', 'Twice', 'Forever'],
      correct: 1,
      explanation: 'The loop runs once for each of the two items.',
    },
    kind: 'javascript',
    task: 'Inside the loop, show the current fruit. You should see apple, banana, and pear on separate lines.',
    starter:
      'const fruits = ["apple", "banana", "pear"];\nfor (const fruit of fruits) {\n  // Show fruit here.\n}',
    solution:
      'const fruits = ["apple", "banana", "pear"];\nfor (const fruit of fruits) {\n  console.log(fruit);\n}',
    expected: ['apple', 'banana', 'pear'],
    checks: [
      {
        label: 'the list still contains all three fruits',
        expression:
          'Array.isArray(fruits) && fruits.length === 3 && fruits[0] === "apple" && fruits[1] === "banana" && fruits[2] === "pear"',
      },
    ],
    hints: [
      'The loop is ready. Add your instruction between its braces.',
      'Use the current item name, fruit, without quotation marks.',
      'Add console.log(fruit);',
    ],
    takeaway: 'A loop saves you from writing the same instruction many times.',
    keywords: ['loop', 'for...of', 'array'],
  },
  {
    id: 'name-some-steps',
    track: 'javascript',
    unit: 'Repeating and reusing',
    title: 'Name some steps',
    subtitle: 'Make a reusable instruction.',
    minutes: 5,
    concept: 'A function is a named group of steps.',
    explanation:
      'function sayHello() { ... } defines the steps. sayHello(); runs them. Defining a function does not run it yet. You can call it again whenever you need it.',
    analogy: 'A saved recipe has a name. Following that recipe is like calling a function.',
    example: 'function sayHello() {\n  console.log("Hello!");\n}\nsayHello();',
    prediction: {
      question: 'If you call sayHello() twice, how many Hello! messages appear?',
      choices: ['None', 'One', 'Two'],
      correct: 2,
      explanation: 'Each call runs the function’s instructions once.',
    },
    kind: 'javascript',
    task: 'Call sayHello two times to show Hello! on two separate lines.',
    starter: 'function sayHello() {\n  console.log("Hello!");\n}\n// Call sayHello twice below.',
    solution: 'function sayHello() {\n  console.log("Hello!");\n}\nsayHello();\nsayHello();',
    expected: ['Hello!', 'Hello!'],
    checks: [{ label: 'sayHello is a function', expression: 'typeof sayHello === "function"' }],
    hints: [
      'Add the calls after the closing brace.',
      'A call uses the function name followed by parentheses.',
      'Add sayHello(); on two lines.',
    ],
    takeaway: 'Functions let you name and reuse useful steps.',
    keywords: ['function', 'call'],
  },
  {
    id: 'a-personal-greeting',
    track: 'javascript',
    unit: 'Repeating and reusing',
    title: 'A personal greeting',
    subtitle: 'Give a function something to work with.',
    minutes: 5,
    concept: 'A function can take an input and return a result.',
    explanation:
      'The name in greet(name) is an input, called a parameter. return sends a value back to the caller. greet("Sam") gives the function Sam and gets a greeting back.',
    analogy: 'Give a label maker a name; it gives you back a label for that name.',
    example: 'function greet(name) {\n  return "Hi " + name;\n}\nconsole.log(greet("Sam"));',
    prediction: {
      question: 'What does greet("Mia") return in the example?',
      choices: ['Hi Sam', 'Hi Mia', 'name'],
      correct: 1,
      explanation: 'The input is Mia this time, so the function joins Hi and Mia.',
    },
    kind: 'javascript',
    task: 'Make greet return "Hi " joined with its name input. Show the result of greet("Sam").',
    starter: 'function greet(name) {\n  return "Hi ";\n}\nconsole.log(greet("Sam"));',
    solution: 'function greet(name) {\n  return "Hi " + name;\n}\nconsole.log(greet("Sam"));',
    expected: ['Hi Sam'],
    checks: [
      {
        label: 'greet works with different names',
        expression:
          'typeof greet === "function" && greet("Sam") === "Hi Sam" && greet("Mia") === "Hi Mia" && greet("Lee") === "Hi Lee"',
      },
    ],
    hints: [
      'The return line needs to use the input named name.',
      'Join "Hi " and name with +.',
      'Use return "Hi " + name;',
    ],
    takeaway: 'Inputs make one function useful in many situations.',
    keywords: ['function', 'parameter', 'return'],
  },
  {
    id: 'project-shopping-total',
    track: 'javascript',
    unit: 'Tiny useful projects',
    title: 'Project: shopping total',
    subtitle: 'Build a calculator for a whole list.',
    minutes: 6,
    concept: 'Combine a variable, a loop, and a function.',
    explanation:
      'Start a running sum at 0. For each number in the list, add that number to sum. After the loop, return the finished sum. An empty list keeps the sum at 0.',
    analogy: 'Add each price on a receipt to work out the total bill.',
    example: 'let sum = 0;\nsum = sum + 2;\nsum = sum + 3;\n// sum is now 5',
    prediction: {
      question: 'The sum starts at 0. After adding 2, 3, and 5, what is it?',
      choices: ['5', '10', '235'],
      correct: 1,
      explanation: '0 + 2 + 3 + 5 is 10. These are numbers, so they add together.',
    },
    kind: 'javascript',
    task: 'Finish total so it adds every number in numbers and returns the sum. The example receipt should show Total: 10.',
    starter:
      'function total(numbers) {\n  let sum = 0;\n  for (const number of numbers) {\n    // Add number to sum here.\n  }\n  return sum;\n}\nconsole.log("Total: " + total([2, 3, 5]));',
    solution:
      'function total(numbers) {\n  let sum = 0;\n  for (const number of numbers) {\n    sum = sum + number;\n  }\n  return sum;\n}\nconsole.log("Total: " + total([2, 3, 5]));',
    expected: ['Total: 10'],
    checks: [
      {
        label: 'total works for different shopping lists',
        expression:
          'typeof total === "function" && total([2, 3, 5]) === 10 && total([4, 1]) === 5 && total([]) === 0 && total([7]) === 7',
      },
    ],
    hints: [
      'Update sum inside the loop. The current price is called number.',
      'Read the old sum and add number to it.',
      'Add sum = sum + number; inside the braces.',
    ],
    takeaway: 'Small ideas combine into a useful tool you built yourself.',
    keywords: ['project', 'function', 'loop', 'let'],
  },
  {
    id: 'project-budget-helper',
    track: 'javascript',
    unit: 'Tiny useful projects',
    title: 'Project: budget helper',
    subtitle: 'Build a tool that makes a decision.',
    minutes: 6,
    concept: 'A function can choose a result from its inputs.',
    explanation:
      'cost <= budget asks whether the price fits the budget. Return "Ready to buy" when it does, and "Keep saving" otherwise. The same function should work with different prices.',
    analogy: 'Compare a price tag with the money you have before deciding what to do.',
    example:
      'if (cost <= budget) {\n  return "Ready to buy";\n} else {\n  return "Keep saving";\n}',
    prediction: {
      question: 'Something costs 8 and your budget is 10. Which message fits?',
      choices: ['Ready to buy', 'Keep saving'],
      correct: 0,
      explanation: '8 is less than or equal to 10, so it fits the budget.',
    },
    kind: 'javascript',
    task: 'Finish canBuy(cost, budget). Return Ready to buy if cost is at most budget; otherwise return Keep saving.',
    starter:
      'function canBuy(cost, budget) {\n  if (cost <= budget) {\n    return "";\n  } else {\n    return "";\n  }\n}\nconsole.log(canBuy(8, 10));\nconsole.log(canBuy(12, 10));',
    solution:
      'function canBuy(cost, budget) {\n  if (cost <= budget) {\n    return "Ready to buy";\n  } else {\n    return "Keep saving";\n  }\n}\nconsole.log(canBuy(8, 10));\nconsole.log(canBuy(12, 10));',
    expected: ['Ready to buy', 'Keep saving'],
    checks: [
      {
        label: 'canBuy handles affordable, equal, and expensive prices',
        expression:
          'typeof canBuy === "function" && canBuy(8, 10) === "Ready to buy" && canBuy(10, 10) === "Ready to buy" && canBuy(12, 10) === "Keep saving" && canBuy(3, 2) === "Keep saving"',
      },
    ],
    hints: [
      'There are two empty strings to fill in.',
      'The first return runs when the price fits the budget.',
      'Use "Ready to buy" in the if part and "Keep saving" in the else part.',
    ],
    takeaway: 'You can now make programs that remember, repeat, and decide.',
    keywords: ['project', 'function', 'condition', 'return'],
  },
  {
    id: 'your-first-heading',
    track: 'web',
    unit: 'Words on a page',
    title: 'Your first heading',
    subtitle: 'Put a title on your page.',
    minutes: 3,
    concept: 'HTML describes the parts of a page.',
    explanation:
      'An HTML element usually has an opening tag, some content, and a closing tag. <h1> marks the page’s main heading. The slash in </h1> closes it.',
    analogy: 'A heading is the title at the top of a poster.',
    example: '<h1>My first page</h1>',
    prediction: {
      question: 'Which part is the heading’s visible text?',
      choices: ['<h1>', 'My first page', '</h1>'],
      correct: 1,
      explanation: 'The words between the opening and closing tags appear on the page.',
    },
    kind: 'html',
    task: 'Change the main heading to Hello, world!',
    starter: '<h1>My first page</h1>',
    solution: '<h1>Hello, world!</h1>',
    htmlChecks: [
      { label: 'a main heading says Hello, world!', selector: 'h1', text: 'Hello, world!' },
    ],
    hints: ['Keep both h1 tags.', 'Replace only My first page with Hello, world!'],
    takeaway: 'HTML tags tell the browser what each part of a page means.',
    keywords: ['HTML', 'element', 'tag', 'heading'],
  },
  {
    id: 'add-a-paragraph',
    track: 'web',
    unit: 'Words on a page',
    title: 'Add a paragraph',
    subtitle: 'Give your heading a little story.',
    minutes: 3,
    concept: 'p marks a paragraph of text.',
    explanation:
      'A heading gives a page its title. A paragraph holds a sentence or a longer piece of text. Put the paragraph after the heading to show it below the title.',
    analogy: 'A book page has a title and ordinary sentences beneath it.',
    example: '<h1>My garden</h1>\n<p>I planted a seed today.</p>',
    prediction: {
      question: 'Which element is for an ordinary paragraph?',
      choices: ['<h1>', '<p>', '<style>'],
      correct: 1,
      explanation: 'The p element marks a paragraph.',
    },
    kind: 'html',
    task: 'Keep the heading. Add a paragraph that says I am learning to code.',
    starter: '<h1>My first page</h1>\n<!-- Add a paragraph below. -->',
    solution: '<h1>My first page</h1>\n<p>I am learning to code.</p>',
    htmlChecks: [
      { label: 'the main heading is still there', selector: 'h1', text: 'My first page' },
      { label: 'a paragraph shares your new skill', selector: 'p', text: 'I am learning to code.' },
    ],
    hints: [
      'Add a new line below the heading.',
      'Put the sentence between <p> and </p>.',
      'Add <p>I am learning to code.</p>',
    ],
    takeaway: 'Different HTML elements give different meaning to your words.',
    keywords: ['paragraph', 'element', 'HTML'],
  },
  {
    id: 'make-a-link',
    track: 'web',
    unit: 'Useful page pieces',
    title: 'Make a link',
    subtitle: 'Connect your page to another place.',
    minutes: 4,
    concept: 'A link has visible text and a destination.',
    explanation:
      'The a element makes a link. href gives the destination address. The text between the tags is the label people see. An extra detail inside an opening tag is called an attribute.',
    analogy: 'A sign has words you can read and points toward a destination.',
    example: '<a href="https://developer.mozilla.org">Learn more</a>',
    prediction: {
      question: 'What does href tell the browser?',
      choices: ['The link’s destination', 'The size of the text', 'The page’s background color'],
      correct: 0,
      explanation: 'href stores the address the link points to.',
    },
    kind: 'html',
    task: 'Make a link labeled Learn more that points to https://developer.mozilla.org.',
    starter: '<a href="https://developer.mozilla.org">Click here</a>',
    solution: '<a href="https://developer.mozilla.org">Learn more</a>',
    htmlChecks: [
      {
        label: 'Learn more links to MDN',
        selector: 'a[href="https://developer.mozilla.org"]',
        text: 'Learn more',
      },
    ],
    hints: [
      'The destination is already correct.',
      'Change the words between the a tags to Learn more.',
    ],
    takeaway: 'Attributes add useful details to an HTML element.',
    keywords: ['link', 'attribute', 'href'],
  },
  {
    id: 'make-a-page-list',
    track: 'web',
    unit: 'Useful page pieces',
    title: 'Make a list',
    subtitle: 'Give each idea its own line.',
    minutes: 4,
    concept: 'ul groups a bullet list; li marks each item.',
    explanation:
      'Put your list items inside a ul element. Each item gets its own li element. Placing one element inside another is called nesting.',
    analogy: 'A shopping list holds several individual items.',
    example: '<ul>\n  <li>Apples</li>\n  <li>Pears</li>\n</ul>',
    prediction: {
      question: 'What does one <li> element represent?',
      choices: ['The whole website', 'One list item', 'A color'],
      correct: 1,
      explanation: 'Each li marks one item inside a list.',
    },
    kind: 'html',
    task: 'Create two list items inside the list: Learn first, then Practice.',
    starter: '<ul>\n  <!-- Add two list items. -->\n</ul>',
    solution: '<ul>\n  <li>Learn</li>\n  <li>Practice</li>\n</ul>',
    htmlChecks: [
      { label: 'the first list item says Learn', selector: 'ul > li:nth-child(1)', text: 'Learn' },
      {
        label: 'the second list item says Practice',
        selector: 'ul > li:nth-child(2)',
        text: 'Practice',
      },
    ],
    hints: [
      'Put both items between <ul> and </ul>.',
      'Each item needs <li> before its words and </li> after them.',
      'Add <li>Learn</li> and <li>Practice</li>.',
    ],
    takeaway: 'Nesting groups smaller page pieces inside a larger one.',
    keywords: ['list', 'nesting', 'ul', 'li'],
  },
  {
    id: 'add-a-button',
    track: 'web',
    unit: 'Useful page pieces',
    title: 'Add a button',
    subtitle: 'Give an action a clear label.',
    minutes: 3,
    concept: 'button creates a button people can press.',
    explanation:
      'A button’s text should describe an action. HTML makes the button appear; JavaScript can later give it a behavior. This lesson creates the button itself.',
    analogy: 'A button is like a clearly labeled switch waiting to be connected.',
    example: '<button>Start learning</button>',
    prediction: {
      question: 'Which label makes this learning button easiest to understand?',
      choices: ['Thing', 'Start learning', '???'],
      correct: 1,
      explanation: 'Start learning describes the action clearly.',
    },
    kind: 'html',
    task: 'Create a button that says Start learning.',
    starter: '<button>Button</button>',
    solution: '<button>Start learning</button>',
    htmlChecks: [
      { label: 'a button says Start learning', selector: 'button', text: 'Start learning' },
    ],
    hints: ['Keep the opening and closing button tags.', 'Replace Button with Start learning.'],
    takeaway: 'Clear labels help people understand your page.',
    keywords: ['button', 'HTML'],
  },
  {
    id: 'add-some-color',
    track: 'web',
    unit: 'Making it your own',
    title: 'Add some color',
    subtitle: 'Style your first heading.',
    minutes: 4,
    concept: 'CSS changes how a page looks.',
    explanation:
      'CSS is the language for styling a page. Inside a style element, h1 selects all h1 headings. color: green; gives their text a green color. The rule goes inside curly brackets: { and }.',
    analogy: 'HTML writes the words on a poster. CSS chooses their appearance.',
    example: '<style>\n  h1 { color: green; }\n</style>\n<h1>My garden</h1>',
    prediction: {
      question: 'What does color: green; change?',
      choices: ['The heading’s words', 'The heading’s text color', 'The link’s destination'],
      correct: 1,
      explanation: 'The color property changes the color used to draw text.',
    },
    kind: 'html',
    task: 'Change the heading’s text color from red to green.',
    starter: '<style>\n  h1 { color: red; }\n</style>\n<h1>My garden</h1>',
    solution: '<style>\n  h1 { color: green; }\n</style>\n<h1>My garden</h1>',
    htmlChecks: [
      { label: 'the garden heading is still there', selector: 'h1', text: 'My garden' },
      {
        label: 'the heading’s text is green',
        selector: 'h1',
        style: { property: 'color', value: 'rgb(0, 128, 0)' },
      },
    ],
    hints: [
      'Find the color property in the style element.',
      'Replace red with green. Keep the colon and semicolon.',
    ],
    takeaway: 'A CSS rule selects a page piece and changes its appearance.',
    keywords: ['CSS', 'selector', 'property', 'color'],
  },
  {
    id: 'a-soft-background',
    track: 'web',
    unit: 'Making it your own',
    title: 'A soft background',
    subtitle: 'Give your page a little warmth.',
    minutes: 4,
    concept: 'background-color fills the area behind an element.',
    explanation:
      'color changes the text; background-color changes the area behind it. body selects the main page body. CSS color names include ivory, green, and white.',
    analogy: 'Choose the paper color as well as the ink color for a poster.',
    example: '<style>\n  body { background-color: ivory; }\n</style>\n<h1>A fresh start</h1>',
    prediction: {
      question: 'Which property changes the area behind the page’s text?',
      choices: ['color', 'background-color', 'href'],
      correct: 1,
      explanation: 'background-color sets the background behind the content.',
    },
    kind: 'html',
    task: 'Give the page body an ivory background.',
    starter: '<style>\n  body { background-color: white; }\n</style>\n<h1>A fresh start</h1>',
    solution: '<style>\n  body { background-color: ivory; }\n</style>\n<h1>A fresh start</h1>',
    htmlChecks: [
      {
        label: 'the body has an ivory background',
        selector: 'body',
        style: { property: 'background-color', value: 'rgb(255, 255, 240)' },
      },
      { label: 'the heading remains on the page', selector: 'h1', text: 'A fresh start' },
    ],
    hints: ['Look for background-color in the body rule.', 'Replace white with ivory.'],
    takeaway: 'Text color and background color are separate choices.',
    keywords: ['CSS', 'background-color', 'body'],
  },
  {
    id: 'room-to-breathe',
    track: 'web',
    unit: 'Making it your own',
    title: 'Room to breathe',
    subtitle: 'Add space inside a card.',
    minutes: 4,
    concept: 'padding adds space inside an element.',
    explanation:
      'A div is a general container that groups page pieces. padding: 16px; adds 16 pixels of space between its edges and its content. A pixel, written px, is a small screen measurement.',
    analogy: 'Padding is the space between a picture and the inside edge of its frame.',
    example: '<style>\n  div { padding: 16px; }\n</style>\n<div>Room to breathe</div>',
    prediction: {
      question: 'Where does padding add space?',
      choices: ['Inside the element’s edges', 'Inside the words', 'At another website'],
      correct: 0,
      explanation: 'Padding puts space between the content and the element’s edges.',
    },
    kind: 'html',
    task: 'Change the card’s padding to 16px.',
    starter:
      '<style>\n  div { background-color: ivory; padding: 0px; }\n</style>\n<div>My little card</div>',
    solution:
      '<style>\n  div { background-color: ivory; padding: 16px; }\n</style>\n<div>My little card</div>',
    htmlChecks: [
      { label: 'the card still has its text', selector: 'div', text: 'My little card' },
      {
        label: 'the card has 16px of padding at the top',
        selector: 'div',
        style: { property: 'padding-top', value: '16px' },
      },
      {
        label: 'the card has 16px of padding at the right',
        selector: 'div',
        style: { property: 'padding-right', value: '16px' },
      },
      {
        label: 'the card has 16px of padding at the bottom',
        selector: 'div',
        style: { property: 'padding-bottom', value: '16px' },
      },
      {
        label: 'the card has 16px of padding at the left',
        selector: 'div',
        style: { property: 'padding-left', value: '16px' },
      },
    ],
    hints: [
      'Find padding: 0px; in the style element.',
      'Change 0px to 16px. Keep px after the number.',
    ],
    takeaway: 'Spacing makes your page easier to read.',
    keywords: ['padding', 'pixel', 'div', 'container'],
  },
  {
    id: 'choose-one-piece',
    track: 'web',
    unit: 'Your first little website',
    title: 'Choose one piece',
    subtitle: 'Style a card without styling everything.',
    minutes: 5,
    concept: 'A class gives an element a reusable style name.',
    explanation:
      'class="card" names an element’s class. In CSS, .card selects elements with that class. The dot means class. Other div elements can stay unstyled.',
    analogy: 'Give one box a label, then decorate the boxes with that label.',
    example:
      '<style>\n  .card { background-color: ivory; padding: 16px; }\n</style>\n<div class="card">A special card</div>',
    prediction: {
      question: 'Which CSS selector matches class="card"?',
      choices: ['card', '.card', '#card'],
      correct: 1,
      explanation: 'A dot before the name selects a class.',
    },
    kind: 'html',
    task: 'Give the div the class card so the existing card styles apply to it.',
    starter:
      '<style>\n  .card { background-color: ivory; padding: 16px; }\n</style>\n<div>A special card</div>',
    solution:
      '<style>\n  .card { background-color: ivory; padding: 16px; }\n</style>\n<div class="card">A special card</div>',
    htmlChecks: [
      { label: 'the div has the card class', selector: 'div.card', text: 'A special card' },
      {
        label: 'the card’s background is ivory',
        selector: 'div.card',
        style: { property: 'background-color', value: 'rgb(255, 255, 240)' },
      },
      {
        label: 'the card has 16px of padding',
        selector: 'div.card',
        style: { property: 'padding-top', value: '16px' },
      },
    ],
    hints: [
      'Add a class attribute inside the opening div tag.',
      'The class name must match card in the CSS.',
      'Change <div> to <div class="card">.',
    ],
    takeaway: 'Classes let you choose exactly which pieces get a style.',
    keywords: ['class', 'selector', 'CSS'],
  },
  {
    id: 'project-profile-card',
    track: 'web',
    unit: 'Your first little website',
    title: 'Project: your profile card',
    subtitle: 'Build a small page from everything you know.',
    minutes: 6,
    concept: 'Combine page structure and style.',
    explanation:
      'Group a heading, a paragraph, and a button inside one profile card. Style the card with a background and padding. The selector .profile h1 means the h1 heading inside the profile card.',
    analogy:
      'Design a little introduction card with your name, a sentence, and a welcoming action.',
    example:
      '<div class="profile">\n  <h1>Alex</h1>\n  <p>Learning a little every day.</p>\n  <button>Say hello</button>\n</div>',
    prediction: {
      question: 'What does .profile h1 select?',
      choices: ['Every button', 'The heading inside the profile card', 'Only the page background'],
      correct: 1,
      explanation: 'The space asks for an h1 element inside an element with the profile class.',
    },
    kind: 'html',
    task: 'Finish the profile card: heading Alex, paragraph Learning a little every day., and button Say hello. Keep the supplied styles.',
    starter:
      '<style>\n  .profile { background-color: ivory; padding: 24px; }\n  .profile h1 { color: green; }\n</style>\n<div class="profile">\n  <h1>Your name</h1>\n  <p>Your sentence</p>\n  <button>Your button</button>\n</div>',
    solution:
      '<style>\n  .profile { background-color: ivory; padding: 24px; }\n  .profile h1 { color: green; }\n</style>\n<div class="profile">\n  <h1>Alex</h1>\n  <p>Learning a little every day.</p>\n  <button>Say hello</button>\n</div>',
    htmlChecks: [
      { label: 'the profile card contains the name Alex', selector: '.profile h1', text: 'Alex' },
      {
        label: 'the profile shares a learning sentence',
        selector: '.profile p',
        text: 'Learning a little every day.',
      },
      {
        label: 'the profile has a Say hello button',
        selector: '.profile button',
        text: 'Say hello',
      },
      {
        label: 'the profile background is ivory',
        selector: '.profile',
        style: { property: 'background-color', value: 'rgb(255, 255, 240)' },
      },
      {
        label: 'the card has 24px of padding',
        selector: '.profile',
        style: { property: 'padding-top', value: '24px' },
      },
      {
        label: 'the name is green',
        selector: '.profile h1',
        style: { property: 'color', value: 'rgb(0, 128, 0)' },
      },
    ],
    hints: [
      'Replace the three placeholder texts between their tags.',
      'The heading is Alex. The paragraph is Learning a little every day.',
      'The button label is Say hello. Keep the class and style element.',
    ],
    takeaway: 'You made a real page with meaningful structure and your own content.',
    keywords: ['project', 'HTML', 'CSS', 'class'],
  },
];

export const glossary: { term: string; meaning: string; example: string }[] = [
  {
    term: 'Command',
    meaning: 'One instruction for the computer to follow.',
    example: 'Right moves Sprout one square right.',
  },
  {
    term: 'Program',
    meaning: 'Instructions that work together to do something.',
    example: 'A list of moves that reaches the star.',
  },
  {
    term: 'Sequence',
    meaning: 'Steps arranged in a particular order.',
    example: 'Up, then Right, then Right.',
  },
  {
    term: 'Debugging',
    meaning: 'Finding and fixing a mistake in your program.',
    example: 'Change a move that hits a stone.',
  },
  {
    term: 'Output',
    meaning: 'The result a program shows you.',
    example: 'console.log("Hello!") shows Hello!',
  },
  {
    term: 'JavaScript',
    meaning: 'A programming language that can calculate, remember, repeat, and respond.',
    example: 'console.log(2 + 3);',
  },
  { term: 'Variable', meaning: 'A name that refers to a value.', example: 'const apples = 6;' },
  {
    term: 'const',
    meaning: 'Creates a variable that cannot be assigned a different value.',
    example: 'const name = "Sam";',
  },
  {
    term: 'let',
    meaning: 'Creates a variable that you can assign a new value to.',
    example: 'let score = 0; score = score + 1;',
  },
  {
    term: 'String',
    meaning: 'Text stored as a value, usually written between quotation marks.',
    example: '"Hi Sam"',
  },
  {
    term: 'Boolean',
    meaning: 'A value that is either true or false.',
    example: 'const isRaining = false;',
  },
  {
    term: 'Condition',
    meaning: 'A question in code with a true or false answer.',
    example: 'cost <= budget asks whether a price fits a budget.',
  },
  { term: 'Array', meaning: 'An ordered list of values.', example: '["apple", "pear"]' },
  {
    term: 'Index',
    meaning: 'The position of an item in an array. JavaScript starts counting at 0.',
    example: 'colors[0] reads the first color.',
  },
  {
    term: 'Loop',
    meaning: 'Code that repeats a step.',
    example: 'for (const fruit of fruits) visits each fruit.',
  },
  {
    term: 'Function',
    meaning: 'A named group of steps that you can run when needed.',
    example: 'greet("Sam") runs a greeting function.',
  },
  {
    term: 'Parameter',
    meaning: 'The name a function uses for an input.',
    example: 'In function greet(name), name is a parameter.',
  },
  {
    term: 'Return',
    meaning: 'Send a result back from a function.',
    example: 'return "Hi " + name;',
  },
  {
    term: 'HTML',
    meaning: 'The language that describes the parts of a web page.',
    example: '<h1>My page</h1>',
  },
  {
    term: 'Element',
    meaning: 'One piece of an HTML page, such as a heading or button.',
    example: '<p>A short paragraph.</p>',
  },
  {
    term: 'Tag',
    meaning: 'A marker that opens or closes an HTML element.',
    example: '<p> opens a paragraph; </p> closes it.',
  },
  {
    term: 'Attribute',
    meaning: 'An extra detail written in an element’s opening tag.',
    example: 'href="https://developer.mozilla.org" gives a link its destination.',
  },
  {
    term: 'Nesting',
    meaning: 'Putting one element inside another.',
    example: 'A list item inside a list: <ul><li>Learn</li></ul>.',
  },
  {
    term: 'CSS',
    meaning: 'The language that controls how a web page looks.',
    example: 'h1 { color: green; }',
  },
  {
    term: 'Selector',
    meaning: 'The part of a CSS rule that chooses which elements to style.',
    example: '.card selects elements with the card class.',
  },
  {
    term: 'Property',
    meaning: 'The part of a CSS rule that names what you want to change.',
    example: 'color changes text color; padding changes inner spacing.',
  },
  {
    term: 'Class',
    meaning: 'A reusable label that lets CSS choose particular elements.',
    example: '<div class="card"> matches the .card selector.',
  },
  {
    term: 'Padding',
    meaning: 'Space between an element’s content and its edges.',
    example: 'padding: 16px; adds space inside all four edges.',
  },
  {
    term: 'Pixel',
    meaning: 'A small unit for measuring things on a screen, written px.',
    example: '24px is larger than 16px.',
  },
];
