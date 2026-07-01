FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy server
COPY server.js ./

# Sessions directory
RUN mkdir -p sessions

# Port
EXPOSE 3001

CMD ["node", "server.js"]
