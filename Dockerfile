# ==========================================
# Production Dockerfile for Zomin FastFood Hub
# Node.js 22+ with Native node:sqlite & RBAC
# ==========================================

FROM node:22-alpine AS runner

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_DIR=/app/data
ENV DB_PATH=/app/data/fastfood.sqlite

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Ensure data directory exists with persistent volume
RUN mkdir -p /app/data
VOLUME ["/app/data"]

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server.js"]
