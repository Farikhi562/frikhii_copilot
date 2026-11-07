import type { LessonBlock } from "../lessonBlocks";

/**
 * DEMO lesson content showing every supported block type. Only the demo course's
 * "Reading a regression line" lesson has authored content; real lessons show their
 * blueprint until the lesson engine ships.
 */
export const DEMO_RICH_LESSON_ID = "demo-m2-c1-l2";

const diagram =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#F5F3ED"/><line x1="30" y1="150" x2="300" y2="150" stroke="#111318"/><line x1="30" y1="150" x2="30" y2="20" stroke="#111318"/><line x1="30" y1="130" x2="300" y2="40" stroke="#5268F5" stroke-width="3"/><g fill="#111318"><circle cx="60" cy="125" r="4"/><circle cx="100" cy="112" r="4"/><circle cx="140" cy="108" r="4"/><circle cx="190" cy="80" r="4"/><circle cx="230" cy="70" r="4"/><circle cx="270" cy="48" r="4"/></g></svg>',
  );

export const demoRichLesson: LessonBlock[] = [
  { type: "intro", body: "A scatter plot shows many points. A fitted line summarises the trend they suggest. In this lesson you learn to read that line and to say what it cannot tell you." },
  { type: "objectives", items: ["Explain slope and intercept in plain words", "Predict a value from a fitted line", "State one limit of a fitted line"] },
  { type: "explanation", title: "What the line is", body: "A fitted line is the straight line that sits closest to the points overall. It is a summary of this sample, not a rule that every point must follow." },
  { type: "key_concept", title: "Slope", body: "The slope is how much the predicted value changes when the input rises by one unit. It describes an average pattern, not a guarantee for any one case." },
  { type: "math", expression: "predicted score = intercept + slope × hours", caption: "The straight-line model used in this lesson." },
  { type: "analogy", body: "Think of the line as the average path through a crowd walking across a field: it shows the general direction, while each person still wanders." },
  { type: "table", caption: "Sample sessions and the line's prediction", headers: ["Hours", "Actual score", "Predicted score"], rows: [["1", "52", "54"], ["2", "61", "60"], ["3", "69", "66"], ["4", "70", "72"]] },
  { type: "image", src: diagram, alt: "A scatter plot of six points rising from left to right with a straight line fitted through them.", caption: "Six points and the line that summarises their trend." },
  { type: "example", title: "Predicting from the line", steps: ["Read the line's equation: intercept 48, slope 6.", "Choose an input: 3 hours.", "Compute 48 + 6 × 3 = 66.", "Compare with the actual value and note the gap."] },
  { type: "code", language: "python", code: "hours = [1, 2, 3, 4]\nscores = [52, 61, 69, 70]\nslope, intercept = 6, 48\nfor h, s in zip(hours, scores):\n    print(h, s, intercept + slope * h)", caption: "Illustrative code, shown for reading. It is not run in this workspace." },
  { type: "practice", title: "Try it", items: ["Predict the score for 5 hours.", "Say why that prediction is less certain than the one for 3 hours."] },
  { type: "knowledge_check", items: ["What does a slope of 6 mean here?", "Why can a fitted line still be wrong for one person?"] },
  { type: "summary", body: "A fitted line summarises a trend in a sample. Use it to estimate, and always say how far you trust the estimate." },
];
