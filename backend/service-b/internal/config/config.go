package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port           string
	LogsMongoURI   string
	RedisAddr      string
	ReportGRPCAddr string
}

func Load() Config {
	return Config{
		Port:           getEnv("PORT", "3002"),
		LogsMongoURI:   logsMongoURI(),
		RedisAddr:      fmt.Sprintf("%s:%s", getEnv("REDIS_HOST", "localhost"), getEnv("REDIS_PORT", "6379")),
		ReportGRPCAddr: fmt.Sprintf("%s:%s", getEnv("REPORT_GRPC_HOST", "localhost"), getEnv("REPORT_GRPC_PORT", "50051")),
	}
}

func logsMongoURI() string {
	if v := os.Getenv("LOGS_MONGO_URI"); v != "" {
		return v
	}
	if v := os.Getenv("MONGO_URI"); v != "" {
		return v
	}
	return "mongodb://localhost:27017/fs_assignment_logs"
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
