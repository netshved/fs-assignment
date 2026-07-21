// Package models holds plain domain structs shared across layers.
package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// LogEntry mirrors the event_logs collection shape written by both the
// previous NestJS service and this rewrite, so existing documents stay queryable.
type LogEntry struct {
	ID        primitive.ObjectID     `bson:"_id,omitempty" json:"_id,omitempty"`
	EventType string                 `bson:"eventType" json:"eventType"`
	Timestamp time.Time              `bson:"timestamp" json:"timestamp"`
	Payload   map[string]interface{} `bson:"payload" json:"payload"`
}
