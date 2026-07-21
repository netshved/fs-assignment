package repository

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/fs-assignment/service-b/internal/constants"
	"github.com/fs-assignment/service-b/internal/models"
)

type LogFilter struct {
	EventType string
	From, To  *time.Time
}

type LogRepository interface {
	EnsureIndexes(ctx context.Context) error
	Create(ctx context.Context, entry models.LogEntry) error
	FindPage(ctx context.Context, filter LogFilter, page, limit int) ([]models.LogEntry, int64, error)
}

type mongoLogRepository struct {
	col *mongo.Collection
}

func NewMongoLogRepository(db *mongo.Database) LogRepository {
	return &mongoLogRepository{col: db.Collection(constants.LogsCollectionName)}
}

func (r *mongoLogRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.col.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "timestamp", Value: -1}}},
		{Keys: bson.D{{Key: "eventType", Value: 1}, {Key: "timestamp", Value: -1}}},
	})
	return err
}

func (r *mongoLogRepository) Create(ctx context.Context, entry models.LogEntry) error {
	_, err := r.col.InsertOne(ctx, entry)
	return err
}

func (r *mongoLogRepository) FindPage(ctx context.Context, filter LogFilter, page, limit int) ([]models.LogEntry, int64, error) {
	mongoFilter := buildFilter(filter)

	findOpts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetSkip(int64((page - 1) * limit)).
		SetLimit(int64(limit))

	cur, err := r.col.Find(ctx, mongoFilter, findOpts)
	if err != nil {
		return nil, 0, err
	}
	var data []models.LogEntry
	if err := cur.All(ctx, &data); err != nil {
		return nil, 0, err
	}
	if data == nil {
		data = []models.LogEntry{}
	}

	total, err := r.col.CountDocuments(ctx, mongoFilter)
	if err != nil {
		return nil, 0, err
	}

	return data, total, nil
}

// buildFilter translates a LogFilter into a Mongo query.
func buildFilter(f LogFilter) bson.M {
	filter := bson.M{}
	if f.EventType != "" {
		filter["eventType"] = f.EventType
	}
	if f.From != nil || f.To != nil {
		ts := bson.M{}
		if f.From != nil {
			ts["$gte"] = *f.From
		}
		if f.To != nil {
			ts["$lte"] = *f.To
		}
		filter["timestamp"] = ts
	}
	return filter
}
