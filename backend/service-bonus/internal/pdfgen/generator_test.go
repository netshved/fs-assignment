package pdfgen

import (
	"bytes"
	"testing"
)

func TestParseTimeSeries(t *testing.T) {
	t.Run("parses valid points", func(t *testing.T) {
		points, err := ParseTimeSeries([]byte(`[{"timestamp":1751400000000,"value":12},{"timestamp":1751403600000,"value":3.5}]`))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(points) != 2 {
			t.Fatalf("expected 2 points, got %d", len(points))
		}
		if points[0].Value != 12 || points[1].Value != 3.5 {
			t.Fatalf("unexpected values: %+v", points)
		}
	})

	t.Run("empty payload means no data, not an error", func(t *testing.T) {
		for _, raw := range [][]byte{nil, {}, []byte(`[]`)} {
			points, err := ParseTimeSeries(raw)
			if err != nil {
				t.Fatalf("unexpected error for %q: %v", raw, err)
			}
			if len(points) != 0 {
				t.Fatalf("expected no points for %q, got %+v", raw, points)
			}
		}
	})

	t.Run("rejects malformed payload instead of inventing data", func(t *testing.T) {
		if _, err := ParseTimeSeries([]byte(`{"not":"an array"}`)); err == nil {
			t.Fatal("expected an error for malformed payload")
		}
	})
}

func TestGenerate(t *testing.T) {
	t.Run("produces a valid PDF from real data", func(t *testing.T) {
		pdf, err := NewGenerator().Generate("2026-07-02", "GET /search",
			[]byte(`[{"timestamp":1751400000000,"value":10},{"timestamp":1751403600000,"value":20}]`))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !bytes.HasPrefix(pdf, []byte("%PDF")) {
			t.Fatalf("output does not look like a PDF: %q", pdf[:8])
		}
	})

	t.Run("produces a valid PDF when there is no data", func(t *testing.T) {
		pdf, err := NewGenerator().Generate("2026-07-02", "all", []byte(`[]`))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !bytes.HasPrefix(pdf, []byte("%PDF")) {
			t.Fatal("output does not look like a PDF")
		}
	})

	t.Run("fails on malformed payload", func(t *testing.T) {
		if _, err := NewGenerator().Generate("2026-07-02", "all", []byte(`garbage`)); err == nil {
			t.Fatal("expected an error for malformed payload")
		}
	})
}
