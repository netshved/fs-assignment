package service

import (
	"reflect"
	"testing"
)

func TestSafeJSONParse(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want map[string]interface{}
	}{
		{"empty string yields empty map", "", map[string]interface{}{}},
		{"malformed JSON yields empty map", "{not json", map[string]interface{}{}},
		{"JSON array yields empty map", "[1,2,3]", map[string]interface{}{}},
		{"valid object is parsed", `{"a":1,"b":"c"}`, map[string]interface{}{"a": float64(1), "b": "c"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := safeJSONParse(tc.raw)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %+v, want %+v", got, tc.want)
			}
		})
	}
}
