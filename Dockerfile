# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION=true
ARG APP_VERSION
ARG GIT_SHA
ARG BUILD_TIMESTAMP
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION=$NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIMESTAMP=$BUILD_TIMESTAMP
ENV PRODUCTION_RUNTIME=true
RUN pnpm build
RUN pnpm --filter @football/api deploy --prod --legacy /out/api \
    && pnpm --filter @football/web deploy --prod --legacy /out/web \
    && pnpm --filter @football/admin deploy --prod --legacy /out/admin

FROM base AS api
ENV NODE_ENV=production
ARG APP_VERSION
ARG GIT_SHA
ARG BUILD_TIMESTAMP
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIMESTAMP=$BUILD_TIMESTAMP
LABEL org.opencontainers.image.version=$APP_VERSION \
    org.opencontainers.image.revision=$GIT_SHA \
    org.opencontainers.image.created=$BUILD_TIMESTAMP
COPY --from=build --chown=node:node /out/api ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/readiness').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["pnpm", "start"]

FROM base AS web
ENV NODE_ENV=production
ARG APP_VERSION
ARG GIT_SHA
ARG BUILD_TIMESTAMP
LABEL org.opencontainers.image.version=$APP_VERSION \
    org.opencontainers.image.revision=$GIT_SHA \
    org.opencontainers.image.created=$BUILD_TIMESTAMP
COPY --from=build --chown=node:node /out/web ./
USER node
EXPOSE 3000
CMD ["pnpm", "start"]

FROM base AS admin
ENV NODE_ENV=production
ARG APP_VERSION
ARG GIT_SHA
ARG BUILD_TIMESTAMP
LABEL org.opencontainers.image.version=$APP_VERSION \
    org.opencontainers.image.revision=$GIT_SHA \
    org.opencontainers.image.created=$BUILD_TIMESTAMP
COPY --from=build --chown=node:node /out/admin ./
USER node
EXPOSE 3001
CMD ["pnpm", "start"]
