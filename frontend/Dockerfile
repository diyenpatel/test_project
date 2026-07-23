FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm install --only=production

COPY src/ ./src/

EXPOSE 3000

CMD ["npx", "serve", "-s", "src", "-l", "3000"]
