FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies with legacy peer deps and add missing ajv
RUN npm install --legacy-peer-deps && npm install ajv@8 --legacy-peer-deps

# Copy application
COPY . .

# Expose port
EXPOSE 3000

# Set environment variable
ENV REACT_APP_BACKEND_URL=http://localhost:8001
ENV BROWSER=none

# Run with react-scripts directly (bypass craco issues)
CMD ["npx", "react-scripts", "start"]
