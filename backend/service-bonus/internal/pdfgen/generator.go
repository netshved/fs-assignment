package pdfgen

import (
	"bytes"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jung-kurt/gofpdf"
)

type MetricPoint struct {
	Timestamp int64   `json:"timestamp"`
	Value     float64 `json:"value"`
}

type Generator struct{}

func NewGenerator() *Generator {
	return &Generator{}
}

func (g *Generator) Generate(filterDate, filterType string, timeSeriesJSON []byte) ([]byte, error) {
	points, err := ParseTimeSeries(timeSeriesJSON)
	if err != nil {
		return nil, fmt.Errorf("invalid time series payload: %w", err)
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 18)
	pdf.Cell(0, 12, "API Metrics Report")
	pdf.Ln(14)

	pdf.SetFont("Arial", "", 11)
	pdf.Cell(0, 8, fmt.Sprintf("Generated: %s UTC", time.Now().UTC().Format("2006-01-02 15:04:05")))
	pdf.Ln(8)
	pdf.Cell(0, 8, fmt.Sprintf("Report day: %s", filterDate))
	pdf.Ln(8)
	pdf.Cell(0, 8, fmt.Sprintf("Action filter: %s", filterType))
	pdf.Ln(12)

	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(0, 10, "Request volume (hourly)")
	pdf.Ln(10)

	if len(points) == 0 {
		pdf.SetFont("Arial", "I", 11)
		pdf.SetTextColor(120, 120, 120)
		pdf.Cell(0, 10, "No data recorded for the selected day and filter.")
		pdf.SetTextColor(0, 0, 0)
		pdf.Ln(14)
	} else {
		drawBarChart(pdf, points)
		pdf.Ln(8)
		writeSummary(pdf, points)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func ParseTimeSeries(raw []byte) ([]MetricPoint, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var points []MetricPoint
	if err := json.Unmarshal(raw, &points); err != nil {
		return nil, err
	}
	return points, nil
}

func writeSummary(pdf *gofpdf.Fpdf, points []MetricPoint) {
	total := 0.0
	peak := points[0]
	for _, p := range points {
		total += p.Value
		if p.Value > peak.Value {
			peak = p
		}
	}

	pdf.SetFont("Arial", "B", 12)
	pdf.Cell(0, 8, "Summary")
	pdf.Ln(8)
	pdf.SetFont("Arial", "", 11)
	pdf.Cell(0, 8, fmt.Sprintf("Total requests: %.0f", total))
	pdf.Ln(8)
	pdf.Cell(0, 8, fmt.Sprintf("Peak hour: %s (%.0f requests)", hourLabel(peak.Timestamp), peak.Value))
	pdf.Ln(8)
	pdf.Cell(0, 8, fmt.Sprintf("Data points: %d", len(points)))
}

func drawBarChart(pdf *gofpdf.Fpdf, points []MetricPoint) {
	const (
		chartX = 25.0
		chartW = 160.0
		chartH = 60.0
	)
	chartY := pdf.GetY()

	maxVal := 0.0
	for _, p := range points {
		if p.Value > maxVal {
			maxVal = p.Value
		}
	}
	if maxVal == 0 {
		maxVal = 1
	}

	// Axes.
	pdf.SetDrawColor(60, 60, 60)
	pdf.Line(chartX, chartY, chartX, chartY+chartH)
	pdf.Line(chartX, chartY+chartH, chartX+chartW, chartY+chartH)

	// Y axis labels: 0, max/2, max.
	pdf.SetFont("Arial", "", 8)
	for _, fraction := range []float64{0, 0.5, 1} {
		y := chartY + chartH - fraction*chartH
		pdf.SetXY(chartX-14, y-2)
		pdf.CellFormat(12, 4, fmt.Sprintf("%.0f", maxVal*fraction), "", 0, "R", false, 0, "")
		pdf.SetDrawColor(210, 210, 210)
		pdf.Line(chartX, y, chartX+chartW, y)
	}

	barWidth := chartW / float64(len(points))
	pdf.SetFillColor(66, 133, 244)
	for i, p := range points {
		barH := (p.Value / maxVal) * (chartH - 4)
		x := chartX + float64(i)*barWidth
		pdf.Rect(x+barWidth*0.1, chartY+chartH-barH, barWidth*0.8, barH, "F")
	}

	labelEvery := 1
	if len(points) > 8 {
		labelEvery = len(points) / 8
	}
	pdf.SetFont("Arial", "", 8)
	for i, p := range points {
		if i%labelEvery != 0 {
			continue
		}
		x := chartX + float64(i)*barWidth
		pdf.SetXY(x, chartY+chartH+1)
		pdf.CellFormat(barWidth, 4, hourLabel(p.Timestamp), "", 0, "C", false, 0, "")
	}

	pdf.SetY(chartY + chartH + 8)
}

func hourLabel(tsMillis int64) string {
	return time.UnixMilli(tsMillis).UTC().Format("15:04")
}
