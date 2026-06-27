# Use Node.js LTS image as base
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Expose the configured port (3001)
EXPOSE 3001

# Set host environment variable to allow connections outside the container
ENV HOST=0.0.0.0
ENV PORT=3001
ENV ASTRO_TELEMETRY_DISABLED=1

# Start Astro dev server binding to 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host"]
