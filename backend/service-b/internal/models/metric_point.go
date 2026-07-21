package models

// MetricPoint is one aggregated time bucket, matching the shape sent to the report gRPC service.
type MetricPoint struct {
	Timestamp int64   `json:"timestamp"`
	Value     float64 `json:"value"`
}
