// Package handler is the HTTP layer: request binding/validation and response
// shaping only. Each route calls exactly one service method.
package handler

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/fs-assignment/service-b/internal/constants"
	"github.com/fs-assignment/service-b/internal/service"
)

type logHandler struct {
	service *service.LogService
}

// listLogsRequest is the raw shape bound from the request's query string.
type listLogsRequest struct {
	Type     string `form:"type"`
	DateFrom string `form:"date_from"`
	DateTo   string `form:"date_to"`
	Page     *int   `form:"page"`
	Limit    *int   `form:"limit"`
}

// toInput validates raw query params and converts them into a service.ListLogsInput.
func (r listLogsRequest) toInput() (service.ListLogsInput, error) {
	in := service.ListLogsInput{EventType: r.Type, Page: constants.DefaultPage, Limit: constants.DefaultLimit}

	if r.DateFrom != "" {
		t, err := time.Parse(time.RFC3339, r.DateFrom)
		if err != nil {
			return service.ListLogsInput{}, fmt.Errorf("date_from must be an ISO 8601 date string")
		}
		in.From = &t
	}
	if r.DateTo != "" {
		t, err := time.Parse(time.RFC3339, r.DateTo)
		if err != nil {
			return service.ListLogsInput{}, fmt.Errorf("date_to must be an ISO 8601 date string")
		}
		in.To = &t
	}
	if r.Page != nil {
		if *r.Page < 1 {
			return service.ListLogsInput{}, fmt.Errorf("page must be at least 1")
		}
		in.Page = *r.Page
	}
	if r.Limit != nil {
		if *r.Limit < 1 || *r.Limit > constants.MaxLimit {
			return service.ListLogsInput{}, fmt.Errorf("limit must be between 1 and %d", constants.MaxLimit)
		}
		in.Limit = *r.Limit
	}

	return in, nil
}

// GetLogs queries stored event logs.
//
//	@Summary		Query stored event logs
//	@Tags			logs
//	@Param			type		query	string	false	"Filter by event type"			default(GET /search)
//	@Param			date_from	query	string	false	"ISO date from"					default(2020-01-01T00:00:00.000Z)
//	@Param			date_to		query	string	false	"ISO date to"					default(2030-12-31T23:59:59.999Z)
//	@Param			page		query	int		false	"Page number"					default(1)	minimum(1)
//	@Param			limit		query	int		false	"Page size"						default(50)	minimum(1)	maximum(200)
//	@Success		200	{object}	service.PaginatedLogs
//	@Failure		400	{object}	map[string]string
//	@Router			/logs [get]
func (h *logHandler) GetLogs(c *gin.Context) {
	var req listLogsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	in, err := req.toInput()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	result, err := h.service.List(c.Request.Context(), in)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to query logs"})
		return
	}

	c.JSON(http.StatusOK, result)
}
