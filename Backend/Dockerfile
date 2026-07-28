FROM node:20-slim

# git is required to install git-hosted deps (uWebSockets.js)
# python3 + make + g++ are required to compile native addons (better-sqlite3)
RUN apt-get update && \
    apt-get install -y --no-install-recommends git python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data

EXPOSE 8080
EXPOSE 9001

CMD ["node", "src/index.js"]
