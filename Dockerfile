# Deterministic build for Railway / any container host.
FROM node:22-slim AS base
WORKDIR /app
# Prisma needs OpenSSL at runtime on slim (Debian) images.
# openssl: Prisma runtime. ffmpeg: background video/audio watermarking worker.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies (uses the committed lockfile). The prisma schema is
# copied first because the postinstall hook runs `prisma generate`.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Build the app.
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# On start: sync the schema to the (volume) DB, seed if empty, then serve.
CMD ["npm", "run", "start:prod"]
