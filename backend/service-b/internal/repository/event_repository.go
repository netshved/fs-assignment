package repository

import (
	"context"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/fs-assignment/service-b/internal/constants"
)

// consumerName must stay fixed across restarts: Redis only replays a
// consumer's own pending entries (XREADGROUP ... id "0") to that exact
// consumer name. Only one service-b instance ever runs per deployment, so a
// static name is sufficient — a PID- or hostname-derived name would change on
// every restart/recreate and silently orphan any unacknowledged entries in
// the old consumer's PEL forever (no XCLAIM/XAUTOCLAIM is used to reclaim them).
const consumerName = "service-b-consumer"

// StreamMessage is one Redis Stream entry: its ID plus raw string fields.
type StreamMessage struct {
	ID     string
	Fields map[string]string
}

// EventRepository is the persistence port for the durable event stream
// Service A publishes to. It only knows Redis Streams wire mechanics —
// retry policy and message parsing live in the service layer.
type EventRepository interface {
	// EnsureGroup creates the consumer group if it doesn't already exist.
	EnsureGroup(ctx context.Context) error
	// ReadPending re-reads this consumer's own unacknowledged entries (id "0").
	ReadPending(ctx context.Context) ([]StreamMessage, error)
	// ReadNew blocks for new entries (id ">") up to constants.ReadBlockInterval.
	ReadNew(ctx context.Context) ([]StreamMessage, error)
	// Ack acknowledges a processed entry.
	Ack(ctx context.Context, id string) error
}

type redisEventRepository struct {
	client *redis.Client
}

// NewRedisEventRepository builds an EventRepository over constants.EventsStream,
// consumed under constants.ConsumerGroup.
func NewRedisEventRepository(client *redis.Client) EventRepository {
	return &redisEventRepository{client: client}
}

func (r *redisEventRepository) EnsureGroup(ctx context.Context) error {
	err := r.client.XGroupCreateMkStream(ctx, constants.EventsStream, constants.ConsumerGroup, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return err
	}
	return nil
}

func (r *redisEventRepository) ReadPending(ctx context.Context) ([]StreamMessage, error) {
	return r.readGroup(ctx, "0", 0)
}

func (r *redisEventRepository) ReadNew(ctx context.Context) ([]StreamMessage, error) {
	return r.readGroup(ctx, ">", constants.ReadBlockInterval)
}

func (r *redisEventRepository) Ack(ctx context.Context, id string) error {
	return r.client.XAck(ctx, constants.EventsStream, constants.ConsumerGroup, id).Err()
}

// readGroup reads a batch of messages starting at id. block <= 0 means no
// BLOCK option is sent (used for the "0" pending-history read; only the ">"
// live read should block).
func (r *redisEventRepository) readGroup(ctx context.Context, id string, block time.Duration) ([]StreamMessage, error) {
	args := &redis.XReadGroupArgs{
		Group:    constants.ConsumerGroup,
		Consumer: consumerName,
		Streams:  []string{constants.EventsStream, id},
		Count:    constants.ReadBatchSize,
	}
	if block > 0 {
		args.Block = block
	} else {
		args.Block = -1
	}

	res, err := r.client.XReadGroup(ctx, args).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}
	if len(res) == 0 {
		return nil, nil
	}

	messages := make([]StreamMessage, 0, len(res[0].Messages))
	for _, m := range res[0].Messages {
		fields := make(map[string]string, len(m.Values))
		for k, v := range m.Values {
			if s, ok := v.(string); ok {
				fields[k] = s
			}
		}
		messages = append(messages, StreamMessage{ID: m.ID, Fields: fields})
	}
	return messages, nil
}
