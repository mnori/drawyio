#!/bin/bash

# Run this to create the container for the first time. Also runs the container.
# Run ./restart to do a soft reset
docker run --detach --name=drawyio-mysql --env="MYSQL_ROOT_PASSWORD=password" mysql
docker run -p 80:8080 --name drawyio --link drawyio-mysql:mysql -t -v /home/matthew/drawcloud:/usr/src/app/code mnori/drawcloud

