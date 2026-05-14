FROM node:20-bookworm-slim AS deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend ./
RUN npm run build

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Backend runtime artifacts
COPY --from=deps /app/backend/node_modules /app/backend/node_modules
COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/backend/package.json /app/backend/package.json

# Root .env is loaded by backend/src/loadEnv.ts as ../../.env from dist
# Keep this file mounted or copied at /app/.env in production.
COPY .env /app/.env

EXPOSE 3001
CMD ["node", "/app/backend/dist/server.js"]
