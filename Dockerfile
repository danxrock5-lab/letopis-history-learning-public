FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
ENV VITE_API_ENABLED=true
COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src
COPY shared ./shared
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist
ENV APP_DB_PATH=/data/letopis.sqlite
RUN mkdir -p /data && chown node:node /data
EXPOSE 3001
CMD ["sh", "-c", "chown -R node:node /data && exec su -s /bin/sh node -c 'node server/index.js'"]
