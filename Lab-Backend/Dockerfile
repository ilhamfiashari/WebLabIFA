# syntax=docker/dockerfile:1

FROM rust:1-bookworm AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY Lab-Backend/Cargo.toml Lab-Backend/Cargo.toml
COPY Lab-Backend/migrations Lab-Backend/migrations
COPY Lab-Backend/content Lab-Backend/content
COPY Lab-Backend/src Lab-Backend/src

RUN cargo build --release --locked --bin ifa-lab-api

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 ifa \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin ifa

COPY --from=builder /app/target/release/ifa-lab-api /usr/local/bin/ifa-lab-api

USER 10001:10001
WORKDIR /home/ifa
ENV BIND_ADDR=0.0.0.0:3000
ENV CONTAINER_BIND=1

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
    CMD ["curl", "-fsS", "http://127.0.0.1:3000/api/health"]

ENTRYPOINT ["/usr/local/bin/ifa-lab-api"]
