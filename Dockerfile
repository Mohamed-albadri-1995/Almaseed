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

# Build the app. NEXT_PUBLIC_* values are inlined into the browser bundle at
# build time, so Railway's service variable must be declared as a build ARG —
# otherwise the client code always sees it as unset.
ARG NEXT_PUBLIC_ANDROID_PUBLISHED
ENV NEXT_PUBLIC_ANDROID_PUBLISHED=$NEXT_PUBLIC_ANDROID_PUBLISHED
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# On start: sync the schema to the (volume) DB, seed if empty, then serve.
CMD ["npm", "run", "start:prod"]
