# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

COPY Lab-FrontEnd/package.json Lab-FrontEnd/package-lock.json ./
RUN npm ci

COPY Lab-FrontEnd/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
USER root
RUN apk update && apk upgrade --no-cache
USER 101:101
COPY deploy/nginx-container.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/healthz"]
