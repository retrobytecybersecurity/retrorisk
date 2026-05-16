FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/

RUN addgroup -g 1001 -S nodejs && \
    adduser -S retrorisk -u 1001 && \
    chown -R retrorisk:nodejs /app

USER retrorisk

EXPOSE 3001

CMD ["node", "src/index.js"]
