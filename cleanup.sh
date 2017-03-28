#!/bin/bash

# clean up earlier version
docker stop $(docker ps -a -q)
docker rm $(docker ps -a -q)

# docker run --name drawyio-mysql -e MYSQL_ROOT_PASSWORD=LocalPw -d mysql:8.0.0
