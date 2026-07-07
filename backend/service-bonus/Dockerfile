# Builds from the committed, versioned protobuf-generated code (proto/*.pb.go);
# regeneration is a dev-time task, keeping the image build deterministic.
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates && adduser -D -H app
USER app
COPY --from=builder /server /server
EXPOSE 50051
CMD ["/server"]
