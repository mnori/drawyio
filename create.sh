#!/bin/bash

# Run this to create the container for the first time.
docker run -p 80:8080 --name drawyio -t -v /home/matthew/drawcloud:/usr/src/app/code doopsnogg/drawcloud

