# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

# Stage 2: Build frontend
FROM deps AS build-web
COPY . .
RUN npm run build -w apps/web

# Stage 3: Build backend
FROM deps AS build-server
COPY . .
RUN npm run build -w apps/server

# Stage 4: Production
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build-web /app/apps/web/dist ./apps/web/dist
COPY --from=build-server /app/apps/server/dist ./apps/server/dist
COPY --from=build-server /app/apps/server/drizzle ./apps/server/drizzle
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src
COPY package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/server/dist/app.js"]
