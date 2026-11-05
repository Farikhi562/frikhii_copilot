/**
 * FAQ copy for the landing page.
 *
 * Every `status` and `note` reflects what the repository actually implements
 * (see docs/DEVELOPMENT_ROADMAP.md). Update this file whenever a roadmap phase
 * ships so the page never describes a planned feature as available.
 *
 * - "built":   implemented in this build; live provider/database/E2E still being verified.
 * - "partial": some of what the answer describes is built, the rest is planned.
 * - "planned": on the roadmap, not available.
 */
export type FaqStatus = "built" | "partial" | "planned";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  status?: FaqStatus;
  note?: string;
};

export const faqStatusMeta: Record<FaqStatus, { label: string; description: string }> = {
  built: {
    label: "Built, in testing",
    description: "Works in this build. Still being verified end to end.",
  },
  partial: {
    label: "Partly built",
    description: "Some of it works today. The rest is on the roadmap.",
  },
  planned: {
    label: "Planned",
    description: "On the roadmap. Not available yet.",
  },
};

export const faqItems: FaqItem[] = [
  {
    id: "what-is",
    question: "What is FRIKHII Copilot?",
    answer:
      "FRIKHII Copilot is a personal AI learning companion designed to transform learning goals into structured learning journeys, personalized courses, guided lessons, and measurable progress.",
    status: "partial",
    note: "Today you can set a learning goal, take a short diagnostic and review a proposed curriculum. Guided lessons and measurable progress are planned, not yet available.",
  },
  {
    id: "how-it-works",
    question: "How does FRIKHII Copilot work?",
    answer:
      "Users describe what they want to learn. The system analyzes their starting knowledge, proposes a learning curriculum, and guides them through a structured learning journey.",
    status: "partial",
    note: "Describing your goal, a diagnostic of your starting knowledge and a curriculum proposal are built. The guided journey that follows is planned.",
  },
  {
    id: "beginner",
    question: "Can I use FRIKHII Copilot as a complete beginner?",
    answer:
      "Yes. The learning journey is designed to adapt to the user's current knowledge and build foundational understanding before progressing to more advanced topics.",
    status: "partial",
    note: "Your self-reported level is treated as an estimate and checked with a short diagnostic before a curriculum is proposed. The lessons themselves are planned.",
  },
  {
    id: "vs-chatbot",
    question: "How is FRIKHII Copilot different from a regular AI chatbot?",
    answer:
      "Instead of only answering individual questions, FRIKHII Copilot is designed around structured courses, learning objectives, practice, assessment, and continuous progress.",
    status: "partial",
    note: "Structured courses, learning objectives, practice plans and the diagnostic are built. Interactive practice, assessment, an AI tutor and progress tracking are planned.",
  },
  {
    id: "customize",
    question: "Can I customize an AI-generated curriculum?",
    answer:
      "The intended experience allows learners to review, refine, and approve their proposed curriculum before starting their learning journey.",
    status: "built",
    note: "You can edit the course title, description, and module and class names, request a new draft with extra instructions, and approve it before it appears in your courses. A new draft never overwrites a version you have approved.",
  },
  {
    id: "mentors",
    question: "Does FRIKHII Copilot replace lecturers or human mentors?",
    answer:
      "No. It is designed as a learning companion that supports independent study and helps learners prepare better questions, strengthen understanding, and practice their skills.",
  },
  {
    id: "affiliation",
    question: "Is FRIKHII Copilot officially affiliated with Universitas Gunadarma?",
    answer:
      "No. FRIKHII Copilot is an independent product and is not an official Universitas Gunadarma platform or partnership.",
    note: "No university systems are connected to FRIKHII Copilot.",
  },
  {
    id: "trust",
    question: "Can AI-generated learning content always be trusted?",
    answer:
      "AI-generated content can contain mistakes or incomplete explanations. Learners should critically evaluate important information and verify relevant facts using reliable sources.",
    note: "Generated curricula are checked for structure and consistency, not for factual accuracy. Output that looks like a URL or citation is rejected, and where a source would help you get a suggested search topic instead.",
  },
];

/** schema.org FAQPage JSON-LD built from the same data the page renders. */
export function faqJsonLd(items: FaqItem[] = faqItems): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.note ? `${item.answer} ${item.note}` : item.answer,
      },
    })),
  };
  // "<" is escaped so the payload can never close the surrounding <script> tag.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
