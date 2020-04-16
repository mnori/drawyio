# Grab a particular version of node.js
FROM node:12.16.2

# Create app directory (assumed done)
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies (assumed done)
COPY package.json .
RUN npm install --verbose

# Copy code, determine the working directory for running it
COPY . /usr/src/app/code
WORKDIR /usr/src/app/code

# EXPOSE 8080

# Start mysql and then run the node.js webserver
# Use && since only one CMD line is allowed
# CMD /etc/init.d/mysql start && npm start (assumed done)
# CMD npm start
