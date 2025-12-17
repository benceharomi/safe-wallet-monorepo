FROM node:18-alpine
RUN apk add --no-cache libc6-compat git python3 py3-pip make g++ libusb-dev eudev-dev linux-headers

# Set working directory
WORKDIR /app

# Copy root
COPY . .

# Set working directory to the web app
WORKDIR apps/web

# Enable corepack and configure yarn
RUN corepack enable
RUN yarn config set httpTimeout 300000

# Run any custom post-install scripts
RUN yarn install --immutable
RUN yarn after-install

ARG PORT
ARG NEXT_PUBLIC_SNS_BACKEND_URL
ARG NEXT_PUBLIC_INFURA_TOKEN
ARG NEXT_PUBLIC_WC_PROJECT_ID

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV NEXT_PUBLIC_SNS_BACKEND_URL=$NEXT_PUBLIC_SNS_BACKEND_URL
ENV NEXT_PUBLIC_INFURA_TOKEN=$NEXT_PUBLIC_INFURA_TOKEN
ENV NEXT_PUBLIC_WC_PROJECT_ID=$NEXT_PUBLIC_WC_PROJECT_ID

# Build the static site
RUN yarn build

# Expose the port
EXPOSE 3000

# Serve the static files
CMD ["sh", "-c", "npx -y serve out -p ${PORT:-3000}"]
