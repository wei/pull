ARG VARIANT=ubuntu
ARG DENO_VERSION=2.3.7

FROM denoland/deno:bin-${DENO_VERSION} AS deno
FROM mcr.microsoft.com/vscode/devcontainers/base:${VARIANT}

COPY --from=deno /deno /usr/local/bin/deno
