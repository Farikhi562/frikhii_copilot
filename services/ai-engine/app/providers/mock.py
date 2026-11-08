"""Deterministic provider for tests and offline development.

This provider does not call a model. The API metadata and the UI both state that the
mock provider was used. It is rejected in production configuration.
"""

from __future__ import annotations

import time
from typing import Any

from app.providers.base import ChatRequest, ChatResult, LLMProvider, LLMRequest, ProviderResult


class MockProvider(LLMProvider):
    name = "mock"
    model = "frikhii-deterministic-v1"

    async def generate_json(self, request: LLMRequest) -> ProviderResult:
        started = time.perf_counter()
        payload = request.payload
        if request.task == "diagnostic_generate":
            data = self._diagnostic(payload)
        elif request.task == "diagnostic_evaluate":
            data = self._evaluate(payload)
        elif request.task == "curriculum_generate":
            data = self._curriculum(payload)
        elif request.task == "lesson_generate":
            data = self._lesson(payload)
        elif request.task == "quiz_generate":
            data = self._quiz(payload)
        elif request.task == "quiz_evaluate":
            data = self._quiz_evaluate(payload)
        elif request.task == "exercise_generate":
            data = self._exercise(payload)
        elif request.task == "remedial_generate":
            data = self._remedial(payload)
        else:  # pragma: no cover - guarded by service dispatch
            raise ValueError(f"Unsupported mock task: {request.task}")
        return ProviderResult(
            data=data,
            provider=self.name,
            model=self.model,
            duration_ms=int((time.perf_counter() - started) * 1000),
            usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        )

    async def generate_chat(self, request: ChatRequest) -> ChatResult:
        started = time.perf_counter()
        last_msg = request.messages[-1].content if request.messages else "Halo"
        reply = (
            f"[FRIKHII AI Tutor]\n\n"
            f"Saya memahami pertanyaan Anda: \"{last_msg}\".\n\n"
            "Mari kita pelajari konsep ini dengan alur FRIKHII:\n"
            "UNDERSTAND → EXPLAIN → PRACTICE → EVALUATE → MASTER.\n\n"
            "Sebagai langkah awal, apa inti utama yang sudah Anda pahami sejauh ini?"
        )
        return ChatResult(
            text=reply,
            provider=self.name,
            model=self.model,
            duration_ms=int((time.perf_counter() - started) * 1000),
            usage={"input_tokens": 15, "output_tokens": 45, "total_tokens": 60},
            finish_reason="stop",
        )

    @staticmethod
    def _title(payload: dict[str, Any]) -> str:
        return str(payload.get("learning_goal", {}).get("title") or "Learning goal").strip()

    @staticmethod
    def _topic(payload: dict[str, Any]) -> str:
        goal = payload.get("learning_goal", {})
        return str(goal.get("goal_statement") or goal.get("title") or "the topic").strip()

    def _diagnostic(self, payload: dict[str, Any]) -> dict[str, Any]:
        title = self._title(payload)
        topic = self._topic(payload)
        count = int(payload.get("question_count", 6))
        count = max(5, min(8, count))
        templates = [
            {
                "type": "multiple_choice",
                "prompt": f"When starting to learn {title}, which activity best builds durable understanding?",
                "competency": "Learning strategy",
                "choices": [
                    {"id": "a", "text": "Explaining a concept in your own words and testing it with a small task"},
                    {"id": "b", "text": "Reading the most advanced reference first"},
                    {"id": "c", "text": "Memorising every term without applying it"},
                    {"id": "d", "text": "Skipping fundamentals and copying a finished project"},
                ],
                "answer": "a",
                "explanation": "Retrieval, explanation and deliberate practice build durable understanding.",
            },
            {
                "type": "short_answer",
                "prompt": f"In 2-4 sentences, describe what you already know about {topic} and one part that feels unclear.",
                "competency": "Self-assessment",
                "answer": "A specific prior experience, plus one concrete area of uncertainty.",
                "rubric": [
                    {"criterion": "Specific prior knowledge", "description": "Names a real concept or experience.", "weight": 0.5},
                    {"criterion": "Honest uncertainty", "description": "Names a concrete gap or question.", "weight": 0.5},
                ],
                "explanation": "Accurate self-assessment helps calibrate the starting point.",
            },
            {
                "type": "scenario",
                "prompt": f"A learner wants to reach this outcome: {topic}. They can study for a limited time each week. What should they do first, and why?",
                "competency": "Planning",
                "answer": "Identify prerequisites, set a measurable outcome, and practise a small task before expanding scope.",
                "rubric": [
                    {"criterion": "Prerequisite awareness", "description": "Considers foundational knowledge.", "weight": 0.4},
                    {"criterion": "Measurable outcome", "description": "Turns the goal into a concrete deliverable.", "weight": 0.3},
                    {"criterion": "Time realism", "description": "Fits the plan to available time.", "weight": 0.3},
                ],
                "explanation": "Goal decomposition and prerequisite awareness are prerequisites for planning.",
            },
            {
                "type": "reasoning",
                "prompt": "Explain the difference between recognising a concept and being able to apply it in a new situation.",
                "competency": "Conceptual understanding",
                "answer": "Recognition is familiarity; application requires selecting and transferring the concept to an unfamiliar problem.",
                "rubric": [
                    {"criterion": "Distinguishes recall from transfer", "description": "Explains application in a new context.", "weight": 0.6},
                    {"criterion": "Gives a concrete example", "description": "Illustrates the distinction.", "weight": 0.4},
                ],
                "explanation": "Transfer is stronger evidence of understanding than recognition.",
            },
            {
                "type": "multiple_choice",
                "prompt": "What is the most reliable sign that you have mastered a prerequisite?",
                "competency": "Metacognition",
                "choices": [
                    {"id": "a", "text": "You can complete a novel task without following a tutorial step by step"},
                    {"id": "b", "text": "You have watched all the videos in a playlist"},
                    {"id": "c", "text": "You recognise the vocabulary"},
                    {"id": "d", "text": "You copied a working example"},
                ],
                "answer": "a",
                "explanation": "Independent transfer to a novel task is stronger evidence than passive exposure.",
            },
            {
                "type": "short_answer",
                "prompt": "What would a useful final project look like for your goal? Name the deliverable and one success criterion.",
                "competency": "Outcome definition",
                "answer": "A concrete artefact plus a verifiable success criterion tied to the intended outcome.",
                "rubric": [
                    {"criterion": "Concrete deliverable", "description": "Names something that can be built or demonstrated.", "weight": 0.5},
                    {"criterion": "Verifiable criterion", "description": "States how success will be judged.", "weight": 0.5},
                ],
                "explanation": "A concrete outcome anchors the curriculum and assessment.",
            },
            {
                "type": "scenario",
                "prompt": "You encounter an error you do not understand. Describe a systematic debugging approach.",
                "competency": "Problem solving",
                "answer": "Reproduce, isolate, inspect evidence, form a hypothesis, test one change at a time, and record the result.",
                "rubric": [
                    {"criterion": "Reproduction", "description": "Establishes a reliable reproduction.", "weight": 0.3},
                    {"criterion": "Isolation", "description": "Narrows the problem before changing code.", "weight": 0.4},
                    {"criterion": "Evidence-based iteration", "description": "Tests one hypothesis at a time.", "weight": 0.3},
                ],
                "explanation": "Systematic debugging is a transferable engineering competency.",
            },
            {
                "type": "reasoning",
                "prompt": "Why can a plan that works for one learner be a poor plan for another with the same goal?",
                "competency": "Personalisation",
                "answer": "Prior knowledge, available time, constraints and learning preferences change the right starting point and pace.",
                "rubric": [
                    {"criterion": "Prior knowledge", "description": "Mentions different starting points.", "weight": 0.4},
                    {"criterion": "Constraints and pace", "description": "Mentions time or context.", "weight": 0.3},
                    {"criterion": "Preferences", "description": "Mentions learning approach.", "weight": 0.3},
                ],
                "explanation": "Personalisation depends on context, not just the goal statement.",
            },
        ]
        questions = []
        keys = []
        for index, template in enumerate(templates[:count], start=1):
            qid = f"q{index}"
            choices = template.get("choices", [])
            questions.append(
                {
                    "id": qid,
                    "sequence": index,
                    "type": template["type"],
                    "prompt": template["prompt"],
                    "competency": template["competency"],
                    "difficulty": "foundation" if index <= 2 else "intermediate",
                    "choices": choices,
                    "explanation": template["explanation"],
                }
            )
            keys.append(
                {
                    "question_id": qid,
                    "expected_answer": template["answer"],
                    "rubric": template.get("rubric", []),
                }
            )
        return {
            "question_set": {
                "analysis": {
                    "normalized_topic": title[:200],
                    "summary": f"A diagnostic for {title}, focused on prerequisites, planning and transfer rather than trivia.",
                    "prerequisites": [
                        {
                            "concept": "Comfort with self-directed practice",
                            "reason": "The curriculum expects independent practice between sessions.",
                        }
                    ],
                    "competencies": [
                        {"id": "comp-planning", "name": "Learning planning", "description": "Turning a goal into a realistic sequence of practice."},
                        {"id": "comp-foundation", "name": "Foundational understanding", "description": "Explaining core concepts in your own words."},
                        {"id": "comp-transfer", "name": "Applied transfer", "description": "Using concepts in unfamiliar tasks."},
                    ],
                    "complexity": "medium",
                    "assumptions": ["The learner can study in short weekly sessions."],
                },
                "questions": questions,
                "estimated_minutes": max(5, count * 2),
                "warnings": [],
            },
            "answer_keys": keys,
        }

    def _evaluate(self, payload: dict[str, Any]) -> dict[str, Any]:
        questions = payload.get("questions", [])
        keys = {item["question_id"]: item for item in payload.get("answer_keys", [])}
        answers = {item["question_id"]: str(item.get("response", "")) for item in payload.get("answers", [])}
        scores = []
        total = 0
        for question in questions:
            qid = question["id"]
            answer = answers.get(qid, "").strip()
            key = keys.get(qid, {})
            expected = str(key.get("expected_answer", "")).strip().lower()
            if question.get("type") == "multiple_choice":
                score = 100 if answer.lower() == expected else 15
                feedback = "Correct choice." if score == 100 else "This choice misses a key principle."
            else:
                answer_words = {word for word in answer.lower().split() if len(word) > 4}
                expected_words = {word for word in expected.split() if len(word) > 4}
                overlap = len(answer_words & expected_words) / max(1, len(expected_words))
                if len(answer) < 15:
                    score = 10
                    feedback = "The answer is too brief to show understanding."
                else:
                    score = int(min(95, 45 + overlap * 50))
                    feedback = (
                        "Shows relevant understanding; add a concrete example to strengthen it."
                        if score < 80
                        else "Strong, specific answer with relevant reasoning."
                    )
            total += score
            scores.append({"question_id": qid, "score": score, "feedback": feedback})

        average = total / max(1, len(scores))
        if average >= 82:
            level = "advanced"
        elif average >= 62:
            level = "intermediate"
        elif average >= 38:
            level = "beginner"
        else:
            level = "foundation"
        confidence = "medium" if len(scores) >= 5 else "low"
        weak = [item for item in scores if item["score"] < 55]
        strong = [item for item in scores if item["score"] >= 75]
        gap_templates = [
            {
                "competency": "Applied transfer",
                "description": "Some answers show recognition but not yet independent application.",
                "severity": "medium",
                "recommendation": "Start with guided practice that ends in one unassisted task per class.",
            },
            {
                "competency": "Planning",
                "description": "The plan needs a clearer first milestone and a realistic weekly scope.",
                "severity": "low",
                "recommendation": "Define a small weekly deliverable and review it before expanding scope.",
            },
        ]
        return {
            "estimated_level": level,
            "confidence": confidence,
            "summary": f"Your responses suggest a {level} starting point for {self._title(payload)}. The estimate is based on {len(scores)} answers and is not a certification.",
            "strengths": [
                {
                    "competency": "Foundational understanding",
                    "evidence": "You described prior knowledge and a concrete area to improve.",
                }
            ]
            if strong
            else [],
            "gaps": gap_templates[: max(1, min(2, len(weak)))],
            "misconceptions": [] if not weak else ["Confusing familiarity with demonstrated ability."],
            "recommended_start": "Start with a short foundations module, then move to applied practice once the first knowledge check is passed.",
            "rationale": "The evidence points to gaps in transfer and planning rather than a lack of interest. A guided foundation followed by independent practice is the smallest sensible next step.",
            "question_scores": scores,
            "can_skip": ["Basic vocabulary revision"] if level in {"intermediate", "advanced"} else [],
        }

    def _curriculum(self, payload: dict[str, Any]) -> dict[str, Any]:
        title = self._title(payload)
        goal = self._topic(payload)
        diagnostic = payload.get("diagnostic", {})
        level = diagnostic.get("estimated_level", "beginner")
        available = int(payload.get("learning_goal", {}).get("weekly_study_minutes", 300))
        available = max(60, min(1200, available))
        modules_count = 2 if level == "advanced" else 3

        objectives = [
            {
                "id": "obj-course-1",
                "description": f"Explain the core concepts needed for {title} in your own words.",
                "competency": "Foundational understanding",
            },
            {
                "id": "obj-course-2",
                "description": "Apply the concepts to a small, unfamiliar task without step-by-step guidance.",
                "competency": "Applied transfer",
            },
            {
                "id": "obj-course-3",
                "description": "Plan, build and evaluate a project that demonstrates the intended outcome.",
                "competency": "Project execution",
            },
        ]
        competencies = [
            {"id": "comp-foundation", "name": "Foundational understanding", "description": "Explain and connect the core ideas."},
            {"id": "comp-transfer", "name": "Applied transfer", "description": "Use the ideas in new situations."},
            {"id": "comp-project", "name": "Project execution", "description": "Deliver a coherent artefact and evaluate it."},
        ]

        modules = []
        class_global = 0
        for module_index in range(1, modules_count + 1):
            classes = []
            for class_index in range(1, 3):
                class_global += 1
                class_id = f"m{module_index}c{class_index}"
                objectives_class = [
                    {
                        "id": f"obj-{class_id}-1",
                        "description": f"Explain the key idea of class {class_global} and connect it to the previous class.",
                        "competency": "Foundational understanding",
                    },
                    {
                        "id": f"obj-{class_id}-2",
                        "description": "Complete a short applied task with limited guidance.",
                        "competency": "Applied transfer",
                    },
                ]
                lessons = []
                for lesson_index in range(1, 3):
                    lesson_id = f"{class_id}l{lesson_index}"
                    focus = (
                        "core concept"
                        if lesson_index == 1
                        else "applied example and common mistakes"
                    )
                    lessons.append(
                        {
                            "id": lesson_id,
                            "sequence": lesson_index,
                            "title": f"{focus.title()} for {title}"[:100],
                            "description": f"A focused lesson on the {focus} for class {class_global}.",
                            "estimated_duration_minutes": 40,
                            "blueprint": {
                                "introduction": f"Connect the learner's current knowledge to the {focus}.",
                                "objectives": [
                                    f"Explain the {focus} in your own words.",
                                    "Complete one small task using it.",
                                ],
                                "prerequisite_concepts": ["Previous class key idea"],
                                "concept_outline": [
                                    "Definition and purpose",
                                    "How it works step by step",
                                    "When to use it and when not to",
                                ],
                                "analogies": [
                                    "A workshop: learn the tool, use it on scrap material, then build the real piece."
                                ],
                                "demonstration": [
                                    "Work through one example while narrating each decision.",
                                ],
                                "guided_practice": [
                                    "Repeat the example with a different input and compare results.",
                                ],
                                "independent_practice": [
                                    "Apply the idea to a small task without a worked solution.",
                                ],
                                "knowledge_check": [
                                    "Explain the idea and show one worked example.",
                                ],
                                "summary": f"Summarise the {focus} and connect it to the next lesson.",
                            },
                        }
                    )
                prev_prereq = [] if class_global == 1 else [f"m{module_index}c{class_index - 1}" if class_index > 1 else f"m{module_index - 1}c2"]
                classes.append(
                    {
                        "id": class_id,
                        "sequence": class_index,
                        "title": f"Class {class_global}: {title} in practice"[:120],
                        "description": f"Build and check understanding of {title} through explanation and practice.",
                        "objectives": objectives_class,
                        "prerequisite_class_ids": prev_prereq,
                        "estimated_duration_minutes": 120,
                        "key_concepts": [
                            "Core vocabulary",
                            "A worked example",
                            "A common failure mode",
                        ],
                        "lessons": lessons,
                        "exercise": {
                            "title": f"Practice task {class_global}",
                            "description": f"Apply the concepts from class {class_global} to a small deliverable.",
                            "difficulty": "foundation" if module_index == 1 else "intermediate",
                            "competency": "Applied transfer",
                            "instructions": [
                                "Restate the task in your own words.",
                                "Build the smallest working version.",
                                "Check it against the criteria and record one improvement.",
                            ],
                            "expected_deliverable": "A small working artefact and a short reflection.",
                            "evaluation_criteria": [
                                "The artefact works for the stated input.",
                                "The explanation shows why it works.",
                                "The reflection names one limitation.",
                            ],
                        },
                        "knowledge_check": {
                            "description": f"A short check of the concepts from class {class_global}.",
                            "question_count": 4,
                            "competencies": ["Foundational understanding", "Applied transfer"],
                        },
                    }
                )
            modules.append(
                {
                    "id": f"m{module_index}",
                    "sequence": module_index,
                    "title": f"Module {module_index}: {title} foundations"[:120]
                    if module_index == 1
                    else f"Module {module_index}: applying {title}"[:120],
                    "description": f"A coherent block of study for {title}, with explanation, practice and a check.",
                    "objectives": [
                        {
                            "id": f"obj-m{module_index}-1",
                            "description": f"Explain the main ideas covered in module {module_index}.",
                            "competency": "Foundational understanding",
                        },
                        {
                            "id": f"obj-m{module_index}-2",
                            "description": f"Apply module {module_index} ideas in a small task.",
                            "competency": "Applied transfer",
                        },
                    ],
                    "skills": ["Explanation", "Deliberate practice", "Self-evaluation"],
                    "estimated_duration_minutes": 240,
                    "required_previous_module_ids": [] if module_index == 1 else [f"m{module_index - 1}"],
                    "classes": classes,
                }
            )

        module_total = sum(module["estimated_duration_minutes"] for module in modules)
        return {
            "title": f"{title} — personalised path"[:160],
            "short_description": f"A {modules_count}-module path from your current starting point to a practical outcome for {title}."[:400],
            "description": f"This curriculum responds to the goal: {goal}. It begins at the estimated {level} level, closes the diagnosed gaps, and ends with a project that demonstrates the outcome.",
            "learning_goal": goal,
            "target_learner_level": level,
            "target_competencies": competencies,
            "prerequisites": [
                {
                    "concept": "Consistent weekly practice",
                    "reason": "The plan assumes short, regular sessions rather than one long block.",
                }
            ],
            "estimated_duration_minutes": module_total + 180,
            "recommended_weekly_study_minutes": available,
            "methodology": "Explain, demonstrate, practise with guidance, then practise independently. Each class ends with a short knowledge check and a reflection.",
            "expected_outcome": f"You will be able to explain and apply the core ideas of {title}, and deliver a small project that demonstrates the intended outcome.",
            "objectives": objectives,
            "modules": modules,
            "final_project": {
                "title": f"Final project: {title}",
                "description": f"Build a small but complete artefact that demonstrates the intended outcome for {title}.",
                "competencies": ["Applied transfer", "Project execution"],
                "deliverable": "A working artefact, a short README-style explanation, and a self-evaluation against the criteria.",
                "evaluation_criteria": [
                    "The deliverable addresses the stated outcome.",
                    "The explanation is accurate and specific.",
                    "The self-evaluation identifies one limitation and one next step.",
                ],
            },
            "final_assessment": {
                "title": "Final competency assessment",
                "description": "A practical assessment combining a task, an explanation and a reflection.",
                "format": "Open-book practical task with a short oral or written defence.",
                "competencies": ["Foundational understanding", "Applied transfer", "Project execution"],
                "passing_criteria": [
                    "The practical task meets the stated criteria.",
                    "The explanation is accurate and uses the course vocabulary correctly.",
                    "The reflection identifies limitations without overclaiming mastery.",
                ],
            },
            "assumptions": [
                "The learner can commit the stated weekly time.",
                "The diagnostic is an estimate, not a certification.",
            ],
            "suggested_search_topics": [f"{title} fundamentals", f"{title} project examples"],
        }


    def _lesson(self, payload: dict[str, Any]) -> dict[str, Any]:
        lesson_id = str(payload.get("lesson_id") or "lesson-1")
        title = str(payload.get("title") or "Lesson").strip()
        class_title = str(payload.get("class_title") or "Class").strip()
        level = str(payload.get("learner_level") or "foundation")
        sections = [
            {
                "type": "introduction",
                "title": f"Why this lesson matters",
                "body": (
                    f"This lesson opens {class_title} by connecting what you already know to "
                    f"the new ideas in {title}. Read the core idea first, then use the worked "
                    "example to check your understanding before moving on."
                ),
                "items": [],
            },
            {
                "type": "objective",
                "title": "What you will be able to do",
                "body": "By the end of this lesson you should be able to do the following on your own:",
                "items": [
                    f"Explain the key idea of {title} in your own words.",
                    "Apply the idea to one small, concrete task.",
                    "Spot one common mistake and describe how to avoid it.",
                ],
            },
            {
                "type": "concept",
                "title": "The core idea",
                "body": (
                    f"The central concept of {title} is simple: each part has a purpose, and the "
                    "parts work together as a system. Start from the definition, then trace what "
                    "happens step by step when the idea is applied. If you can narrate each step "
                    "and say why it happens, you understand the concept rather than just "
                    "recognising it."
                ),
                "items": [
                    "Definition: what the idea is and what problem it solves.",
                    "Mechanism: what happens step by step when it is used.",
                    "Boundaries: when it applies and when it does not.",
                ],
            },
            {
                "type": "analogy",
                "title": "A quick analogy",
                "body": (
                    "Think of a workshop: you learn a tool on scrap material first, then use it "
                    f"on the real piece. {title} works the same way - practise the idea on a small "
                    "example before you rely on it for anything important."
                ),
                "items": [],
            },
            {
                "type": "demonstration",
                "title": "Worked example",
                "body": (
                    f"Take one small example of {title}. Work through it in order: state the "
                    "input, apply the idea, observe the output, and explain why the output makes "
                    "sense. Narrating each decision out loud turns passive reading into "
                    "understanding."
                ),
                "items": [
                    "State what you start with.",
                    "Apply the idea one step at a time.",
                    "Check the result against what you expected.",
                ],
            },
            {
                "type": "guided_practice",
                "title": "Practice with guidance",
                "body": (
                    "Repeat the worked example with a different input. Compare your result with "
                    "the example and note where your reasoning differed. Those differences are "
                    "the most useful feedback you can get."
                ),
                "items": [],
            },
            {
                "type": "independent_practice",
                "title": "Practice on your own",
                "body": (
                    "Now apply the idea to a fresh task without looking at the worked example. "
                    "Complete it, then check your answer against the criteria from the concept "
                    "section."
                ),
                "items": [],
            },
            {
                "type": "knowledge_check",
                "title": "Quick check",
                "body": (
                    "Explain the core idea in two sentences and give one example of when you "
                    "would use it. If you cannot do that yet, reread the concept section before "
                    "continuing."
                ),
                "items": [],
            },
            {
                "type": "summary",
                "title": "Summary",
                "body": (
                    f"You have covered the core idea of {title}, seen a worked example, and "
                    "practised it twice. The next lesson builds directly on this one, so make "
                    "sure the quick check feels easy before moving on."
                ),
                "items": [],
            },
        ]
        return {
            "lesson_id": lesson_id,
            "title": title[:240],
            "estimated_duration_minutes": 30,
            "sections": sections,
            "key_takeaways": [
                f"Explain the core idea of {title} before applying it.",
                "Practise on a small example first, then on a fresh task.",
                "Check your result against explicit criteria, not just intuition.",
            ],
            "further_search_topics": [f"{title} worked examples", f"{title} common mistakes"],
        }

    def _quiz(self, payload: dict[str, Any]) -> dict[str, Any]:
        title = str(payload.get("class_title") or "Class").strip()
        course = str(payload.get("course_title") or "Course").strip()
        competencies = payload.get("competencies") or ["Applied understanding"]
        competency = str(competencies[0])[:240] or "Applied understanding"
        count = int(payload.get("question_count") or 5)
        count = max(3, min(10, count))
        templates = [
            {
                "type": "multiple_choice",
                "prompt": f"After {title}, which activity best shows that you can apply the core idea independently?",
                "choices": [
                    {"id": "a", "text": "Complete a small unfamiliar task without step-by-step guidance"},
                    {"id": "b", "text": "Re-read the lesson notes once more"},
                    {"id": "c", "text": "Copy the worked example with different names"},
                    {"id": "d", "text": " memorise the vocabulary list"},
                ],
                "answer": "a",
                "explanation": "Independent transfer to a new task is the strongest evidence of application.",
            },
            {
                "type": "short_answer",
                "prompt": f"In 2-4 sentences, explain the main idea of {title} and give one concrete example of using it.",
                "answer": "A clear explanation of the main idea plus one specific, concrete example of application.",
                "rubric": [
                    {"criterion": "Accurate explanation", "description": "States the main idea correctly.", "weight": 0.6},
                    {"criterion": "Concrete example", "description": "Gives one specific example.", "weight": 0.4},
                ],
                "explanation": "Explanation plus example demonstrates both recall and application.",
            },
            {
                "type": "scenario",
                "prompt": f"You are using {title} in a real project and the result is wrong. Describe how you would diagnose and fix the problem.",
                "answer": "Reproduce the problem, isolate the failing part, inspect the evidence, test one change at a time, and record the result.",
                "rubric": [
                    {"criterion": "Systematic diagnosis", "description": "Reproduces and isolates before changing anything.", "weight": 0.5},
                    {"criterion": "One change at a time", "description": "Tests a single hypothesis per step.", "weight": 0.5},
                ],
                "explanation": "Systematic debugging is a transferable competency.",
            },
            {
                "type": "reasoning",
                "prompt": f"Why can memorising the steps of {title} fail when you face a new situation?",
                "answer": "Memorised steps do not transfer; understanding the purpose of each step lets you adapt when the situation differs.",
                "rubric": [
                    {"criterion": "Distinguishes recall from transfer", "description": "Explains why memorisation fails on new inputs.", "weight": 0.6},
                    {"criterion": "Names the adaptation", "description": "Says what understanding enables.", "weight": 0.4},
                ],
                "explanation": "Transfer requires understanding purpose, not just sequence.",
            },
            {
                "type": "multiple_choice",
                "prompt": f"What is the best way to check that you are ready for the next class in {course}?",
                "choices": [
                    {"id": "a", "text": "Explain the idea and complete one small task without help"},
                    {"id": "b", "text": "Highlight every paragraph in the lesson"},
                    {"id": "c", "text": "Watch the same explanation three times"},
                    {"id": "d", "text": "Read the answers from a previous attempt"},
                ],
                "answer": "a",
                "explanation": "Unaided explanation plus one task is a reliable readiness check.",
            },
            {
                "type": "short_answer",
                "prompt": "Describe one mistake you might make when applying this class concept, and how you would notice and correct it.",
                "answer": "A specific plausible mistake, a way to detect it from the output, and a concrete correction.",
                "rubric": [
                    {"criterion": "Specific mistake", "description": "Names a plausible error.", "weight": 0.4},
                    {"criterion": "Detection and correction", "description": "Explains how to notice and fix it.", "weight": 0.6},
                ],
                "explanation": "Anticipating errors is evidence of durable understanding.",
            },
            {
                "type": "scenario",
                "prompt": "A teammate asks you to explain this concept in one minute, without jargon. Write what you would say.",
                "answer": "A plain-language summary with one everyday analogy and one concrete example.",
                "rubric": [
                    {"criterion": "Plain language", "description": "Avoids unexplained jargon.", "weight": 0.5},
                    {"criterion": "Analogy plus example", "description": "Uses a relatable comparison and a concrete case.", "weight": 0.5},
                ],
                "explanation": "Simplifying without losing accuracy shows mastery.",
            },
            {
                "type": "reasoning",
                "prompt": "Why is finishing a lesson not the same as mastering the material?",
                "answer": "Completion records exposure; mastery requires retrieving, explaining and applying the material later without support.",
                "rubric": [
                    {"criterion": "Exposure versus retrieval", "description": "Distinguishes reading from recall.", "weight": 0.5},
                    {"criterion": "Names mastery evidence", "description": "Points to later unaided application.", "weight": 0.5},
                ],
                "explanation": "Mastery is demonstrated by delayed, unaided use.",
            },
            {
                "type": "multiple_choice",
                "prompt": f"When your {title} result differs from the expected result, what should you do first?",
                "choices": [
                    {"id": "a", "text": "Check your inputs and assumptions before changing the approach"},
                    {"id": "b", "text": "Switch to a completely different method immediately"},
                    {"id": "c", "text": "Change several things at once until something works"},
                    {"id": "d", "text": "Ignore the difference if the code runs"},
                ],
                "answer": "a",
                "explanation": "Verify inputs and assumptions first; change one thing at a time after that.",
            },
            {
                "type": "short_answer",
                "prompt": "What would you search for next to deepen your understanding of this class topic, and why that resource?",
                "answer": "A specific follow-up topic and a reason it targets the remaining gap, such as a worked example set or an official reference.",
                "rubric": [
                    {"criterion": "Targeted topic", "description": "Names a topic that closes a real gap.", "weight": 0.5},
                    {"criterion": "Reasoned choice", "description": "Explains why that resource.", "weight": 0.5},
                ],
                "explanation": "Choosing the next resource shows metacognitive control.",
            },
        ]
        questions = []
        keys = []
        for index, template in enumerate(templates[:count], start=1):
            qid = f"q{index}"
            questions.append(
                {
                    "id": qid,
                    "sequence": index,
                    "type": template["type"],
                    "prompt": template["prompt"],
                    "competency": competency,
                    "difficulty": "foundation" if index <= 3 else "intermediate",
                    "choices": template.get("choices", []),
                    "explanation": template["explanation"],
                }
            )
            keys.append(
                {
                    "question_id": qid,
                    "expected_answer": template["answer"],
                    "rubric": template.get("rubric", []),
                }
            )
        return {
            "questions": questions,
            "answer_keys": keys,
            "passing_score": 80,
        }

    def _quiz_evaluate(self, payload: dict[str, Any]) -> dict[str, Any]:
        questions = payload.get("questions", [])
        keys = {item["question_id"]: item for item in payload.get("answer_keys", [])}
        answers = {item["question_id"]: str(item.get("response", "")) for item in payload.get("answers", [])}
        passing = int(payload.get("passing_score") or 70)
        scores = []
        total = 0
        for question in questions:
            qid = question["id"]
            answer = answers.get(qid, "").strip()
            key = keys.get(qid, {})
            expected = str(key.get("expected_answer", "")).strip().lower()
            if question.get("type") == "multiple_choice":
                correct = answer.lower() == expected
                score = 100 if correct else 20
                feedback = "Correct choice." if correct else "This choice misses a key principle."
            else:
                if len(answer) < 15:
                    score = 25
                    feedback = "The answer is too brief to show understanding; add a concrete example."
                else:
                    answer_words = {word for word in answer.lower().split() if len(word) > 4}
                    expected_words = {word for word in expected.split() if len(word) > 4}
                    overlap = len(answer_words & expected_words) / max(1, len(expected_words))
                    score = int(min(95, 50 + overlap * 50))
                    feedback = (
                        "Relevant understanding; add one concrete example to strengthen it."
                        if score < 80
                        else "Strong, specific answer with relevant reasoning."
                    )
            total += score
            scores.append({"question_id": qid, "score": score, "feedback": feedback})

        average = int(round(total / max(1, len(scores))))
        passed = average >= passing
        strong = [item for item in scores if item["score"] >= 80]
        weak = [item for item in scores if item["score"] < passing]
        class_title = str(payload.get("class_title") or "this class").strip()
        gaps = []
        if weak:
            gaps.append(
                {
                    "competency": "Applied understanding",
                    "description": f"{len(weak)} answer(s) in {class_title} show recognition but not yet reliable application.",
                    "severity": "medium" if len(weak) > 1 else "low",
                    "recommendation": "Review the class explanation, then complete one small task unaided before retrying.",
                }
            )
        strengths = []
        if strong:
            strengths.append(
                f"Solid answers on {len(strong)} question(s), especially the core concept questions."
            )
        summary = (
            f"You scored {average}% against a {passing}% pass mark for {class_title}. "
            + (
                "The core ideas are in place; focus on the gaps listed below."
                if passed
                else "The gaps below need another pass before the next class unlocks."
            )
        )
        return {
            "evaluation": {
                "score": max(0, min(100, average)),
                "passed": passed,
                "summary": summary,
                "strengths": strengths,
                "gaps": gaps,
                "question_scores": scores,
            }
        }

    def _exercise(self, payload: dict[str, Any]) -> dict[str, Any]:
        title = str(payload.get("exercise_title") or "Practice task").strip()
        class_title = str(payload.get("class_title") or "Class").strip()
        return {
            "title": title[:240],
            "context": (
                f"You have just finished {class_title}. This task asks you to use the class "
                "concepts on a small, self-contained deliverable so you can see whether the "
                "ideas hold outside the lesson."
            ),
            "steps": [
                {
                    "step_number": 1,
                    "instruction": "Restate the task in your own words, including the input you are given and the result you must produce.",
                    "hint": "One or two sentences is enough; the point is to fix the goal in your own terms.",
                },
                {
                    "step_number": 2,
                    "instruction": "Build the smallest working version that satisfies the task, using the core idea from the class.",
                    "hint": "Do not add extra features yet; correctness first.",
                },
                {
                    "step_number": 3,
                    "instruction": "Check your result against the evaluation criteria and record one limitation you noticed.",
                    "hint": "Name a real limitation, even a small one - it shows you understand the boundaries.",
                },
            ],
            "expected_deliverable": (
                "A small working artefact plus a short reflection: what you built, which class "
                "concept you used, and one limitation with an idea for improving it."
            ),
            "evaluation_criteria": [
                "The artefact produces the correct result for the stated input.",
                "The explanation names the class concept that makes it work.",
                "The reflection identifies one honest limitation.",
            ],
            "further_search_topics": [f"{class_title} worked examples", "testing small deliverables"],
        }

    def _remedial(self, payload: dict[str, Any]) -> dict[str, Any]:
        class_title = str(payload.get("class_title") or "Class").strip()
        course_title = str(payload.get("course_title") or "Course").strip()
        score = int(payload.get("quiz_score") or 0)
        passing = int(payload.get("passing_score") or 70)
        gaps = payload.get("gaps") or []
        gap_names = [str(gap.get("competency") or "core concept") for gap in gaps][:3]
        weekly = int(payload.get("weekly_study_minutes") or 300)
        per_session = max(15, min(60, weekly // 4))
        concepts = gap_names or ["core concept"]
        return {
            "gap_summary": (
                f"Your {class_title} assessment scored {score}% against a {passing}% pass mark. "
                f"The main gaps are: {', '.join(concepts)}. This plan re-closes them in small "
                "sessions that fit your weekly study time."
            ),
            "estimated_total_minutes": min(600, per_session * 4),
            "activities": [
                {
                    "sequence": 1,
                    "title": f"Re-read the {class_title} explanation",
                    "description": (
                        "Read the class explanation once, then write a three-sentence summary "
                        "of the main idea without looking. Compare and fix what you missed."
                    ),
                    "activity_type": "review",
                    "estimated_minutes": per_session,
                    "target_gap": concepts[0],
                },
                {
                    "sequence": 2,
                    "title": "Work one guided example",
                    "description": (
                        "Complete one worked example end to end, narrating why each step "
                        "happens. Focus on the step that caused your wrong answers."
                    ),
                    "activity_type": "worked_example",
                    "estimated_minutes": per_session,
                    "target_gap": concepts[0],
                },
                {
                    "sequence": 3,
                    "title": "One unaided practice task",
                    "description": (
                        "Apply the concept to a fresh task without the worked solution, then "
                        "check it against the evaluation criteria from the class exercise."
                    ),
                    "activity_type": "practice",
                    "estimated_minutes": per_session,
                    "target_gap": concepts[-1],
                },
                {
                    "sequence": 4,
                    "title": "Knowledge check retry",
                    "description": (
                        "Answer three questions about the gaps out loud or in writing before "
                        "you retry the class assessment. If any answer feels shaky, revisit "
                        "that step first."
                    ),
                    "activity_type": "knowledge_check",
                    "estimated_minutes": max(10, per_session // 2),
                    "target_gap": concepts[0],
                },
            ],
            "key_concepts_to_revisit": concepts,
            "further_search_topics": [f"{class_title} common mistakes", f"{course_title} fundamentals"],
            "encouragement": (
                "A below-pass score means the material needs one more pass, not that you "
                "cannot learn it. Four short sessions usually close gaps like these - retry "
                "the assessment once the unaided practice feels comfortable."
            ),
        }
