FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ui/package.json ./packages/ui/package.json
RUN npm ci --ignore-scripts

FROM dependencies AS dev
COPY . .
CMD ["npm", "run", "dev"]

FROM dev AS build
RUN npm run build

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
COPY server.mjs ./server.mjs
COPY lib ./lib
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4173
CMD ["node", "server.mjs"]
