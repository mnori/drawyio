#!/bin/bash
# Restarts the server quickly. Not a clean reset, but who cares, it's just for development

docker kill drawyio

docker start  `docker ps -q -l` # restart it in the background
docker attach `docker ps -q -l` # reattach the terminal & stdin

# docker run -p 80:8080 --name drawyio -t -v /home/matthew/drawcloud:/usr/src/app/code doopsnogg/drawcloud

