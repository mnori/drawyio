#!/bin/bash
# Restarts the server quickly. Not a clean reset, but it's just for development

docker kill drawyio

docker start  `docker ps -q -l` # restart it in the background
docker attach `docker ps -q -l` # reattach the terminal & stdin


