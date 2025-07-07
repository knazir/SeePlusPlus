#!/bin/bash

set -e  # Exit immediately on error

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

function show_logs() {
    if [ -z "$1" ]; then
        echo "Specify a service (frontend, backend, frontend-legacy)."
        echo "Usage: ./localdev.sh logs <service> [--tail]"
        exit 1
    fi

    # Check if user wants to tail logs or just show recent logs
    if [ "$2" == "--tail" ]; then
        echo "Tailing logs for $1..."
        docker-compose logs -f "$1"
    else
        echo "Showing latest logs for $1..."
        docker-compose logs --tail=50 "$1"
    fi
}

function exec_container() {
    if [ -z "$1" ]; then
        echo "Specify a service (frontend, backend, frontend-legacy)."
        echo "Usage: ./localdev.sh exec <service>"
        exit 1
    fi
    
    echo "Opening shell in $1..."
    docker-compose exec "$1" sh
}

function deploy_to_aws() {
    if ! command -v copilot &> /dev/null; then
        echo "AWS Copilot CLI not found. Please install it first:"
        echo "  brew install aws/tap/copilot-cli  # on macOS"
        echo "  or visit: https://aws.github.io/copilot-cli/docs/getting-started/install/"
        exit 1
    fi
    
    ENV="${1:-test}"
    shift  # Remove the environment argument, leaving only service arguments
    
    # Validate environment parameter
    if [[ "$ENV" != "test" && "$ENV" != "prod" ]]; then
        echo "Error: Invalid environment '$ENV'"
        echo "Valid environments are: test, prod"
        echo "Usage: ./localdev.sh deploy <env> [services...]"
        echo "Example: ./localdev.sh deploy test backend"
        exit 1
    fi
    
    # If no services specified, deploy all
    if [ $# -eq 0 ]; then
        SERVICES=("code-runner" "backend" "frontend" "frontend-legacy")
        echo "No services specified. Deploying all services to AWS environment: $ENV"
    else
        SERVICES=("$@")
        echo "Deploying services: ${SERVICES[*]} to AWS environment: $ENV"
    fi
    
    # Deploy code-runner if specified or if deploying all
    if [[ " ${SERVICES[*]} " =~ " code-runner " ]]; then
        echo "Building code-runner image..."

        docker buildx build --platform linux/amd64 -f ./code-runner/Dockerfile.prod -t $ECR_REPO:$ENV code-runner/
        
        # Login to ECR before pushing
        echo "Logging in to ECR..."
        aws ecr get-login-password --region $AWS_REGION \
          | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
        
        echo "Pushing code-runner image to ECR..."
        docker push $ECR_REPO:$ENV
    fi
    
    # Deploy other services using Copilot
    for service in "${SERVICES[@]}"; do
        if [[ "$service" != "code-runner" ]]; then
            echo "Deploying $service..."
            copilot svc deploy --name $service --env $ENV
        fi
    done
    
    echo "Deployment complete!"
}

function help_menu() {
    echo "Usage: ./localdev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up                Start all services (default action)."
    echo "  down              Stop and remove running containers (keep images)."
    echo "  restart           Restart services without rebuilding."
    echo "  build [service]   Build all services or specific service."
    echo "  rebuild           Stop, remove, rebuild and start services."
    echo "  clean             Remove containers, images, and volumes."
    echo "  logs <service> [--tail]    Show logs for a specific service."
    echo "                                 - Without --tail: Show last 50 lines."
    echo "                                 - With --tail: Continuously stream logs."
    echo "                                 - Supports: frontend, backend, frontend-legacy"
    echo "  exec <service>    Open shell in a running service."
    echo "  deploy [env] [services...] Deploy to AWS using Copilot."
    echo "                                 - env: Environment name (default: test)"
    echo "                                 - services: Space-separated list of services"
    echo "                                 - If no services specified, deploys all"
    echo "                                 - Supports: code-runner, backend, frontend, frontend-legacy"
    echo "  help              Show this menu."
    echo ""
    echo "Environment Configuration:"
    echo "  Create a .env file in the project root to customize:"
    echo "  - AWS_REGION: AWS region"
    echo "  - ECR_REPO: AWS ECR repository URL"
    echo ""
    echo "Examples:"
    echo "  ./localdev.sh up                    # Start all services"
    echo "  ./localdev.sh build backend         # Build only backend"
    echo "  ./localdev.sh logs frontend --tail  # Tail frontend logs"
    echo "  ./localdev.sh exec backend          # Shell into backend"
    echo "  ./localdev.sh deploy test           # Deploy all services to test env"
    echo "  ./localdev.sh deploy prod           # Deploy all services to prod env"
    echo "  ./localdev.sh deploy test backend   # Deploy only backend to test env"
    echo "  ./localdev.sh deploy prod code-runner frontend  # Deploy specific services"
}

# Default behavior: Start everything if no arguments are passed
if [ $# -eq 0 ]; then
    echo "No command specified. Defaulting to 'up'..."
    docker-compose up -d
    exit 0
fi

# Handle commands
case "$1" in
    up)
        docker-compose up -d
        ;;
    down)
        docker-compose down
        ;;
    restart)
        docker-compose restart
        ;;
    build)
        docker-compose build "${2:-}"
        ;;
    rebuild)
        echo "Stopping and removing containers..."
        docker-compose down --rmi all
        echo "Building and starting services..."
        docker-compose up --build -d
        ;;
    clean)
        echo "Removing containers, images, and volumes..."
        docker-compose down --rmi all --volumes
        ;;
    logs)
        show_logs "$2" "$3"
        ;;
    exec)
        exec_container "$2"
        ;;
    deploy)
        deploy_to_aws "$2" "${@:3}"
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
