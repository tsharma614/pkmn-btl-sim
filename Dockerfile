FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies + tsx for running TypeScript
RUN npm install --production && npm install tsx

# Copy server, engine, data, types, utils, logging source
COPY src/server/ src/server/
COPY src/engine/ src/engine/
COPY src/data/ src/data/
COPY src/types/ src/types/
COPY src/utils/ src/utils/
COPY src/logging/ src/logging/
COPY tsconfig.json ./

ENV PORT=3000
EXPOSE 3000

CMD ["npx", "tsx", "src/server/index.ts"]
