package store

import "testing"

// The jsonb columns enforce jsonb_typeof checks; JSON null (produced by nil
// maps and typed-nil slices) would violate them. These helpers must never
// emit null for object/array columns.
func TestJSONBCoercion(t *testing.T) {
	objectCases := map[string][]byte{
		"nil interface": jsonbObject(nil),
		"nil map":       jsonbObject(map[string]any(nil)),
		"empty map":     jsonbObject(map[string]any{}),
		"real map":      jsonbObject(map[string]any{"a": 1}),
	}
	wantObjects := map[string]string{
		"nil interface": "{}",
		"nil map":       "{}",
		"empty map":     "{}",
		"real map":      `{"a":1}`,
	}
	for name, got := range objectCases {
		if string(got) != wantObjects[name] {
			t.Errorf("jsonbObject(%s) = %q, want %q", name, got, wantObjects[name])
		}
	}

	arrayCases := map[string][]byte{
		"nil slice":   jsonbArray([]string(nil)),
		"empty slice": jsonbArray([]string{}),
		"real slice":  jsonbArray([]string{"a"}),
	}
	wantArrays := map[string]string{
		"nil slice":   "[]",
		"empty slice": "[]",
		"real slice":  `["a"]`,
	}
	for name, got := range arrayCases {
		if string(got) != wantArrays[name] {
			t.Errorf("jsonbArray(%s) = %q, want %q", name, got, wantArrays[name])
		}
	}
}
