package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Health reports service liveness.
//
//	@Summary	Health check
//	@Tags		health
//	@Success	200	{object}	map[string]string
//	@Router		/health [get]
func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "service-b"})
}
