#
# Following a tutorial at
# https://docs.docker.com/language/nodejs/build-images/
#
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
EXPOSE 8000

# install packages
COPY ["package.json", "package-lock.json*", "yarn.lock", "./"]
RUN yarn install --production

# copy the other files, too
COPY . .

# start the server
CMD npm run start
