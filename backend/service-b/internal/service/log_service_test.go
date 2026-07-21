package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/fs-assignment/service-b/internal/models"
	"github.com/fs-assignment/service-b/internal/repository"
)

type fakeLogRepository struct {
	created   []models.LogEntry
	createErr error

	filter      repository.LogFilter
	page, limit int
	data        []models.LogEntry
	total       int64
	findErr     error
}

func (f *fakeLogRepository) EnsureIndexes(context.Context) error { return nil }

func (f *fakeLogRepository) Create(_ context.Context, entry models.LogEntry) error {
	f.created = append(f.created, entry)
	return f.createErr
}

func (f *fakeLogRepository) FindPage(_ context.Context, filter repository.LogFilter, page, limit int) ([]models.LogEntry, int64, error) {
	f.filter, f.page, f.limit = filter, page, limit
	return f.data, f.total, f.findErr
}

func TestLogServiceCreate(t *testing.T) {
	t.Run("falls back to now for an unparsable timestamp instead of storing an invalid date", func(t *testing.T) {
		repo := &fakeLogRepository{}
		svc := NewLogService(repo)

		before := time.Now().Add(-time.Second)
		if err := svc.Create(context.Background(), "x", "garbage", nil); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		after := time.Now().Add(time.Second)

		if len(repo.created) != 1 {
			t.Fatalf("expected 1 created entry, got %d", len(repo.created))
		}
		stored := repo.created[0]
		if stored.Timestamp.Before(before) || stored.Timestamp.After(after) {
			t.Fatalf("expected a recent fallback timestamp, got %v", stored.Timestamp)
		}
		if stored.Payload == nil {
			t.Fatal("expected a non-nil payload")
		}
	})

	t.Run("preserves a valid timestamp and payload", func(t *testing.T) {
		repo := &fakeLogRepository{}
		svc := NewLogService(repo)

		if err := svc.Create(context.Background(), "GET /search", "2026-07-02T10:00:00.000Z", map[string]interface{}{"q": "rick"}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		stored := repo.created[0]
		want, _ := time.Parse(time.RFC3339, "2026-07-02T10:00:00.000Z")
		if !stored.Timestamp.Equal(want) {
			t.Fatalf("expected %v, got %v", want, stored.Timestamp)
		}
		if stored.Payload["q"] != "rick" {
			t.Fatalf("unexpected payload: %+v", stored.Payload)
		}
	})

	t.Run("propagates repository errors", func(t *testing.T) {
		repo := &fakeLogRepository{createErr: errors.New("insert failed")}
		svc := NewLogService(repo)

		if err := svc.Create(context.Background(), "x", "2026-07-02T10:00:00.000Z", nil); err == nil {
			t.Fatal("expected an error")
		}
	})
}

func TestLogServiceList(t *testing.T) {
	t.Run("paginates and returns the real total, not the page size", func(t *testing.T) {
		repo := &fakeLogRepository{data: []models.LogEntry{{EventType: "x"}}, total: 500}
		svc := NewLogService(repo)

		result, err := svc.List(context.Background(), ListLogsInput{Page: 3, Limit: 50})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if repo.page != 3 || repo.limit != 50 {
			t.Fatalf("expected page/limit passed through, got page=%d limit=%d", repo.page, repo.limit)
		}
		if result.Meta != (PaginationMeta{Total: 500, Page: 3, Limit: 50, TotalPages: 10}) {
			t.Fatalf("unexpected meta: %+v", result.Meta)
		}
	})

	t.Run("defaults page and limit when unset", func(t *testing.T) {
		repo := &fakeLogRepository{total: 0}
		svc := NewLogService(repo)

		result, err := svc.List(context.Background(), ListLogsInput{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if repo.page != 1 || repo.limit != 50 {
			t.Fatalf("expected defaults page=1 limit=50, got page=%d limit=%d", repo.page, repo.limit)
		}
		if result.Meta.TotalPages != 1 {
			t.Fatalf("expected totalPages=1 for zero results, got %d", result.Meta.TotalPages)
		}
	})

	t.Run("passes the event type and date range through to the repository filter", func(t *testing.T) {
		repo := &fakeLogRepository{}
		svc := NewLogService(repo)
		from := time.Now()

		_, err := svc.List(context.Background(), ListLogsInput{EventType: "GET /health", From: &from, Page: 1, Limit: 10})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if repo.filter.EventType != "GET /health" || repo.filter.From != &from {
			t.Fatalf("unexpected filter passed to repository: %+v", repo.filter)
		}
	})
}
