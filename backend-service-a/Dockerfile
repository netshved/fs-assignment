FROM node:20-alpine AS common-builder
WORKDIR /backend/libs/common
COPY backend/libs/common/package*.json ./
RUN npm ci
COPY backend/libs/common/ ./
RUN npm run build

FROM node:20-alpine AS builder
COPY --from=common-builder /backend/libs/common /backend/libs/common
WORKDIR /app
COPY backend-service-a/package*.json ./
RUN npm ci --install-links
COPY backend-service-a/ ./
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
COPY --from=common-builder /backend/libs/common /backend/libs/common
WORKDIR /app
COPY backend-service-a/package*.json ./
RUN npm ci --omit=dev --install-links && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "dist/main.js"]
