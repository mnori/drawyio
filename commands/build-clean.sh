#!/bin/bash
# Docker build, no cache version
cd ..
docker build --no-cache=true -t mnori/drawcloud .
