#!/bin/bash

# clean up earlier version
docker stop $(docker ps -a -q)
docker rm $(docker ps -a -q)

# seperate container system
# docker run --name drawyio-mysql -e MYSQL_ROOT_PASSWORD=LocalPw -d mysql:8.0.0

# create drawyio node container
docker run -p 80:8080 -t -v /home/matthew/drawcloud:/usr/src/app/code -d doopsnogg/drawcloud

