FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (leverage Docker layer caching)
COPY package*.json ./
RUN npm ci --only=production || npm install --production

# Copy source code
COPY src ./src

# Expose the API port
EXPOSE 8024

# Run the server
CMD ["node", "src/server.js"]


