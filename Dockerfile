# Grab a particular version of node.js
FROM node:7.8.0

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install

# Determine the working directory for running the code
WORKDIR /usr/src/app/code

EXPOSE 8080

# Start mysql and then run the node.js webserver
# Use && since only one CMD line is allowed
# CMD /etc/init.d/mysql start && npm start
CMD npm start
