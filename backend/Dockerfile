FROM node:20-alpine

WORKDIR /app

# Copy package descriptors first for layer caching
COPY package.json ./

# Install production dependencies
RUN npm install --only=production

# Copy application source code
COPY src/ ./src/

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "src/app.js"]
