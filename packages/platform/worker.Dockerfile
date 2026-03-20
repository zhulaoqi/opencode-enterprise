FROM oven/bun:1.3

WORKDIR /app

COPY packages/opencode packages/opencode
COPY packages/platform packages/platform
COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

EXPOSE 4200

CMD ["bun", "run", "packages/platform/src/worker-manager/bootstrap.ts"]
