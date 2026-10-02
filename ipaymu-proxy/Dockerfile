# Build Stage
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production Stage
FROM node:20-slim

WORKDIR /app

# Non-root user for security
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs
USER nodejs

COPY --from=builder /app/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
