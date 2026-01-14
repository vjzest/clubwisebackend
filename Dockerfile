# Development stage
FROM node:20-alpine AS development

WORKDIR /usr/src/app

COPY package*.json pnpm-lock.yaml ./

RUN npm install -g pnpm

RUN pnpm install

COPY . .

EXPOSE 4000

CMD ["pnpm", "run", "dev"]


# Production stage
FROM node:20-alpine AS production

WORKDIR /usr/src/app

COPY package*.json pnpm-lock.yaml ./

RUN npm install -g pnpm

RUN pnpm install --prod

COPY . .

EXPOSE 4000

CMD ["pnpm", "run", "start:prod"]
