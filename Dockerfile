FROM node:lts-alpine
LABEL name="wei/pull" maintainer="Wei He <docker@weispot.com>"

ENV \
  NODE_ENV=production \
  PORT=3000 \
  LOG_FORMAT=short \
  LOG_LEVEL=info \
  PULL_INTERVAL=1800 \
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

WORKDIR /home/node
COPY package*.json ./
RUN \
  apk add --no-cache --virtual build-dependencies build-base gcc wget git && \
  apk add --no-cache python && \
  npm ci --production && \
  apk del build-dependencies && \
  :

COPY . .

EXPOSE 3000
CMD ["npm", "start"]