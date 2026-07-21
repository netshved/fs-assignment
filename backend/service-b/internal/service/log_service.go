// Package service holds business rules and orchestration. It depends only on
// repository/client interfaces (constructor injection), never on concrete
// Mongo/Redis/gRPC types, so it's unit-testable with fakes.
package service

import (
	"context"
	"math"
	"time"

	"github.com/fs-assignment/service-b/internal/constants"
	"github.com/fs-assignment/service-b/internal/models"
	"github.com/fs-assignment/service-b/internal/repository"
)

// ListLogsInput is the already-validated input to LogService.List (validation
// of raw HTTP query params happens in the handler layer).
type ListLogsInput struct {
	EventType string
	From, To  *time.Time
	Page      int
	Limit     int
}

// PaginationMeta describes the page of results returned by List.
type PaginationMeta struct {
	Total      int64 `json:"total"`
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	TotalPages int   `json:"totalPages"`
}

// PaginatedLogs is the response shape for GET /api/logs.
type PaginatedLogs struct {
	Data []models.LogEntry `json:"data"`
	Meta PaginationMeta    `json:"meta"`
}

// LogService owns the business rules around storing and querying event logs.
type LogService struct {
	repo repository.LogRepository
}

// NewLogService builds a LogService backed by the given repository.
func NewLogService(repo repository.LogRepository) *LogService {
	return &LogService{repo: repo}
}

// Create stores an incoming event. An unparsable timestamp falls back to
// "now" rather than storing an invalid date — this is a business rule, not a
// storage concern, so it lives here rather than in the repository.
func (s *LogService) Create(ctx context.Context, eventType, timestamp string, payload map[string]interface{}) error {
	ts, err := time.Parse(time.RFC3339, timestamp)
	if err != nil {
		ts = time.Now().UTC()
	}
	if payload == nil {
		payload = map[string]interface{}{}
	}
	return s.repo.Create(ctx, models.LogEntry{
		EventType: eventType,
		Timestamp: ts,
		Payload:   payload,
	})
}

// List returns a page of logs matching in, newest first, alongside pagination meta.
func (s *LogService) List(ctx context.Context, in ListLogsInput) (PaginatedLogs, error) {
	page := in.Page
	if page < 1 {
		page = constants.DefaultPage
	}
	limit := in.Limit
	if limit < 1 {
		limit = constants.DefaultLimit
	}

	data, total, err := s.repo.FindPage(ctx, repository.LogFilter{
		EventType: in.EventType,
		From:      in.From,
		To:        in.To,
	}, page, limit)
	if err != nil {
		return PaginatedLogs{}, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages < 1 {
		totalPages = 1
	}

	return PaginatedLogs{
		Data: data,
		Meta: PaginationMeta{Total: total, Page: page, Limit: limit, TotalPages: totalPages},
	}, nil
}
