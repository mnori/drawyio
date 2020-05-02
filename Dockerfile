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
RUN chmod 777 /usr/src/app/code/wait-for.sh

COPY ./wait-for.sh /usr/src/app
RUN chmod -x /usr/src/app/wait-for.sh

# ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.2.1/wait /wait
# RUN chmod +x /wait

# Start mysql and then run the node.js webserver
# Use && since only one CMD line is allowed
# CMD /etc/init.d/mysql start && npm start (assumed done)
# CMD npm start
