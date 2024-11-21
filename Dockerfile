ARG DENO_VERSION=2.1.1
FROM denoland/deno:alpine-${DENO_VERSION}

ENV \
  ####################
  ###   Required   ###
  ####################
  APP_ID= \
  APP_NAME= \
  APP_SLUG= \
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
COPY deno.* .
RUN deno install

# Copy source code
COPY . .

# The app uses port 3000 by default
EXPOSE 3000

# Command to run the app
# CMD ["deno", "task", "dev"]
# CMD ["deno", "task", "worker"]
