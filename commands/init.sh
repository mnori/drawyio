# Builds everything from scratch and runs the project.

./cleanup.sh
docker image prune -a
cd ..
docker build -t mnori/drawyio .
cd commands
./create-mysql.sh
./create.sh

