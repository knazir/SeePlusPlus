#!/usr/bin/env bash
set -euo pipefail

# Help function
show_help() {
  cat << EOF
Usage: $0 [ENV] [TAG] [OPTIONS]

Build and optionally deploy the code-runner service.

Arguments:
  ENV     Environment to deploy to (default: test)
          Options: test, prod
  TAG     Docker image tag (default: git short hash)

Options:
  --build             Build Docker image and push to ECR
  --update-manifest   Update the Copilot manifest with the new image
  --deploy            Deploy the service to Copilot after building/pushing
  --help              Show this help message

Examples:
  $0                    # Show help (no operations performed)
  $0 --build            # Build and push with default env (test) and git hash tag
  $0 prod --build       # Build and push to prod environment
  $0 test v1.0.0 --build  # Build and push with custom tag
  $0 prod v1.0.0 --build --update-manifest  # Build, push, and update manifest
  $0 prod v1.0.0 --build --deploy  # Build, push, update manifest, and deploy to prod

EOF
}

# Parse arguments
BUILD_FLAG=false
DEPLOY_FLAG=false
UPDATE_MANIFEST_FLAG=false
ENV="test"
TAG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --help)
      show_help
      exit 0
      ;;
    --build)
      BUILD_FLAG=true
      shift
      ;;
    --deploy)
      DEPLOY_FLAG=true
      shift
      ;;
    --update-manifest)
      UPDATE_MANIFEST_FLAG=true
      shift
      ;;
    test|prod)
      if [[ -z "$ENV" || "$ENV" == "test" ]]; then
        ENV="$1"
      else
        echo "❌ Multiple environments specified"
        exit 1
      fi
      shift
      ;;
    *)
      if [[ -z "$TAG" ]]; then
        TAG="$1"
      else
        echo "❌ Unknown argument: $1"
        show_help
        exit 1
      fi
      shift
      ;;
  esac
done

# Set default tag if not provided
if [[ -z "$TAG" ]]; then
  TAG=$(git rev-parse --short HEAD)
fi

# Get absolute path to the repo root
REPO_ROOT=$(git rev-parse --show-toplevel)

COPILOT_SERVICE=backend
ECR_REPO=spp-code-runner
MANIFEST="${REPO_ROOT}/copilot/${COPILOT_SERVICE}/manifest.yml"
DOCKERFILE_DIR="${REPO_ROOT}/code-runner"
DOCKERFILE="${DOCKERFILE_DIR}/Dockerfile.prod"

# Use AWS_DEFAULT_REGION if set, or fall back to whatever 'aws configure get region' returns
AWS_REGION="${AWS_REGION:-$(aws configure get region)}"
if [[ -z "$AWS_REGION" ]]; then
  echo "❌ No AWS region found in \$AWS_REGION or 'aws configure get region'"
  exit 1
fi

# Use AWS_PROFILE if you need a specific profile (defaults to 'default' otherwise)
AWS_PROFILE="${AWS_PROFILE:-default}"

# Get your account ID from STS (uses your current profile/credentials)
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
IMAGE="${REPO_URI}:${TAG}"

if [[ "$BUILD_FLAG" == true ]]; then
  echo "🔨 Building ${IMAGE}"
  docker build -f "${DOCKERFILE}" -t "${IMAGE}" "${DOCKERFILE_DIR}"

  echo "📦 Ensuring ECR repo exists"
  if ! aws ecr describe-repositories --repository-names "${ECR_REPO}" --region "${AWS_REGION}" >/dev/null 2>&1; then
    aws ecr create-repository --repository-name "${ECR_REPO}" --region "${AWS_REGION}"
  fi

  echo "🔐 Logging into ECR"
  aws ecr get-login-password --region "${AWS_REGION}" \
    | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

  echo "🚀 Pushing ${IMAGE}"
  docker push "${IMAGE}"
  echo "✅ Built and pushed ${IMAGE}"
fi

if [[ "$UPDATE_MANIFEST_FLAG" == true ]]; then
  echo "✏️  Updating Copilot manifest (${MANIFEST})"
  if ! command -v yq &>/dev/null; then
    echo "⚠️  Please install yq to auto‐patch the manifest (https://github.com/mikefarah/yq)"
    exit 1
  fi

  if [[ "${ENV}" == "test" ]]; then
    yq e -i ".image.location = \"${IMAGE}\"" "${MANIFEST}"
  elif [[ "${ENV}" == "prod" ]]; then
    yq e -i ".environments.prod.image.location = \"${IMAGE}\"" "${MANIFEST}"
  else
    echo "❌ Unknown env '${ENV}'. Use 'test' or 'prod'."
    exit 1
  fi
  echo "✅ Manifest updated with ${IMAGE}"
fi

if [[ "$DEPLOY_FLAG" == true ]]; then
  # Ensure manifest is updated before deploying
  if [[ "$UPDATE_MANIFEST_FLAG" != true ]]; then
    echo "⚠️  Deploying without updating manifest. Using existing image in manifest."
  fi
  
  echo "🚢 Deploying ${COPILOT_SERVICE} to ${ENV}"
  copilot svc deploy --name "${COPILOT_SERVICE}" --env "${ENV}"

  echo "✅ ${COPILOT_SERVICE} is now running in ${ENV}"
fi

# Summary of what was done
if [[ "$BUILD_FLAG" == false && "$UPDATE_MANIFEST_FLAG" == false && "$DEPLOY_FLAG" == false ]]; then
  echo "ℹ️  No operations performed. Use --help to see available options."
  echo "   Available flags: --build, --update-manifest, --deploy"
fi
