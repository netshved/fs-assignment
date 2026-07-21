// Package constants centralizes fixed values shared across layers, so the
// Mongo collection name, Redis stream/consumer-group names, and tuning knobs
// each have exactly one definition.
package constants

import "time"

const (
	LogsCollectionName = "event_logs"

	EventsStream = "service-a:events"

	ConsumerGroup = "service-b"

	TSMetricsPrefix = "api:metrics"

	DefaultPage  = 1
	DefaultLimit = 50
	MaxLimit     = 200

	ReadBatchSize = 100
)

var TSRetention = 7 * 24 * time.Hour

var ReadBlockInterval = 5 * time.Second

var ConnectRetryInterval = 5 * time.Second

var GRPCDeadline = 15 * time.Second

var ReportActionTypes = []string{
	"all",
	"GET /search",
	"POST /ingestion/fetch/json",
	"POST /ingestion/fetch/xlsx",
	"POST /ingestion/import/json",
	"POST /ingestion/import/xlsx",
	"POST /ingestion/upload",
}
