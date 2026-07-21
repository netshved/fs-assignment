// Service B API
//
//	@title		Service B API
//	@version	1.0
//	@description	Event logs and PDF reporting
//	@BasePath	/api
package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	_ "github.com/fs-assignment/service-b/docs"
	"github.com/fs-assignment/service-b/internal/client"
	"github.com/fs-assignment/service-b/internal/config"
	"github.com/fs-assignment/service-b/internal/handler"
	"github.com/fs-assignment/service-b/internal/repository"
	"github.com/fs-assignment/service-b/internal/service"
)

func main() {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	mongoClient, db := connectMongo(ctx, cfg.LogsMongoURI)
	defer func() {
		if err := mongoClient.Disconnect(context.Background()); err != nil {
			log.Printf("mongo disconnect: %v", err)
		}
	}()

	redisClient := redis.NewClient(&redis.Options{Addr: cfg.RedisAddr, Protocol: 2})
	defer func() {
		if err := redisClient.Close(); err != nil {
			log.Printf("redis close: %v", err)
		}
	}()

	logRepo := repository.NewMongoLogRepository(db)
	if err := logRepo.EnsureIndexes(ctx); err != nil {
		log.Fatalf("ensure indexes: %v", err)
	}
	eventRepo := repository.NewRedisEventRepository(redisClient)
	metricsRepo := repository.NewRedisMetricsRepository(redisClient)

	reportClient, err := client.NewReportClient(cfg.ReportGRPCAddr)
	if err != nil {
		log.Fatalf("dial report gRPC service: %v", err)
	}
	defer reportClient.Close()
	log.Printf("Report gRPC client -> %s", cfg.ReportGRPCAddr)

	logService := service.NewLogService(logRepo)
	reportService := service.NewReportService(metricsRepo, reportClient)

	consumer := service.NewEventConsumer(eventRepo, logService)
	go consumer.Run(ctx)

	router := handler.NewRouter(logService, reportService)
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: router}
	go func() {
		log.Printf("Service B running on http://localhost:%s (docs: /api/docs)", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("server shutdown: %v", err)
	}
}

const logsDatabaseName = "fs_assignment_logs"

func connectMongo(ctx context.Context, uri string) (*mongo.Client, *mongo.Database) {
	opts := options.Client().ApplyURI(uri).SetServerSelectionTimeout(10 * time.Second)
	mongoClient, err := mongo.Connect(ctx, opts)
	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}
	if err := mongoClient.Ping(ctx, nil); err != nil {
		log.Fatalf("mongo ping: %v", err)
	}
	return mongoClient, mongoClient.Database(logsDatabaseName)
}
