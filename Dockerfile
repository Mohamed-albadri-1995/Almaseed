# Deterministic build for Railway / any container host.
FROM node:22-slim AS base
WORKDIR /app
# Prisma needs OpenSSL at runtime on slim (Debian) images.
# openssl: Prisma runtime. ffmpeg: background video/audio watermarking worker.
# fontconfig + Noto Arabic/Latin fonts: the watermark label renders the
# contributor's (Arabic) name and the site URL via sharp — the slim base ships
# no fonts, so without these the text would be blank.
RUN apt-get update -y && apt-get install -y --no-install-recommends \
      openssl ffmpeg fontconfig fonts-noto-core fonts-dejavu-core \
    && fc-cache -f \
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
