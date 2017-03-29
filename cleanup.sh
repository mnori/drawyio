#!/bin/bash
# Delete old container stuff, useful for rebuilding
docker stop $(docker ps -a -q)
docker rm $(docker ps -a -q)
