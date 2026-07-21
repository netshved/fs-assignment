package service

import (
	"context"
	"errors"
	"testing"

	"github.com/fs-assignment/service-b/internal/models"
)

type fakeMetricsRepository struct {
	fromMs, toMs, bucketMs int64
	action                 string
	points                 []models.MetricPoint
	err                    error
}

func (f *fakeMetricsRepository) GetRange(_ context.Context, fromMs, toMs, bucketMs int64, action string) ([]models.MetricPoint, error) {
	f.fromMs, f.toMs, f.bucketMs, f.action = fromMs, toMs, bucketMs, action
	return f.points, f.err
}

type fakePDFGenerator struct {
	filterDate, filterType string
	timeSeriesJSON         []byte
	pdf                    []byte
	err                    error
}

func (f *fakePDFGenerator) GeneratePdf(_ context.Context, filterDate, filterType string, timeSeriesJSON []byte) ([]byte, error) {
	f.filterDate, f.filterType, f.timeSeriesJSON = filterDate, filterType, timeSeriesJSON
	return f.pdf, f.err
}

func TestReportServiceGeneratePdf(t *testing.T) {
	t.Run("rejects an invalid date", func(t *testing.T) {
		s := NewReportService(&fakeMetricsRepository{}, &fakePDFGenerator{})
		_, err := s.GeneratePdf(context.Background(), "not-a-date", "all")
		if err == nil {
			t.Fatal("expected an error")
		}
	})

	t.Run("treats 'all' as no action filter and computes the UTC day range", func(t *testing.T) {
		metrics := &fakeMetricsRepository{points: []models.MetricPoint{{Timestamp: 1, Value: 2}}}
		pdfGen := &fakePDFGenerator{pdf: []byte("%PDF-fake")}
		s := NewReportService(metrics, pdfGen)

		pdf, err := s.GeneratePdf(context.Background(), "2026-07-02", "all")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if string(pdf) != "%PDF-fake" {
			t.Fatalf("unexpected pdf bytes: %s", pdf)
		}
		if metrics.action != "" {
			t.Fatalf("expected no action filter, got %q", metrics.action)
		}
		wantFrom := int64(1782950400000) // 2026-07-02T00:00:00.000Z
		if metrics.fromMs != wantFrom {
			t.Fatalf("unexpected fromMs: got %d, want %d", metrics.fromMs, wantFrom)
		}
		if metrics.toMs != wantFrom+dayMs-1 {
			t.Fatalf("unexpected toMs: %d", metrics.toMs)
		}
		if pdfGen.filterType != "all" {
			t.Fatalf("expected filterType 'all', got %q", pdfGen.filterType)
		}
	})

	t.Run("passes a specific action through as the filter", func(t *testing.T) {
		metrics := &fakeMetricsRepository{}
		pdfGen := &fakePDFGenerator{pdf: []byte("%PDF-fake")}
		s := NewReportService(metrics, pdfGen)

		if _, err := s.GeneratePdf(context.Background(), "2026-07-02", "GET /search"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics.action != "GET /search" {
			t.Fatalf("unexpected action filter: %q", metrics.action)
		}
		if pdfGen.filterType != "GET /search" {
			t.Fatalf("unexpected filterType: %q", pdfGen.filterType)
		}
	})

	t.Run("surfaces a 503-equivalent error when metrics are unavailable, never inventing data", func(t *testing.T) {
		s := NewReportService(&fakeMetricsRepository{err: errors.New("redis down")}, &fakePDFGenerator{})
		_, err := s.GeneratePdf(context.Background(), "2026-07-02", "all")
		if !errors.Is(err, ErrMetricsUnavailable) {
			t.Fatalf("expected ErrMetricsUnavailable, got %v", err)
		}
	})

	t.Run("surfaces a 503-equivalent error when the pdf service is unavailable", func(t *testing.T) {
		s := NewReportService(&fakeMetricsRepository{}, &fakePDFGenerator{err: errors.New("grpc down")})
		_, err := s.GeneratePdf(context.Background(), "2026-07-02", "all")
		if !errors.Is(err, ErrPdfServiceUnavailable) {
			t.Fatalf("expected ErrPdfServiceUnavailable, got %v", err)
		}
	})
}
