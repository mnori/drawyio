# Builds everything from scratch and runs the project.

./cleanup.sh
docker image prune -a
cd ..
docker build -t mnori/drawcloud .
cd commands
./create-mysql.sh
./create.sh

