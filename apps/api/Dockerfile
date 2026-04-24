FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/diff-parser/package.json packages/diff-parser/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/typescript-config packages/typescript-config
COPY packages/shared-types packages/shared-types
COPY packages/contracts packages/contracts
COPY packages/database packages/database
COPY packages/diff-parser packages/diff-parser
COPY apps/api apps/api
RUN pnpm --filter @commit-analyzer/shared-types build \
 && pnpm --filter @commit-analyzer/diff-parser build \
 && pnpm --filter @commit-analyzer/contracts build \
 && pnpm --filter @commit-analyzer/database build \
 && pnpm --filter @commit-analyzer/api build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --chown=app:app pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY --chown=app:app apps/api/package.json apps/api/package.json
COPY --chown=app:app apps/cli/package.json apps/cli/package.json
COPY --chown=app:app apps/web/package.json apps/web/package.json
COPY --chown=app:app packages/contracts/package.json packages/contracts/package.json
COPY --chown=app:app packages/database/package.json packages/database/package.json
COPY --chown=app:app packages/diff-parser/package.json packages/diff-parser/package.json
COPY --chown=app:app packages/eslint-config/package.json packages/eslint-config/package.json
COPY --chown=app:app packages/shared-types/package.json packages/shared-types/package.json
COPY --chown=app:app packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile --prod --filter "@commit-analyzer/api..." \
 && pnpm store prune
COPY --from=build --chown=app:app /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=build --chown=app:app /app/packages/contracts/dist packages/contracts/dist
COPY --from=build --chown=app:app /app/packages/database/dist packages/database/dist
COPY --from=build --chown=app:app /app/packages/diff-parser/dist packages/diff-parser/dist
COPY --from=build --chown=app:app /app/apps/api/dist apps/api/dist
USER app
EXPOSE 3000
CMD ["node", "--enable-source-maps", "apps/api/dist/bootstrap.js"]
