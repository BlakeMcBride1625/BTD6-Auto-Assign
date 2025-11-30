# Multi-stage build for production
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install OpenSSL 1.1.x for Prisma (from edge repository)
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main openssl1.1-compat || \
    apk add --no-cache openssl

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
	adduser -S nodejs -u 1001

USER nodejs

# Expose port (if needed for health checks)
EXPOSE 3000

# Start the bot
CMD ["node", "dist/main.js"]

