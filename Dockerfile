FROM node:lts-alpine

LABEL \
  org.label-schema.schema-version="1.0" \
  org.label-schema.name="pull" \
  org.label-schema.description="Keep your forks up-to-date via automated PRs" \
  org.label-schema.url="https://github.com/wei/pull" \
  org.label-schema.usage="https://github.com/wei/pull#readme" \
  org.label-schema.vcs-url="https://github.com/wei/pull" \
  maintainer="Wei He <docker@weispot.com>"

ENV \
  NODE_ENV=production \
  PORT=3000 \
  LOG_FORMAT=short \
  LOG_LEVEL=info \
  PULL_INTERVAL=3600 \
  WEBHOOK_PATH=/webhook \
  ####################
  ###   Required   ###
  ####################
  APP_ID= \
  WEBHOOK_SECRET= \
  PRIVATE_KEY= \
  ####################
  ###   Optional   ###
  ####################
  #CLIENT_ID= \
  #CLIENT_SECRET= \
  #SENTRY_DSN= \
  #SYSLOG_UDP_HOST= \
  #SYSLOG_UDP_PORT= \
  #GHE_HOST= \
  #IGNORED_ACCOUNTS= \
  #DISABLE_STATS= \
  _=

WORKDIR /app
COPY package*.json ./
RUN \
  apk add --no-cache --virtual .build-dependencies build-base gcc wget git && \
  apk add --no-cache python && \
  npm ci --production && \
  apk del .build-dependencies && \
  :

COPY . .

EXPOSE 3000
CMD ["npm", "start"]

ARG VCS_REF
ARG BUILD_DATE
LABEL \
	org.label-schema.vcs-ref=$VCS_REF \
  org.label-schema.build-date=$BUILD_DATE