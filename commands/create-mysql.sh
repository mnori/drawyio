#!/bin/bash

docker rm drawyio-mysql
docker run --detach --name=drawyio-mysql --env="MYSQL_ROOT_PASSWORD=password" mysql