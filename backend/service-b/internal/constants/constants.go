// Package constants centralizes fixed values shared across layers, so the
// Mongo collection name, Redis stream/consumer-group names, and tuning knobs
// each have exactly one definition.
package constants

import "time"

const (
	// LogsCollectionName is the Mongo collection event logs are stored in,
	// matching the collection the previous NestJS service wrote to.
	LogsCollectionName = "event_logs"

	// EventsStream is the durable Redis Stream Service A publishes to.
	EventsStream = "service-a:events"

	// ConsumerGroup is the Redis Stream consumer group this service reads EventsStream as.
	ConsumerGroup = "service-b"

	// TSMetricsPrefix namespaces the per-action RedisTimeSeries keys Service A writes.
	TSMetricsPrefix = "api:metrics"

	// Pagination bounds for GET /api/logs.
	DefaultPage  = 1
	DefaultLimit = 50
	MaxLimit     = 200

	// ReadBatchSize is the max number of stream entries read per XREADGROUP call.
	ReadBatchSize = 100
)

// TSRetention is how long RedisTimeSeries samples are kept.
var TSRetention = 7 * 24 * time.Hour

// ReadBlockInterval is how long a live ("since new entries") stream read blocks.
var ReadBlockInterval = 5 * time.Second

// ConnectRetryInterval is the backoff between reconnect attempts on stream errors.
var ConnectRetryInterval = 5 * time.Second

// GRPCDeadline bounds the PDF-generation gRPC call to service-bonus.
var GRPCDeadline = 15 * time.Second

// ReportActionTypes are the known telemetry action labels recorded by Service A.
var ReportActionTypes = []string{
	"all",
	"GET /search",
	"POST /ingestion/fetch/json",
	"POST /ingestion/fetch/xlsx",
	"POST /ingestion/import/json",
	"POST /ingestion/import/xlsx",
	"POST /ingestion/upload",
}
