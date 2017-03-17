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

# Install MySQL inside this container
ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update \
  && apt-get install -y mysql-server mysql-client libmysqlclient-dev \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

EXPOSE 8080

# Start mysql and then run the node.js webserver
# Use && since only one CMD line is allowed
CMD /etc/init.d/mysql start && npm start
