package repository

import "testing"

func TestMergeTimeSeries(t *testing.T) {
	t.Run("returns empty for non-array input", func(t *testing.T) {
		got := mergeTimeSeries(nil)
		if len(got) != 0 {
			t.Fatalf("expected empty, got %+v", got)
		}
	})

	t.Run("sums values per bucket across series", func(t *testing.T) {
		raw := []interface{}{
			[]interface{}{
				"api:metrics:GET_search",
				[]interface{}{},
				[]interface{}{
					[]interface{}{int64(1751400000000), "10"},
					[]interface{}{int64(1751403600000), "20"},
				},
			},
			[]interface{}{
				"api:metrics:POST_ingestion",
				[]interface{}{},
				[]interface{}{
					[]interface{}{int64(1751400000000), "5"},
				},
			},
		}

		got := mergeTimeSeries(raw)
		if len(got) != 2 {
			t.Fatalf("expected 2 buckets, got %+v", got)
		}
		if got[0].Timestamp != 1751400000000 || got[0].Value != 15 {
			t.Fatalf("unexpected first bucket: %+v", got[0])
		}
		if got[1].Timestamp != 1751403600000 || got[1].Value != 20 {
			t.Fatalf("unexpected second bucket: %+v", got[1])
		}
	})

	t.Run("skips malformed series and points instead of failing", func(t *testing.T) {
		raw := []interface{}{
			"not-a-series",
			[]interface{}{"key", []interface{}{}},
			[]interface{}{
				"key2",
				[]interface{}{},
				[]interface{}{
					"not-a-point",
					[]interface{}{int64(1), "bad-value"},
					[]interface{}{int64(2), "3.5"},
				},
			},
		}

		got := mergeTimeSeries(raw)
		if len(got) != 1 || got[0].Timestamp != 2 || got[0].Value != 3.5 {
			t.Fatalf("unexpected result: %+v", got)
		}
	})
}
