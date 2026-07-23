FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview", "--", "--host", "--port", "3000"]
