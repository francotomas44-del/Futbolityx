FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/src ./src
COPY js/stats.js ./js/stats.js

USER node
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:8787/v1/health').then(function(r){process.exit(r.ok?0:1)}).catch(function(){process.exit(1)})"

CMD ["node", "src/index.js"]
