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
