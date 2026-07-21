package repository

import (
	"context"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"

	"github.com/fs-assignment/service-b/internal/models"
)

func TestBuildFilter(t *testing.T) {
	t.Run("returns an empty filter when nothing is set", func(t *testing.T) {
		got := buildFilter(LogFilter{})
		if len(got) != 0 {
			t.Fatalf("expected empty filter, got %+v", got)
		}
	})

	t.Run("filters by event type", func(t *testing.T) {
		got := buildFilter(LogFilter{EventType: "GET /search"})
		if got["eventType"] != "GET /search" || len(got) != 1 {
			t.Fatalf("got %+v", got)
		}
	})

	t.Run("builds a closed date range", func(t *testing.T) {
		from := mustParse(t, "2026-01-01T00:00:00.000Z")
		to := mustParse(t, "2026-01-31T23:59:59.999Z")
		got := buildFilter(LogFilter{From: &from, To: &to})

		ts, ok := got["timestamp"].(bson.M)
		if !ok {
			t.Fatalf("expected timestamp filter, got %+v", got)
		}
		if !ts["$gte"].(time.Time).Equal(from) || !ts["$lte"].(time.Time).Equal(to) {
			t.Fatalf("unexpected timestamp filter: %+v", ts)
		}
	})

	t.Run("supports open-ended ranges", func(t *testing.T) {
		from := mustParse(t, "2026-01-01T00:00:00.000Z")

		gteOnly := buildFilter(LogFilter{From: &from})
		ts := gteOnly["timestamp"].(bson.M)
		if _, hasLte := ts["$lte"]; hasLte {
			t.Fatalf("did not expect $lte, got %+v", ts)
		}

		lteOnly := buildFilter(LogFilter{To: &from})
		ts = lteOnly["timestamp"].(bson.M)
		if _, hasGte := ts["$gte"]; hasGte {
			t.Fatalf("did not expect $gte, got %+v", ts)
		}
	})
}

func mustParse(t *testing.T, s string) time.Time {
	t.Helper()
	ts, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t.Fatalf("failed to parse %q: %v", s, err)
	}
	return ts
}

func TestMongoLogRepositoryFindPage(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))

	mt.Run("paginates and returns the real total, not the page size", func(mt *mtest.T) {
		findResponse := mtest.CreateCursorResponse(1, "fs_assignment_logs.event_logs", mtest.FirstBatch,
			bson.D{{Key: "eventType", Value: "x"}, {Key: "timestamp", Value: time.Now()}, {Key: "payload", Value: bson.D{}}})
		findEnd := mtest.CreateCursorResponse(0, "fs_assignment_logs.event_logs", mtest.NextBatch)
		countResponse := mtest.CreateCursorResponse(1, "fs_assignment_logs.event_logs", mtest.FirstBatch,
			bson.D{{Key: "n", Value: int32(500)}})
		countEnd := mtest.CreateCursorResponse(0, "fs_assignment_logs.event_logs", mtest.NextBatch)
		mt.AddMockResponses(findResponse, findEnd, countResponse, countEnd)

		repo := NewMongoLogRepository(mt.DB)
		data, total, err := repo.FindPage(context.Background(), LogFilter{}, 3, 50)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 500 {
			t.Fatalf("expected total=500, got %d", total)
		}
		if len(data) != 1 {
			t.Fatalf("expected 1 entry, got %d", len(data))
		}
	})

	mt.Run("returns an empty (non-nil) slice when there are no results", func(mt *mtest.T) {
		findEnd := mtest.CreateCursorResponse(0, "fs_assignment_logs.event_logs", mtest.FirstBatch)
		countResponse := mtest.CreateCursorResponse(1, "fs_assignment_logs.event_logs", mtest.FirstBatch,
			bson.D{{Key: "n", Value: int32(0)}})
		countEnd := mtest.CreateCursorResponse(0, "fs_assignment_logs.event_logs", mtest.NextBatch)
		mt.AddMockResponses(findEnd, countResponse, countEnd)

		repo := NewMongoLogRepository(mt.DB)
		data, total, err := repo.FindPage(context.Background(), LogFilter{}, 1, 50)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 0 {
			t.Fatalf("expected total=0, got %d", total)
		}
		if data == nil || len(data) != 0 {
			t.Fatalf("expected an empty non-nil slice, got %+v", data)
		}
	})
}

func TestMongoLogRepositoryCreate(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))

	mt.Run("inserts the given entry as-is", func(mt *mtest.T) {
		mt.AddMockResponses(mtest.CreateSuccessResponse())

		repo := NewMongoLogRepository(mt.DB)
		err := repo.Create(context.Background(), models.LogEntry{
			EventType: "GET /search",
			Timestamp: time.Now(),
			Payload:   map[string]interface{}{"q": "rick"},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		started := mt.GetStartedEvent()
		if started == nil || started.CommandName != "insert" {
			t.Fatalf("expected an insert command to be sent, got %+v", started)
		}
	})
}
