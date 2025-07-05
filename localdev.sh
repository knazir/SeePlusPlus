#!/bin/bash

set -e  # Exit immediately on error

NETWORK_NAME="spp-no-internet"
BACKEND_IMAGE="spp-backend"
CODE_RUNNER_IMAGE="spp-code-runner"
FRONTEND_IMAGE="spp-frontend"
FRONTEND_LEGACY_IMAGE="spp-frontend-legacy"

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
    if [ -f docker-compose.yml ]; then
        docker-compose down
    else
        docker ps -q --filter "ancestor=$BACKEND_IMAGE" | xargs -r docker stop
        docker ps -q --filter "ancestor=$CODE_RUNNER_IMAGE" | xargs -r docker stop
        docker ps -q --filter "ancestor=$FRONTEND_IMAGE" | xargs -r docker stop
        docker ps -q --filter "ancestor=$FRONTEND_LEGACY_IMAGE" | xargs -r docker stop
    fi
}

function remove_containers() {
    echo "Removing stopped containers..."
    docker ps -aq --filter "ancestor=$BACKEND_IMAGE" | xargs -r docker rm
    docker ps -aq --filter "ancestor=$CODE_RUNNER_IMAGE" | xargs -r docker rm
    docker ps -aq --filter "ancestor=$FRONTEND_IMAGE" | xargs -r docker rm
    docker ps -aq --filter "ancestor=$FRONTEND_LEGACY_IMAGE" | xargs -r docker rm
}

function remove_images() {
    echo "Removing images..."
    docker rmi -f $BACKEND_IMAGE || true
    docker rmi -f $CODE_RUNNER_IMAGE || true
    docker rmi -f $FRONTEND_IMAGE || true
    docker rmi -f $FRONTEND_LEGACY_IMAGE || true
}

function build_images() {
    echo "Building container images..."

    case "$1" in
        backend)
            docker build -f backend/Dockerfile.dev -t $BACKEND_IMAGE:dev backend
            ;;
        code-runner)
            docker build -f code-runner/Dockerfile.dev -t $CODE_RUNNER_IMAGE:dev code-runner
            ;;
        frontend)
            docker build -f frontend/Dockerfile.dev -t $FRONTEND_IMAGE:dev frontend
            ;;
        frontend-legacy)
            docker build -f frontend-legacy/Dockerfile.dev -t $FRONTEND_LEGACY_IMAGE:dev frontend-legacy
            ;;
        "")
            docker build -f backend/Dockerfile.dev -t $BACKEND_IMAGE:dev backend
            docker build -f code-runner/Dockerfile.dev -t $CODE_RUNNER_IMAGE:dev code-runner
            docker build -f frontend/Dockerfile.dev -t $FRONTEND_IMAGE:dev frontend
            docker build -f frontend-legacy/Dockerfile.dev -t $FRONTEND_LEGACY_IMAGE:dev frontend-legacy
            ;;
        *)
            echo "Invalid image name: $1"
            echo "Usage: build_images [backend | code-runner | frontend | frontend-legacy]"
            return 1
            ;;
    esac
}

function start_containers() {
    create_network
    
    echo "Starting containers..."
    # Use docker-compose if available, otherwise fall back to docker run
    if [ -f docker-compose.yml ]; then
        echo "Using docker-compose..."
        docker-compose up -d
    else
        docker run --rm -d --name spp-backend \
          -v "$(pwd)/backend:/app" \
          -v /tmp:/tmp \
          -v /var/run/docker.sock:/var/run/docker.sock \
          -p 3000:3000 \
          -e EXEC_MODE=local \
          -e TRACE_TMP=/tmp/spp-usercode \
          $BACKEND_IMAGE

        docker run --rm -d --name spp-frontend \
          -v "$(pwd)/frontend:/app" \
          -p 8080:8080 $FRONTEND_IMAGE

        docker run --rm -d --name spp-frontend-legacy \
          -p 8000:8000 $FRONTEND_LEGACY_IMAGE
    fi
}

function show_logs() {
    if [ -z "$1" ]; then
        echo "Specify a container (frontend, backend, code-runner, frontend-legacy)."
        exit 1
    fi

    if [ "$1" == "frontend-legacy" ]; then
        CONTAINER_NAME="spp-frontend-legacy"
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
        echo "Specify a container (frontend, backend, code-runner, frontend-legacy)."
        exit 1
    fi
    
    if [ "$1" == "frontend" ]; then
        CONTAINER_NAME="spp-frontend"
    else
        CONTAINER_NAME="spp-$1"
    fi
    
    echo "Opening shell in $CONTAINER_NAME..."
    docker exec -it "$CONTAINER_NAME" sh
}

function deploy_to_aws() {
    if ! command -v copilot &> /dev/null; then
        echo "AWS Copilot CLI not found. Please install it first:"
        echo "  brew install aws/tap/copilot-cli  # on macOS"
        echo "  or visit: https://aws.github.io/copilot-cli/docs/getting-started/install/"
        exit 1
    fi
    
    ENV="$1"
    if [ -z "$ENV" ]; then
        ENV="production"
    fi
    
    echo "Deploying to AWS environment: $ENV"
    echo "Building and pushing images..."
    
    # Deploy services
    copilot svc deploy --name backend --env $ENV
    copilot svc deploy --name frontend --env $ENV
    copilot svc deploy --name frontend-legacy --env $ENV
    copilot job deploy --name code-runner --env $ENV
    
    echo "Deployment complete!"
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
    echo "                                 - Supports: frontend, backend, code-runner, frontend-legacy"
    echo "  deploy <env>      Deploy to AWS using Copilot (requires AWS credentials)."
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
    deploy)
        deploy_to_aws "$2"
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
