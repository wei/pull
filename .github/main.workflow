workflow "Build and Push Docker Container" {
  resolves = ["Push Docker Image"]
  on = "push"
}

action "Filters for GitHub Actions" {
  uses = "actions/bin/filter@master"
  args = "branch master"
}

action "Build Docker Image" {
  uses = "actions/docker/cli@master"
  needs = ["Filters for GitHub Actions"]
  args = "build -t $GITHUB_REPOSITORY ."
}

action "Login to Docker Registry" {
  uses = "actions/docker/login@master"
  needs = ["Filters for GitHub Actions"]
  env = {
    DOCKER_REGISTRY_URL = "registry.gitlab.com"
  }
  secrets = ["DOCKER_USERNAME", "DOCKER_PASSWORD"]
}

action "Docker Tag" {
  uses = "actions/docker/tag@master"
  needs = ["Build Docker Image"]
  args = "$GITHUB_REPOSITORY $CONTAINER_REGISTRY/$GITHUB_REPOSITORY"
  env = {
    CONTAINER_REGISTRY = "registry.gitlab.com"
  }
}

action "Push Docker Image" {
  uses = "actions/docker/cli@master"
  needs = ["Docker Tag", "Login to Docker Registry"]
  args = "push $CONTAINER_REGISTRY/$GITHUB_REPOSITORY"
  env = {
    CONTAINER_REGISTRY = "registry.gitlab.com"
  }
}
