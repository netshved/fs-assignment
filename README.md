# FS Assignment

Full-stack test assignment.

## Architecture

```
frontend (Angular + NgRx)  ──►  Service A /api/search (MongoDB index)

service-a (NestJS :3000)  ──►  MongoDB + Redis TimeSeries + Streams
service-b (NestJS :3002)  ──►  Logs + PDF (via gRPC)
service-bonus (Go :50051) ──►  PDF generation (bonus)
```

## Quick Start

```bash
docker compose up --build
```


| Service           | URL                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Frontend          | [http://localhost:4200](http://localhost:4200)                                                                     |
| Service A Swagger | [http://localhost:3000/api/docs](http://localhost:3000/api/docs)                                                   |
| Service A Search  | [http://localhost:3000/api/search?q=rick&page=1&limit=20](http://localhost:3000/api/search?q=rick&page=1&limit=20) |
| Service B Swagger | [http://localhost:3002/api/docs](http://localhost:3002/api/docs)                                                   |
| Logs API          | [http://localhost:3002/api/logs](http://localhost:3002/api/logs)                                                   |
| PDF Report        | [http://localhost:3002/api/report/pdf](http://localhost:3002/api/report/pdf)                                       |




## Local Development

```powershell
docker compose up mongodb redis service-bonus

cd backend-service-a && npm install && npm run start:dev
cd backend/service-b && npm install && npm run start:dev
cd frontend && npm install && npm start
```



## Tests

```powershell
cd frontend && npm test
cd backend/libs/common && npm test
cd backend-service-a && npm test
cd backend/service-b && npm test
cd backend/service-bonus && go test ./...
```



## Resilience notes

- **Redis down** → Search/Ingestion APIs keep working; telemetry is dropped with warnings; PDF report returns 503 (no fake data).
- **Service B restart** → Events accumulate in Redis Stream and are replayed via consumer group (including unacknowledged pending entries).
- **Public API down on Service A startup** → HTTP server starts; background seed logs an error; use `POST /api/ingestion/fetch/json` manually.
- **Service A seed delay** → Background seed starts ~5s after boot; wait before first frontend search on a fresh DB.
- **Frontend** → Network errors show an alert banner; failed pagination does not wipe the list; stale page responses are ignored.

