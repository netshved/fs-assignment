package service

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/fs-assignment/service-b/internal/constants"
	"github.com/fs-assignment/service-b/internal/repository"
)

type LogCreator interface {
	Create(ctx context.Context, eventType, timestamp string, payload map[string]interface{}) error
}

// EventConsumer reads Service A's events from a Redis Stream with a consumer
// group.  events published while this service is down stay in
// the stream and are delivered after restart; unacknowledged events are
// re-read first.
type EventConsumer struct {
	repo repository.EventRepository
	logs LogCreator
}

func NewEventConsumer(repo repository.EventRepository, logs LogCreator) *EventConsumer {
	return &EventConsumer{repo: repo, logs: logs}
}

func (c *EventConsumer) Run(ctx context.Context) {
	connected := false
	for {
		if ctx.Err() != nil {
			return
		}

		if !connected {
			if err := c.repo.EnsureGroup(ctx); err != nil {
				log.Printf("[event-consumer] ensure group failed, retrying: %v", err)
				if !sleepCtx(ctx, constants.ConnectRetryInterval) {
					return
				}
				continue
			}
			if err := c.consumePending(ctx); err != nil {
				log.Printf("[event-consumer] recovering pending entries failed, retrying: %v", err)
				if !sleepCtx(ctx, constants.ConnectRetryInterval) {
					return
				}
				continue
			}
			connected = true
			log.Printf("[event-consumer] consuming %s as %s", constants.EventsStream, constants.ConsumerGroup)
		}

		batch, err := c.repo.ReadNew(ctx)
		if err != nil {
			log.Printf("[event-consumer] stream read error, retrying: %v", err)
			connected = false
			if !sleepCtx(ctx, constants.ConnectRetryInterval) {
				return
			}
			continue
		}
		if len(batch) > 0 {
			c.handleBatch(ctx, batch)
		}
	}
}

func (c *EventConsumer) consumePending(ctx context.Context) error {
	batch, err := c.repo.ReadPending(ctx)
	if err != nil {
		return err
	}
	if len(batch) > 0 {
		log.Printf("[event-consumer] recovering %d unacknowledged event(s)", len(batch))
		c.handleBatch(ctx, batch)
	}
	return nil
}

func (c *EventConsumer) handleBatch(ctx context.Context, batch []repository.StreamMessage) {
	for _, msg := range batch {
		if ctx.Err() != nil {
			// Shutting down: stop early rather than storing/acking against a
			// doomed context. Unprocessed entries stay pending and are
			// recovered on the next startup.
			return
		}

		eventType := msg.Fields["type"]
		if eventType == "" {
			eventType = "unknown"
		}
		timestamp := msg.Fields["timestamp"]
		if timestamp == "" {
			timestamp = time.Now().UTC().Format(time.RFC3339Nano)
		}
		payload := safeJSONParse(msg.Fields["payload"])

		if err := c.logs.Create(ctx, eventType, timestamp, payload); err != nil {
			log.Printf("[event-consumer] failed to store event %s: %v", msg.ID, err)
			continue
		}
		if err := c.repo.Ack(ctx, msg.ID); err != nil {
			log.Printf("[event-consumer] failed to ack event %s: %v", msg.ID, err)
		}
	}
}

func safeJSONParse(raw string) map[string]interface{} {
	if raw == "" {
		return map[string]interface{}{}
	}
	var out map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &out); err != nil || out == nil {
		return map[string]interface{}{}
	}
	return out
}

func sleepCtx(ctx context.Context, d time.Duration) bool {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
