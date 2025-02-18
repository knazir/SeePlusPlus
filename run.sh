# Crate network to isolate user code from network
if docker network ls --format "{{.Name}}" | grep -wq "no-internet"; then
    docker network rm no-internet
fi
docker network create --internal no-internet 

# Stop running and remove container instances
docker ps -q --filter "ancestor=spp-backend-image" | xargs -r docker stop
docker ps -q --filter "ancestor=spp-user-code-image" | xargs -r docker stop
docker ps -q --filter "ancestor=spp-frontend-image" | xargs -r docker stop

docker ps -aq --filter "ancestor=spp-backend-image" | xargs -r docker rm
docker ps -aq --filter "ancestor=spp-user-code-image" | xargs -r docker rm
docker ps -q --filter "ancestor=spp-frontend-image" | xargs -r docker rm

# Delete container images
docker rmi spp-backend-image
docker rmi spp-user-code-image
docker rmi spp-frontend-image

# Build container images
docker build -t spp-backend-image backend
docker build -t spp-user-code-image backend/user-code-container
docker build -t spp-frontend-image frontend

# Run startup container images
# Mount local files for live updates (dev)
# TODO: Figure out how to toggle between prod and dev configs
docker run --rm -d --name spp-backend \
  -v "$(pwd)/backend:/app" \
  -v /tmp:/tmp \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -p 3000:3000 spp-backend-image

docker run --rm -d --name spp-frontend \
  -v "$(pwd)/frontend:/app" \
  -p 8080:8080 spp-frontend-image