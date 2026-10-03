FROM node:18-alpine

WORKDIR /app

COPY package.json ./
COPY . .

EXPOSE 4000
ENV PORT=4000

CMD ["node", "server.js"]
