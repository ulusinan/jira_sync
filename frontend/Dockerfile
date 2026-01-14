FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy application
COPY . .

# Expose port
EXPOSE 3000

# Set environment variable
ENV REACT_APP_BACKEND_URL=http://localhost:8001
ENV BROWSER=none

# Run the application in development mode
CMD ["npm", "start"]
