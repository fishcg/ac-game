FROM 172.24.173.77:30500/node:24.13.0-alpine AS deps

WORKDIR /app

ARG http_proxy
ARG https_proxy
ARG no_proxy
ENV http_proxy=${http_proxy} \
    https_proxy=${https_proxy} \
    no_proxy=${no_proxy}

COPY package.json package-lock.json ./
RUN npm ci

FROM 172.24.173.77:30500/node:24.13.0-alpine AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY . .
RUN npm run build

FROM 172.24.173.77:30500/node:24.13.0-alpine AS runner

WORKDIR /home/www/ac-game

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4399 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Shanghai

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 4399

CMD ["node", "server.js"]
