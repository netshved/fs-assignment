package handler

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/fs-assignment/service-b/internal/service"
)

type reportHandler struct {
	service *service.ReportService
}

var dateFormat = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

type downloadPdfRequest struct {
	Date string `form:"date"`
	Type string `form:"type"`
}

func (r downloadPdfRequest) validate() error {
	if r.Date != "" && !dateFormat.MatchString(r.Date) {
		return errors.New("date must be in YYYY-MM-DD format")
	}
	return nil
}

// DownloadPdf generates a PDF report with charts via the Go gRPC service.
//
//	@Summary	Generate a PDF report with charts via the Go gRPC service
//	@Tags		report
//	@Param		date	query	string	false	"Report day (UTC), defaults to today"				default(2026-07-20)
//	@Param		type	query	string	false	"Filter by telemetry action label, or 'all'"		default(all)
//	@Success	200	{file}	binary
//	@Failure	400	{object}	map[string]string
//	@Failure	503	{object}	map[string]string
//	@Router		/report/pdf [get]
func (h *reportHandler) DownloadPdf(c *gin.Context) {
	var req downloadPdfRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	if err := req.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	date := req.Date
	if date == "" {
		date = time.Now().UTC().Format("2006-01-02")
	}
	actionType := req.Type
	if actionType == "" {
		actionType = "all"
	}

	pdf, err := h.service.GeneratePdf(c.Request.Context(), date, actionType)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrMetricsUnavailable), errors.Is(err, service.ErrPdfServiceUnavailable):
			c.JSON(http.StatusServiceUnavailable, gin.H{"message": err.Error()})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		}
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=api-report-%s.pdf", date))
	c.Data(http.StatusOK, "application/pdf", pdf)
}
