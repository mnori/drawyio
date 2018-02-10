./cleanup.sh
docker image prune -a
cd ..
docker build -t mnori/drawcloud .

