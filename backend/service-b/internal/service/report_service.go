package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/fs-assignment/service-b/internal/repository"
)

const hourMs = int64(time.Hour / time.Millisecond)
const dayMs = 24 * hourMs

// ErrMetricsUnavailable is returned when the metrics store cannot be read.
var ErrMetricsUnavailable = errors.New("metrics store is unavailable, report cannot be generated")

// ErrPdfServiceUnavailable is returned when the gRPC PDF generator is unreachable.
var ErrPdfServiceUnavailable = errors.New("PDF service is unavailable")

// PDFGenerator is the one method ReportService needs from the report gRPC
// client — declaring it here (rather than depending on *client.ReportClient
// directly) is what lets tests use a fake instead of a real connection.
type PDFGenerator interface {
	GeneratePdf(ctx context.Context, filterDate, filterType string, timeSeriesJSON []byte) ([]byte, error)
}

// ReportService builds PDF reports from real time-series data via the Go gRPC PDF generator.
type ReportService struct {
	metrics repository.MetricsRepository
	pdf     PDFGenerator
}

// NewReportService builds a ReportService.
func NewReportService(metrics repository.MetricsRepository, pdf PDFGenerator) *ReportService {
	return &ReportService{metrics: metrics, pdf: pdf}
}

// GeneratePdf builds a PDF for the requested day (UTC) from real time series
// data. If metrics cannot be read, the request fails — the report never
// renders invented numbers.
func (s *ReportService) GeneratePdf(ctx context.Context, date, actionType string) ([]byte, error) {
	from, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("invalid date: %s", date)
	}
	fromMs := from.UTC().UnixMilli()
	toMs := fromMs + dayMs - 1

	actionFilter := actionType
	if actionFilter == "all" {
		actionFilter = ""
	}

	points, err := s.metrics.GetRange(ctx, fromMs, toMs, hourMs, actionFilter)
	if err != nil {
		return nil, ErrMetricsUnavailable
	}

	timeSeriesJSON, err := json.Marshal(points)
	if err != nil {
		return nil, err
	}

	filterType := actionFilter
	if filterType == "" {
		filterType = "all"
	}

	pdf, err := s.pdf.GeneratePdf(ctx, date, filterType, timeSeriesJSON)
	if err != nil {
		return nil, ErrPdfServiceUnavailable
	}
	return pdf, nil
}
