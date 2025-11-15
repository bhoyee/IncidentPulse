# Stage 1: install full dependencies for building
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package*.json ./
RUN npm ci

# Stage 2: build the TypeScript project
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# Default placeholders so TypeScript build can load env.ts during `npm run build`
ARG DATABASE_URL="postgresql://incidentpulse:incidentpulse@localhost:5432/incidentpulse?schema=public"
ARG FRONTEND_URL="http://localhost:3000"
ARG COOKIE_DOMAIN="localhost"
ARG JWT_SECRET="demo-development-secret-please-change!!!"
ARG RESEND_API_KEY="demo-resend-key"
ARG SMTP_FROM_ADDRESS="demo@incidentpulse.local"
ARG SMTP_FROM_NAME="IncidentPulse Demo"
ARG WEBHOOK_HMAC_SECRET="demo-hmac-secret"
ARG WEBHOOK_SHARED_TOKEN="demo-shared-token"
ARG WEBHOOK_SYSTEM_USER_ID="00000000-0000-0000-0000-000000000000"
ARG DEMO_USER_EMAILS="admin@demo.incidentpulse.com,operator@demo.incidentpulse.com"

ENV DATABASE_URL=$DATABASE_URL \
    FRONTEND_URL=$FRONTEND_URL \
    COOKIE_DOMAIN=$COOKIE_DOMAIN \
    JWT_SECRET=$JWT_SECRET \
    RESEND_API_KEY=$RESEND_API_KEY \
    SMTP_FROM_ADDRESS=$SMTP_FROM_ADDRESS \
    SMTP_FROM_NAME=$SMTP_FROM_NAME \
    WEBHOOK_HMAC_SECRET=$WEBHOOK_HMAC_SECRET \
    WEBHOOK_SHARED_TOKEN=$WEBHOOK_SHARED_TOKEN \
    WEBHOOK_SYSTEM_USER_ID=$WEBHOOK_SYSTEM_USER_ID \
    DEMO_USER_EMAILS=$DEMO_USER_EMAILS

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: production runtime with only prod deps + build output
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat openssl

# Same defaults as builder; override via docker run/compose in production
ARG DATABASE_URL="postgresql://incidentpulse:incidentpulse@postgres:5432/incidentpulse?schema=public"
ARG FRONTEND_URL="http://localhost:3000"
ARG COOKIE_DOMAIN="localhost"
ARG JWT_SECRET="demo-development-secret-please-change!!!"
ARG RESEND_API_KEY="demo-resend-key"
ARG SMTP_FROM_ADDRESS="demo@incidentpulse.local"
ARG SMTP_FROM_NAME="IncidentPulse Demo"
ARG WEBHOOK_HMAC_SECRET="demo-hmac-secret"
ARG WEBHOOK_SHARED_TOKEN="demo-shared-token"
ARG WEBHOOK_SYSTEM_USER_ID="00000000-0000-0000-0000-000000000000"
ARG DEMO_USER_EMAILS="admin@demo.incidentpulse.com,operator@demo.incidentpulse.com"

ENV DATABASE_URL=$DATABASE_URL \
    FRONTEND_URL=$FRONTEND_URL \
    COOKIE_DOMAIN=$COOKIE_DOMAIN \
    JWT_SECRET=$JWT_SECRET \
    RESEND_API_KEY=$RESEND_API_KEY \
    SMTP_FROM_ADDRESS=$SMTP_FROM_ADDRESS \
    SMTP_FROM_NAME=$SMTP_FROM_NAME \
    WEBHOOK_HMAC_SECRET=$WEBHOOK_HMAC_SECRET \
    WEBHOOK_SHARED_TOKEN=$WEBHOOK_SHARED_TOKEN \
    WEBHOOK_SYSTEM_USER_ID=$WEBHOOK_SYSTEM_USER_ID \
    DEMO_USER_EMAILS=$DEMO_USER_EMAILS

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.env.example ./.env.example

RUN npx prisma generate

EXPOSE 4000
CMD ["node", "dist/server.js"]
