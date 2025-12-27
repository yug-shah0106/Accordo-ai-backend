FROM --platform=linux/amd64 node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

FROM --platform=linux/amd64 node:20-alpine AS production
RUN addgroup -g 1001 -S nodejs && \
    adduser -S accordo -u 1001 -G nodejs
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=accordo:nodejs . .
RUN mkdir -p logs && chown -R accordo:nodejs logs
USER accordo
EXPOSE 8000
CMD ["npm", "start"]