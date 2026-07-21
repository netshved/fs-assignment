package repository

import (
	"context"
	"fmt"
	"sort"
	"strconv"

	"github.com/redis/go-redis/v9"

	"github.com/fs-assignment/service-b/internal/models"
)

type MetricsRepository interface {
	GetRange(ctx context.Context, fromMs, toMs, bucketMs int64, action string) ([]models.MetricPoint, error)
}

type redisMetricsRepository struct {
	client *redis.Client
}

func NewRedisMetricsRepository(client *redis.Client) MetricsRepository {
	return &redisMetricsRepository{client: client}
}

func (r *redisMetricsRepository) GetRange(ctx context.Context, fromMs, toMs, bucketMs int64, action string) ([]models.MetricPoint, error) {
	filter := "service=a"
	if action != "" {
		filter = fmt.Sprintf("action=%s", action)
	}

	raw, err := r.client.Do(ctx,
		"TS.MRANGE", fromMs, toMs,
		"AGGREGATION", "sum", bucketMs,
		"FILTER", filter,
	).Result()
	if err != nil {
		return nil, err
	}

	return mergeTimeSeries(raw), nil
}

// mergeTimeSeries sums values per bucket across all returned series and returns them sorted ascending by timestamp.
func mergeTimeSeries(raw interface{}) []models.MetricPoint {
	buckets := map[int64]float64{}

	series, ok := raw.([]interface{})
	if !ok {
		return []models.MetricPoint{}
	}

	for _, s := range series {
		entry, ok := s.([]interface{})
		if !ok || len(entry) < 3 {
			continue
		}
		datapoints, ok := entry[2].([]interface{})
		if !ok {
			continue
		}
		for _, p := range datapoints {
			point, ok := p.([]interface{})
			if !ok || len(point) < 2 {
				continue
			}
			ts, ok := toInt64(point[0])
			if !ok {
				continue
			}
			value, ok := toFloat64(point[1])
			if !ok {
				continue
			}
			buckets[ts] += value
		}
	}

	result := make([]models.MetricPoint, 0, len(buckets))
	for ts, value := range buckets {
		result = append(result, models.MetricPoint{Timestamp: ts, Value: value})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Timestamp < result[j].Timestamp })
	return result
}

func toInt64(v interface{}) (int64, bool) {
	switch n := v.(type) {
	case int64:
		return n, true
	case int:
		return int64(n), true
	case float64:
		return int64(n), true
	case string:
		parsed, err := strconv.ParseInt(n, 10, 64)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func toFloat64(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int64:
		return float64(n), true
	case string:
		parsed, err := strconv.ParseFloat(n, 64)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}
