# Single image for all Clariodesk runtimes (api/worker/realtime/scheduler).
# Each service overrides the command in docker-compose.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Bring the built monorepo (incl. node_modules) from the build stage.
COPY --from=build /app /app
# Default command runs the API; compose overrides per service.
CMD ["node", "apps/api/dist/main.js"]
