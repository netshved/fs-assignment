# Builds from the committed, versioned protobuf-generated code and swaggo
# docs (proto/*.pb.go, docs/*); regeneration is a dev-time task, keeping the
# image build deterministic.
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY backend/service-b/go.mod backend/service-b/go.sum ./
RUN go mod download
COPY backend/service-b/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /service-b ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget && adduser -D -H app
USER app
COPY --from=builder /service-b /service-b
EXPOSE 3002
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://localhost:3002/api/health || exit 1
CMD ["/service-b"]
