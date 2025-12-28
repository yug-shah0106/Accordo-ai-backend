FROM --platform=linux/amd64 node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM --platform=linux/amd64 node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 8000
CMD ["npm", "start"]