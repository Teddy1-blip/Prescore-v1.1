FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && node scripts/release/package-runtime.mjs

FROM node:22-bookworm-slim AS runtime
ARG SOURCE_SHA=UNKNOWN
ARG BUILD_TIMESTAMP=UNKNOWN
LABEL org.opencontainers.image.source="https://github.com/Teddy1-blip/Prescore-v1.1" org.opencontainers.image.revision=$SOURCE_SHA org.opencontainers.image.created=$BUILD_TIMESTAMP org.opencontainers.image.version="1.0.0-rc.1" prescore.schema="0009_analysis_archive.sql"
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg libfontconfig1 libfreetype6 libstdc++6 libgcc-s1 libuuid1 \
 && install -d -m 0755 /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-17 \
 && pg_dump --version | grep -Eq ' 17\.' \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 PRESCORE_SOURCE_SHA=$SOURCE_SHA PRESCORE_BUILD_TIMESTAMP=$BUILD_TIMESTAMP
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p /data/prescore /data/backup && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:3000/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","--experimental-strip-types","scripts/release/start.mjs"]
