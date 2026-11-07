import type {
  CourseClass,
  CourseDetail,
  CourseModule,
  CourseVersion,
  Lesson,
} from "../../course/schemas/course";

/**
 * DEMO DATA. Client-side sample only: never written to the database, never mixed with a
 * user's courses, always shown behind a "Demo" banner. It follows the same schema as real
 * Core API course data so pages render identically for both.
 */
export const DEMO_COURSE_ID = "demo";

type LessonSeed = {
  title: string;
  description: string;
  intro: string;
  concepts: string[];
  example: string;
  practice: string;
  minutes: number;
};

type ClassSeed = {
  title: string;
  description: string;
  objectives: string[];
  concepts: string[];
  lessons: LessonSeed[];
  exercise: { title: string; description: string; deliverable: string };
};

type ModuleSeed = { title: string; description: string; skills: string[]; classes: ClassSeed[] };

const modules: ModuleSeed[] = [
  {
    title: "Working with data",
    description: "Load, inspect and clean a small dataset so later analysis rests on trustworthy inputs.",
    skills: ["Reading tabular data", "Spotting missing values", "Basic cleaning"],
    classes: [
      {
        title: "Meet your dataset",
        description: "Open a dataset and learn what each row, column and type means.",
        objectives: ["Describe the shape and types of a dataset", "Explain what a row and a column represent"],
        concepts: ["Rows and columns", "Data types", "Summary statistics"],
        lessons: [
          { title: "Rows, columns and types", description: "How tabular data is organised.", intro: "Every analysis starts by understanding what one row means.", concepts: ["A row is one observation", "A column is one measured property", "Types decide what you can compute"], example: "A table of student sessions: one row per session, columns for date, minutes and topic.", practice: "List the columns of a dataset you know and name each type.", minutes: 25 },
          { title: "Summary statistics", description: "Mean, median and spread at a glance.", intro: "A few numbers can describe a column before you plot anything.", concepts: ["Mean versus median", "Spread and range", "When averages mislead"], example: "Study minutes per day: one very long day moves the mean but not the median.", practice: "Compute the mean and median of five numbers by hand.", minutes: 30 },
        ],
        exercise: { title: "Describe a dataset", description: "Summarise a small dataset in plain language.", deliverable: "A one-page description of the dataset's rows, columns and key statistics." },
      },
      {
        title: "Cleaning data",
        description: "Handle missing and inconsistent values deliberately.",
        objectives: ["Identify missing and inconsistent values", "Choose and justify a cleaning strategy"],
        concepts: ["Missing values", "Duplicates", "Consistent formats"],
        lessons: [
          { title: "Finding problems", description: "Detect missing values and duplicates.", intro: "Dirty data fails quietly, so look for problems on purpose.", concepts: ["Counting missing values", "Spotting duplicates", "Outliers versus errors"], example: "Two rows with the same session id suggest a duplicate entry.", practice: "Mark three suspicious values in a short table and explain why.", minutes: 30 },
          { title: "Fixing problems", description: "Drop, fill or flag, and say why.", intro: "Every cleaning choice changes the result, so record it.", concepts: ["Dropping versus filling", "Documenting decisions", "Re-checking after cleaning"], example: "Filling a missing minutes value with the median keeps the row but adds an assumption.", practice: "Clean a six-row table and write down each decision.", minutes: 35 },
        ],
        exercise: { title: "Clean and justify", description: "Clean a messy table and document each choice.", deliverable: "A cleaned table plus a short decision log." },
      },
    ],
  },
  {
    title: "Finding patterns",
    description: "Use charts and simple models to see relationships and test them honestly.",
    skills: ["Choosing a chart", "Reading a regression line", "Avoiding false conclusions"],
    classes: [
      {
        title: "Visualising relationships",
        description: "Pick charts that fit the question and read them carefully.",
        objectives: ["Choose a chart type for a question", "Read a scatter plot without over-claiming"],
        concepts: ["Chart choice", "Scatter plots", "Correlation is not causation"],
        lessons: [
          { title: "Choosing a chart", description: "Match the chart to the question.", intro: "The same data can answer different questions with different charts.", concepts: ["Comparison versus trend", "Distribution versus relationship", "Labels and scales"], example: "Minutes studied per weekday suits a bar chart; minutes against score suits a scatter plot.", practice: "Pick a chart for three questions and justify each.", minutes: 25 },
          { title: "Reading a regression line", description: "What a fitted line does and does not say.", intro: "A line of best fit summarises a trend, not a cause.", concepts: ["Slope and intercept", "Residuals", "Limits of a fitted line"], example: "A slope of 2 means two extra score points per extra hour, on average, in this sample.", practice: "Predict a value from a given line and note the uncertainty.", minutes: 35 },
        ],
        exercise: { title: "Chart a question", description: "Choose and build a chart that answers one question.", deliverable: "One chart with a title, labelled axes and a two-sentence reading." },
      },
      {
        title: "Testing an idea",
        description: "Turn a hunch into a check you can defend.",
        objectives: ["State a testable question", "Explain why a result might be due to chance"],
        concepts: ["Hypotheses", "Sample size", "Chance variation"],
        lessons: [
          { title: "A testable question", description: "Make a vague idea precise.", intro: "A good question names what you will measure and compare.", concepts: ["Measurable terms", "Comparison groups", "What would change your mind"], example: "'Do evening sessions score higher than morning ones?' names a measure and a comparison.", practice: "Rewrite two vague questions so they can be tested.", minutes: 25 },
          { title: "Could it be chance?", description: "Reason about noise in small samples.", intro: "Small samples can look convincing and still mislead.", concepts: ["Sample size", "Random variation", "Repeating a check"], example: "Three sessions per group can reverse with one more session.", practice: "Describe what extra data would raise your confidence.", minutes: 30 },
        ],
        exercise: { title: "Defend a conclusion", description: "Write a short, honest conclusion from a small result.", deliverable: "A paragraph that states the result, its limits and the next check." },
      },
    ],
  },
  {
    title: "Communicating results",
    description: "Turn analysis into a clear, honest account for another person.",
    skills: ["Structuring a short report", "Stating limits", "Presenting a recommendation"],
    classes: [
      {
        title: "Writing it up",
        description: "Structure a short analysis for a reader who was not there.",
        objectives: ["Structure a short analytical report", "State limitations plainly"],
        concepts: ["Report structure", "Audience", "Limitations"],
        lessons: [
          { title: "Structuring a report", description: "Question, method, result, limits.", intro: "A reader should find the answer in the first paragraph.", concepts: ["Lead with the answer", "Show method briefly", "Separate fact from interpretation"], example: "Open with the finding, then one paragraph on data and method.", practice: "Outline a one-page report for your own dataset.", minutes: 30 },
          { title: "Stating limits", description: "Say what the analysis cannot show.", intro: "Naming limits makes a result more credible, not less.", concepts: ["Sample limits", "Measurement limits", "Scope of the claim"], example: "'This covers one month of one learner, so it describes habits, not people in general.'", practice: "Write three limits for your outline.", minutes: 25 },
        ],
        exercise: { title: "One-page report", description: "Write a one-page report with a stated limit.", deliverable: "A one-page report in your chosen format." },
      },
      {
        title: "Presenting a recommendation",
        description: "Turn findings into a decision someone can act on.",
        objectives: ["Form a recommendation from evidence", "Present it concisely"],
        concepts: ["Evidence to action", "Trade-offs", "Concise delivery"],
        lessons: [
          { title: "From finding to action", description: "Bridge evidence and decision.", intro: "A finding becomes useful when it points at a choice.", concepts: ["Actionable wording", "Trade-offs", "Confidence level"], example: "'Study in the evening block, and re-check after four more weeks.'", practice: "Turn one finding into a recommendation with a stated confidence.", minutes: 30 },
          { title: "Delivering it", description: "Say it in two minutes.", intro: "A short delivery forces clarity.", concepts: ["One message", "Supporting evidence", "Anticipating questions"], example: "One chart, one sentence of method, one recommendation.", practice: "Practise a two-minute summary and note where you hesitate.", minutes: 25 },
        ],
        exercise: { title: "Two-minute briefing", description: "Present a recommendation in two minutes.", deliverable: "Notes or slides for a two-minute briefing." },
      },
    ],
  },
];

const COMPETENCIES = [
  { id: "demo-comp-1", name: "Data literacy", description: "Read, describe and clean a tabular dataset." },
  { id: "demo-comp-2", name: "Pattern finding", description: "Choose charts and simple models that fit a question." },
  { id: "demo-comp-3", name: "Honest communication", description: "Report findings and their limits clearly." },
];

function buildLesson(mi: number, ci: number, li: number, seq: number, seed: LessonSeed): Lesson {
  return {
    id: `demo-m${mi}-c${ci}-l${li}`,
    source_id: `m${mi}c${ci}l${li}`,
    sequence: seq,
    title: seed.title,
    description: seed.description,
    estimated_duration_minutes: seed.minutes,
    blueprint: {
      introduction: seed.intro,
      objectives: [`Explain: ${seed.title.toLowerCase()}`, "Apply the idea to a small example"],
      prerequisite_concepts: [],
      concept_outline: seed.concepts,
      analogies: [],
      demonstration: [seed.example],
      guided_practice: [seed.practice],
      independent_practice: ["Repeat the practice on your own data."],
      knowledge_check: [`In your own words, what is the main idea of "${seed.title}"?`],
      summary: seed.intro,
    },
  };
}

function buildClass(mi: number, ci: number, seq: number, seed: ClassSeed, prev?: string): CourseClass {
  const id = `demo-m${mi}-c${ci}`;
  return {
    id,
    source_id: `m${mi}c${ci}`,
    sequence: seq,
    title: seed.title,
    description: seed.description,
    objectives: seed.objectives.map((d, i) => ({ id: `${id}-o${i + 1}`, description: d, competency: COMPETENCIES[mi - 1].name })),
    prerequisite_class_ids: prev ? [prev] : [],
    prerequisites: prev ? [{ id: prev, title: "Previous class" }] : [],
    estimated_duration_minutes: seed.lessons.reduce((s, l) => s + l.minutes, 0) + 40,
    key_concepts: seed.concepts,
    lessons: seed.lessons.map((l, i) => buildLesson(mi, ci, i + 1, i + 1, l)),
    exercise: {
      title: seed.exercise.title,
      description: seed.exercise.description,
      difficulty: "introductory",
      competency: COMPETENCIES[mi - 1].name,
      instructions: ["Work from the lesson examples.", "Keep a short note of your decisions."],
      expected_deliverable: seed.exercise.deliverable,
      evaluation_criteria: ["Matches the stated deliverable", "Decisions are explained"],
    },
    knowledge_check: {
      description: `A short check on ${seed.title.toLowerCase()}.`,
      question_count: 4,
      competencies: [COMPETENCIES[mi - 1].name],
    },
  };
}

const builtModules: CourseModule[] = modules.map((m, mIndex) => {
  const mi = mIndex + 1;
  const classes = m.classes.map((c, cIndex) => {
    const prevId = cIndex > 0 ? `demo-m${mi}-c${cIndex}` : undefined;
    return buildClass(mi, cIndex + 1, cIndex + 1, c, prevId);
  });
  // Give prerequisites a real title where the previous class is in the same module.
  classes.forEach((c, i) => {
    if (i > 0) c.prerequisites = [{ id: classes[i - 1].id, title: classes[i - 1].title }];
  });
  const prevModule = mIndex > 0 ? `demo-m${mIndex}` : undefined;
  return {
    id: `demo-m${mi}`,
    source_id: `m${mi}`,
    sequence: mi,
    title: m.title,
    description: m.description,
    objectives: [{ id: `demo-m${mi}-o1`, description: `Be able to ${m.skills[0].toLowerCase()}`, competency: COMPETENCIES[mIndex].name }],
    skills: m.skills,
    estimated_duration_minutes: classes.reduce((s, c) => s + c.estimated_duration_minutes, 0),
    required_previous_module_ids: prevModule ? [prevModule] : [],
    required_previous_modules: prevModule ? [{ id: prevModule, title: modules[mIndex - 1].title }] : [],
    classes,
  };
});

const version: CourseVersion = {
  id: "demo-version",
  course_id: DEMO_COURSE_ID,
  version_number: 1,
  status: "approved",
  title: "Data Analysis Foundations (sample)",
  short_description: "A sample course showing how a FRIKHII curriculum is laid out. Not generated for you.",
  description: "This sample shows the structure of a personalised course: modules, classes, lessons, objectives and practice. It exists so you can explore the workspace before creating your own course.",
  learning_goal: "Understand and explain simple data analysis.",
  target_learner_level: "beginner",
  objectives: [
    { id: "demo-o1", description: "Describe and clean a small dataset", competency: "Data literacy" },
    { id: "demo-o2", description: "Choose a chart and read a trend without over-claiming", competency: "Pattern finding" },
    { id: "demo-o3", description: "Write up a finding with its limits", competency: "Honest communication" },
  ],
  target_competencies: COMPETENCIES,
  prerequisites: [{ concept: "Comfort with basic arithmetic", reason: "Summary statistics use averages and ranges." }],
  estimated_duration_minutes: builtModules.reduce((s, m) => s + m.estimated_duration_minutes, 0),
  recommended_weekly_study_minutes: 180,
  methodology: "Short explanations, worked examples, then a small exercise and a knowledge check per class.",
  expected_outcome: "You can analyse a small dataset and report the result honestly.",
  final_project: {
    title: "Analyse your own dataset",
    description: "Pick a small dataset you care about, clean it, find one pattern and report it.",
    competencies: COMPETENCIES.map((c) => c.name),
    deliverable: "A one-page report with one chart and a stated limitation.",
    evaluation_criteria: ["Data is described accurately", "The chart fits the question", "Limits are stated"],
  },
  final_assessment: {
    title: "Final competency check",
    description: "A short assessment covering all three competencies.",
    format: "Mixed multiple choice and short answer",
    competencies: COMPETENCIES.map((c) => c.name),
    passing_criteria: ["Demonstrates each competency at an introductory level"],
  },
  assumptions: ["Sample content: assumptions are not personalised."],
  suggested_search_topics: ["introductory data analysis", "reading scatter plots"],
  generation_metadata: { provider: "demo", model: "static-sample", generated_at: "", prompt_version: "", duration_ms: 0, repaired: false, fallback_used: false, fallback_reason: null },
  warnings: [],
  created_at: "2026-01-01T00:00:00Z",
  approved_at: null,
  modules: builtModules,
};

const classes = builtModules.reduce((n, m) => n + m.classes.length, 0);
const lessons = builtModules.reduce((n, m) => n + m.classes.reduce((k, c) => k + c.lessons.length, 0), 0);

export const demoCourse: CourseDetail = {
  id: DEMO_COURSE_ID,
  learning_goal_id: "demo-goal",
  status: "approved",
  current_version_id: version.id,
  approved_version_id: version.id,
  version,
  approved_version: version,
  counts: { modules: builtModules.length, classes, lessons, exercises: classes },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
