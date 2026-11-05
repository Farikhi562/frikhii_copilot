package validate

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/frikhii/copilot/core-api/internal/domain"
)

var httpPrefix = regexp.MustCompile(`(?i)(https?://|www\.|doi\.org|arxiv\.org)`)

const (
	maxCourseBytes = 512_000
	maxModules     = 12
	maxClasses     = 60
	maxLessons     = 300
)

// Curriculum is the Go-side structural validation of AI output. The Python engine
// already validates, but the Core API must not persist data trusted only from another
// service (or from a compromised/misconfigured provider response).
func Curriculum(course domain.CourseBlueprint) []string {
	var errors []string
	add := func(format string, args ...any) {
		errors = append(errors, fmt.Sprintf(format, args...))
	}

	if strings.TrimSpace(course.Title) == "" {
		add("course title is empty")
	}
	if len(course.Objectives) == 0 {
		add("course has no objectives")
	}
	if len(course.TargetCompetencies) == 0 {
		add("course has no target competencies")
	}
	if len(course.Modules) == 0 || len(course.Modules) > maxModules {
		add("course must contain between 1 and %d modules", maxModules)
	}
	if course.EstimatedDurationMinutes <= 0 {
		add("course duration must be positive")
	}
	if course.RecommendedWeeklyStudyMinutes <= 0 {
		add("recommended weekly study minutes must be positive")
	}
	if hasURL(course) {
		add("generated content contains a URL or citation-like reference")
	}

	ids := map[string]string{}
	claim := func(id, where string) {
		if id == "" {
			add("%s has an empty id", where)
			return
		}
		if previous, exists := ids[id]; exists {
			add("duplicate id %q in %s and %s", id, previous, where)
			return
		}
		ids[id] = where
	}
	for _, objective := range course.Objectives {
		claim(objective.ID, "course objective")
	}
	for _, competency := range course.TargetCompetencies {
		claim(competency.ID, "target competency")
	}

	moduleOrder := map[string]int{}
	classOrder := map[string]int{}
	moduleTitles := map[string]string{}
	classTitles := map[string]string{}
	classCount := 0
	lessonCount := 0
	classSequence := 0

	for moduleIndex, module := range course.Modules {
		claim(module.ID, fmt.Sprintf("module %d", moduleIndex+1))
		if module.Sequence != moduleIndex+1 {
			add("module %q has non-contiguous sequence", module.ID)
		}
		moduleOrder[module.ID] = module.Sequence
		moduleTitles[module.ID] = module.Title
		if len(module.Classes) == 0 {
			add("module %q contains no classes", module.ID)
		}
		if len(module.Classes) > 8 {
			add("module %q contains more than 8 classes", module.ID)
		}
		if len(module.Objectives) == 0 {
			add("module %q has no objectives", module.ID)
		}
		for _, objective := range module.Objectives {
			claim(objective.ID, "module objective")
		}
		for index, class := range module.Classes {
			classCount++
			classSequence++
			claim(class.ID, fmt.Sprintf("class %d", classCount))
			if class.Sequence != index+1 {
				add("class %q has non-contiguous sequence", class.ID)
			}
			classOrder[class.ID] = classSequence
			classTitles[class.ID] = class.Title
			if len(class.Objectives) == 0 {
				add("class %q has no objectives", class.ID)
			}
			if class.EstimatedDurationMinutes <= 0 {
				add("class %q has a non-positive duration", class.ID)
			}
			if len(class.Lessons) == 0 {
				add("class %q contains no lessons", class.ID)
			}
			if len(class.Exercise.EvaluationCriteria) == 0 {
				add("class %q has no exercise evaluation criteria", class.ID)
			}
			for _, objective := range class.Objectives {
				claim(objective.ID, "class objective")
			}
			for lessonIndex, lesson := range class.Lessons {
				lessonCount++
				claim(lesson.ID, fmt.Sprintf("lesson %d", lessonCount))
				if lesson.Sequence != lessonIndex+1 {
					add("lesson %q has non-contiguous sequence", lesson.ID)
				}
				if lesson.EstimatedDurationMinutes <= 0 {
					add("lesson %q has a non-positive duration", lesson.ID)
				}
				if isBlueprintEmpty(lesson.Blueprint) {
					add("lesson %q has an incomplete blueprint", lesson.ID)
				}
			}
		}
	}
	if classCount > maxClasses {
		add("course contains more than %d classes", maxClasses)
	}
	if lessonCount > maxLessons {
		add("course contains more than %d lessons", maxLessons)
	}

	for _, module := range course.Modules {
		for _, prerequisite := range module.RequiredPreviousModuleIDs {
			position, exists := moduleOrder[prerequisite]
			if !exists {
				add("module %q references unknown module %q", module.ID, prerequisite)
				continue
			}
			if position >= module.Sequence {
				add("module %q requires %q, which is not earlier", module.ID, prerequisite)
			}
		}
		for _, class := range module.Classes {
			for _, prerequisite := range class.PrerequisiteClassIDs {
				position, exists := classOrder[prerequisite]
				if !exists {
					add("class %q references unknown class %q", class.ID, prerequisite)
					continue
				}
				if position >= classOrder[class.ID] {
					add("class %q requires %q, which is not earlier", class.ID, prerequisite)
				}
			}
		}
	}
	if cycle(course.Modules) {
		add("curriculum prerequisites contain a cycle")
	}

	moduleTotal := 0
	for _, module := range course.Modules {
		moduleTotal += module.EstimatedDurationMinutes
	}
	if course.EstimatedDurationMinutes < int(float64(moduleTotal)*0.8) {
		add("course duration is shorter than its modules")
	}
	if course.EstimatedDurationMinutes > moduleTotal*2+1440 {
		add("course duration is implausibly larger than its modules")
	}

	if estimate(course) > maxCourseBytes {
		add("curriculum exceeds the maximum persisted size")
	}
	return errors
}

func isBlueprintEmpty(b domain.LessonBlueprint) bool {
	requiredStrings := []string{
		b.Introduction,
		b.Summary,
	}
	for _, value := range requiredStrings {
		if strings.TrimSpace(value) == "" {
			return true
		}
	}
	requiredLists := [][]string{
		b.Objectives,
		b.ConceptOutline,
		b.Analogies,
		b.Demonstration,
		b.GuidedPractice,
		b.IndependentPractice,
		b.KnowledgeCheck,
	}
	for _, list := range requiredLists {
		if len(list) == 0 {
			return true
		}
	}
	return false
}

func cycle(modules []domain.CourseModuleAI) bool {
	graph := make(map[string][]string, len(modules))
	for _, module := range modules {
		graph[module.ID] = module.RequiredPreviousModuleIDs
		for _, class := range module.Classes {
			graph[class.ID] = class.PrerequisiteClassIDs
		}
	}
	visiting := map[string]bool{}
	visited := map[string]bool{}
	var visit func(string) bool
	visit = func(node string) bool {
		if visiting[node] {
			return true
		}
		if visited[node] {
			return false
		}
		visiting[node] = true
		for _, next := range graph[node] {
			if _, exists := graph[next]; exists && visit(next) {
				return true
			}
		}
		visiting[node] = false
		visited[node] = true
		return false
	}
	for node := range graph {
		if visit(node) {
			return true
		}
	}
	return false
}

func hasURL(course domain.CourseBlueprint) bool {
	data, err := json.Marshal(course)
	if err != nil {
		return false
	}
	return httpPrefix.Match(data)
}

func estimate(course domain.CourseBlueprint) int {
	data, err := json.Marshal(course)
	if err != nil {
		return maxCourseBytes + 1
	}
	return len(data)
}
