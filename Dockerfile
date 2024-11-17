ARG DENO_VERSION=2.0.6
FROM denoland/deno:alpine-${DENO_VERSION}

LABEL \
  org.opencontainers.image.title="pull" \
  org.opencontainers.image.description="Keep your forks up-to-date via automated PRs" \
  org.opencontainers.image.url="https://github.com/wei/pull" \
  org.opencontainers.image.documentation="https://github.com/wei/pull#readme" \
  org.opencontainers.image.source="https://github.com/wei/pull" \
  org.opencontainers.image.licenses="MIT" \
  org.opencontainers.image.authors="Wei He <docker@weispot.com>" \
  maintainer="Wei He <docker@weispot.com>"

ENV \
  ####################
  ###   Required   ###
  ####################
  APP_ID= \
  APP_NAME= \
  WEBHOOK_SECRET= \
  PRIVATE_KEY= \
  ####################
  ###   Optional   ###
  ####################
  #SENTRY_DSN= \
  #GHE_HOST= \
  PORT=3000 \
  LOG_FORMAT=short \
  LOG_LEVEL=info \
  WEBHOOK_PATH=/api/github/webhooks \
  CONFIG_FILENAME=pull.yml \
  DEFAULT_MERGE_METHOD=hardreset \
  _=

# Set working directory
WORKDIR /app

# Copy dependency files
# COPY deno.jsonc .
# COPY import_map.json* .

# Copy source code
COPY . .

# The app uses port 3000 by default
EXPOSE 3000

# Command to run the app
# CMD ["deno", "task", "dev"]
# CMD ["deno", "task", "worker"]
