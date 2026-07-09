# syntax=docker/dockerfile:1

# Debian slim (not Alpine) so Prisma's engine detection works without
# musl-specific binaryTargets in schema.prisma. openssl is required by Prisma.
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# postinstall runs `prisma generate`, which needs the schema.
COPY prisma ./prisma
RUN npm ci

# One-shot migration runner, used as the `migrate` service in docker-compose.
# Migrations run here at container start, not during the image build, because
# the database isn't reachable while the image is being built.
FROM deps AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

FROM deps AS builder
COPY . .
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so this
# must arrive as a build arg — setting it at runtime has no effect.
ARG NEXT_PUBLIC_MAPS_API_KEY
ENV NEXT_PUBLIC_MAPS_API_KEY=$NEXT_PUBLIC_MAPS_API_KEY
# `npm run build` would also run `prisma migrate deploy`; call next directly.
RUN npx next build

FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
RUN groupadd --system nodejs && useradd --system --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
