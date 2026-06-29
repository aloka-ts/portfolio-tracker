FROM node:22-alpine

WORKDIR /app

# Install dependencies first for caching
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the configured port
EXPOSE 3001

# Set default environment variables
ENV HOST=0.0.0.0
ENV PORT=3001
ENV ASTRO_TELEMETRY_DISABLED=1

# Default command runs the development server
CMD ["npm", "run", "dev"]
