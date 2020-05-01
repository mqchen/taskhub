FROM node:10

WORKDIR /usr/src/taskhub
COPY ../ ./
RUN npm ci

EXPOSE 8080
CMD ["npm run example-server"]
