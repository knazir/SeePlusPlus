#!/bin/bash

set -e  # Exit immediately on error

NETWORK_NAME="spp-no-internet"
BACKEND_IMAGE="spp-backend-image"
USER_CODE_IMAGE="spp-user-code-image"
FRONTEND_IMAGE="spp-frontend-image"
ARCHIVE_FRONTEND_IMAGE="spp-archive-frontend-image"

function create_network() {
    echo "Creating isolated network ($NETWORK_NAME)..."
    if docker network ls --format "{{.Name}}" | grep -wq "$NETWORK_NAME"; then
        docker network rm "$NETWORK_NAME"
    fi
    docker network create --internal "$NETWORK_NAME"
}

function remove_network() {
    if docker network ls --format "{{.Name}}" | grep -wq "$NETWORK_NAME"; then
        echo "Removing existing isolated network ($NETWORK_NAME)..."
        docker network rm "$NETWORK_NAME"
    else
        echo "No existing network found."
    fi
}

function stop_containers() {
    echo "Stopping running containers..."
    docker ps -q --filter "ancestor=$BACKEND_IMAGE" | xargs -r docker stop
    docker ps -q --filter "ancestor=$USER_CODE_IMAGE" | xargs -r docker stop
    docker ps -q --filter "ancestor=$FRONTEND_IMAGE" | xargs -r docker stop
    docker ps -q --filter "ancestor=$ARCHIVE_FRONTEND_IMAGE" | xargs -r docker stop
}

function remove_containers() {
    echo "Removing stopped containers..."
    docker ps -aq --filter "ancestor=$BACKEND_IMAGE" | xargs -r docker rm
    docker ps -aq --filter "ancestor=$USER_CODE_IMAGE" | xargs -r docker rm
    docker ps -aq --filter "ancestor=$FRONTEND_IMAGE" | xargs -r docker rm
    docker ps -aq --filter "ancestor=$ARCHIVE_FRONTEND_IMAGE" | xargs -r docker rm
}

function remove_images() {
    echo "Removing images..."
    docker rmi -f $BACKEND_IMAGE || true
    docker rmi -f $USER_CODE_IMAGE || true
    docker rmi -f $FRONTEND_IMAGE || true
    docker rmi -f $ARCHIVE_FRONTEND_IMAGE || true
}

function build_images() {
    echo "Building container images..."

    case "$1" in
        backend)
            docker build -t $BACKEND_IMAGE backend
            ;;
        user-code)
            docker build -t $USER_CODE_IMAGE backend/user-code-container
            ;;
        frontend)
            docker build -t $FRONTEND_IMAGE frontend
            ;;
        archive-frontend)
            docker build -t $ARCHIVE_FRONTEND_IMAGE archive/frontend
            ;;
        "")
            docker build -t $BACKEND_IMAGE backend
            docker build -t $USER_CODE_IMAGE backend/user-code-container
            docker build -t $FRONTEND_IMAGE frontend
            ;;
        *)
            echo "Invalid image name: $1"
            echo "Usage: build_images [backend | user-code | frontend | archive-frontend]"
            return 1
            ;;
    esac
}

function start_containers() {
    create_network
    
    echo "Starting containers..."
    docker run --rm -d --name spp-backend \
      -v "$(pwd)/backend:/app" \
      -v /tmp:/tmp \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -p 3000:3000 $BACKEND_IMAGE

    docker run --rm -d --name spp-frontend \
      -v "$(pwd)/frontend:/app" \
      -p 8080:8080 $FRONTEND_IMAGE
}

function start_archive_frontend() {
    create_network
    
    echo "Starting containers with archive frontend..."
    docker run --rm -d --name spp-backend \
      -v "$(pwd)/backend:/app" \
      -v /tmp:/tmp \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -p 3000:3000 $BACKEND_IMAGE

    docker run --rm -d --name spp-archive-frontend \
      -p 8080:8080 $ARCHIVE_FRONTEND_IMAGE
}

function show_logs() {
    if [ -z "$1" ]; then
        echo "Specify a container (frontend, backend, user-code, archive-frontend)."
        exit 1
    fi

    if [ "$1" == "archive-frontend" ]; then
        CONTAINER_NAME="spp-archive-frontend"
    else
        CONTAINER_NAME="spp-$1"
    fi

    # Check if user wants to tail logs or just show recent logs
    if [ "$2" == "--tail" ]; then
        echo "Tailing logs for $CONTAINER_NAME..."
        docker logs -f "$CONTAINER_NAME"
    else
        echo "Showing latest logs for $CONTAINER_NAME..."
        docker logs --tail=50 "$CONTAINER_NAME"
    fi
}

function exec_container() {
    if [ -z "$1" ]; then
        echo "Specify a container (frontend, backend, user-code, archive-frontend)."
        exit 1
    fi
    
    if [ "$1" == "archive-frontend" ]; then
        CONTAINER_NAME="spp-archive-frontend"
    else
        CONTAINER_NAME="spp-$1"
    fi
    
    echo "Opening shell in $CONTAINER_NAME..."
    docker exec -it "$CONTAINER_NAME" sh
}

function help_menu() {
    echo "Usage: ./localdev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up                Start all containers (default action)."
    echo "  up-archive        Start backend with archive frontend."
    echo "  down              Stop and remove running containers (keep images)."
    echo "  restart           Restart containers without rebuilding."
    echo "  rebuild           Stop, remove, and fully rebuild containers."
    echo "  clean             Remove containers and images."
    echo "  network-reset     Recreate the isolated network."
    echo "  exec <container>  Open shell in a running container."
    echo "  logs <container> [--tail]    Show logs for a specific container."
    echo "                                 - Without --tail: Show last 50 lines."
    echo "                                 - With --tail: Continuously stream logs."
    echo "                                 - Supports: frontend, backend, user-code, archive-frontend"
    echo "  help              Show this menu."
}

# Default behavior: Start everything if no arguments are passed
if [ $# -eq 0 ]; then
    echo "No command specified. Defaulting to 'up'..."
    build_images
    start_containers
    exit 0
fi

# Handle commands
case "$1" in
    up)
        start_containers
        ;;
    up-archive)
        start_archive_frontend
        ;;
    down)
        stop_containers
        remove_containers
        ;;
    restart)
        stop_containers
        remove_containers
        start_containers
        ;;
    build)
        build_images "$2"
        ;;
    rebuild)
        stop_containers
        remove_containers
        remove_images
        build_images
        start_containers
        ;;
    clean)
        stop_containers
        remove_containers
        remove_images
        remove_network
        ;;
    network-reset)
        create_network
        ;;
    logs)
        show_logs "$2" "$3"
        ;;
    exec)
        exec_container "$2"
        ;;
    help)
        help_menu
        ;;
    *)
        echo "Unknown command: $1"
        help_menu
        exit 1
        ;;
esac
