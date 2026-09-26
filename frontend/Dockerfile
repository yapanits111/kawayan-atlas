# Multi-stage build for the Next.js 14 frontend, producing a lean standalone image
# suitable for Azure Container Apps (or any container host).

# --- install dependencies ---
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build ---
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* variables are inlined into the client bundle at BUILD time, so the
# backend API URL must be supplied here (as a --build-arg), not only at runtime.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

# --- run ---
FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
# Container hosts inject the listen port via $PORT; default 3000 for local runs.
ENV PORT=3000
# The standalone output bundles the server plus only the node_modules it traced.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
