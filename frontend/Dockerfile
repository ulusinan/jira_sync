FROM node:16-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies and fix ajv issue
RUN npm install --legacy-peer-deps && \
    npm install ajv@8.12.0 ajv-keywords@5.1.0 --legacy-peer-deps

# Copy application
COPY . .

# Expose port
EXPOSE 3000

# Set environment variable
ENV REACT_APP_BACKEND_URL=http://localhost:8001
ENV BROWSER=none
ENV SKIP_PREFLIGHT_CHECK=true

# Run with craco
CMD ["npm", "start"]
