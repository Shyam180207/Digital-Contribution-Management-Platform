FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev \
    && mkdir -p /app/uploads/receipts \
    && chown -R node:node /app

COPY --chown=node:node server/models ./models
COPY --chown=node:node server/src ./src

USER node
EXPOSE 3001
CMD ["npm", "start"]
