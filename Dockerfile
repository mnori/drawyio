# Grab the latest version of node.js
FROM node:latest

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install

# Determine the working directory for running the code
WORKDIR /usr/src/app/code

EXPOSE 8080
CMD [ "npm", "start" ]
