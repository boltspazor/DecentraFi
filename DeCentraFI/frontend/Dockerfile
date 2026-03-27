FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN apk add --no-cache python3 make g++
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Browser calls this host:port (must match published backend port, e.g. http://localhost:3001)
ARG VITE_API_URL=http://localhost:3001
ARG VITE_CHAIN_ID=11155111
ARG VITE_CAMPAIGN_FACTORY_ADDRESS_SEPOLIA=
ARG VITE_CAMPAIGN_FACTORY_ADDRESS_MAINNET=
ARG VITE_ADMIN_WALLET=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CHAIN_ID=$VITE_CHAIN_ID
ENV VITE_CAMPAIGN_FACTORY_ADDRESS_SEPOLIA=$VITE_CAMPAIGN_FACTORY_ADDRESS_SEPOLIA
ENV VITE_CAMPAIGN_FACTORY_ADDRESS_MAINNET=$VITE_CAMPAIGN_FACTORY_ADDRESS_MAINNET
ENV VITE_ADMIN_WALLET=$VITE_ADMIN_WALLET
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]

