package handler

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"github.com/fs-assignment/service-b/internal/service"
)

// NewRouter builds the HTTP router: middleware, routes, and Swagger UI.
func NewRouter(logService *service.LogService, reportService *service.ReportService) *gin.Engine {
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), cors())

	logs := &logHandler{service: logService}
	report := &reportHandler{service: reportService}

	api := router.Group("/api")
	api.GET("/health", Health)
	api.GET("/logs", logs.GetLogs)
	api.GET("/report/pdf", report.DownloadPdf)

	router.GET("/api/docs", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/api/docs/index.html")
	})
	swaggerHandler := ginSwagger.WrapHandler(swaggerFiles.Handler)
	router.GET("/api/docs/*any", func(c *gin.Context) {
		if any := c.Param("any"); any == "" || any == "/" {
			c.Redirect(http.StatusMovedPermanently, "/api/docs/index.html")
			return
		}
		swaggerHandler(c)
	})

	return router
}

func cors() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		}
		c.Header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
