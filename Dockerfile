FROM node:24-slim

WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server/src ./src
COPY server/public ./public
COPY server/data ./data

ENV PORT=3000
EXPOSE 3000

# Mount this over a host directory in docker-compose.yml so the generated
# store.db (and the committed store.json seed it migrates from) survive
# container restarts/recreation.
VOLUME ["/app/data"]

CMD ["node", "src/server.js"]
