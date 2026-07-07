# The shared lib is a file: dependency at ../libs/common relative to the
# service, so every stage keeps it at that exact path for npm to resolve.
FROM node:20-alpine AS common-builder
WORKDIR /libs/common
COPY backend/libs/common/package*.json ./
RUN npm ci
COPY backend/libs/common/ ./
RUN npm run build

FROM node:20-alpine AS builder
COPY --from=common-builder /libs/common /libs/common
WORKDIR /app
COPY backend/service-b/package*.json ./
RUN npm ci --install-links
COPY backend/service-b/ ./
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
COPY --from=common-builder /libs/common /libs/common
WORKDIR /app
COPY backend/service-b/package*.json ./
# --install-links copies the shared lib into node_modules instead of symlinking,
# so its peer deps (@nestjs/*, mongodb, redis) resolve from the app tree.
RUN npm ci --omit=dev --install-links && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY backend/proto ./proto
USER node
EXPOSE 3002
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://localhost:3002/api/health || exit 1
CMD ["node", "dist/main.js"]
