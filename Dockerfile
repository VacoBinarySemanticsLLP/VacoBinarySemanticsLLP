FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

COPY . .

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

EXPOSE 9007

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:9007/api/health || exit 1

CMD [ "npm", "start" ]
