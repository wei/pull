workflow "Build and Push Docker Container" {
  resolves = [
    "Push Docker Image",
  ]
  on = "push"
}

action "Test Project" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "ci && npm test"
}

action "Filters for GitHub Actions" {
  uses = "actions/bin/filter@master"
  needs = ["Test Project"]
  args = "branch master"
}

action "Build Docker Image" {
  uses = "actions/docker/cli@master"
  needs = ["Filters for GitHub Actions"]
  args = "build -t $CONTAINER_REGISTRY/$GITHUB_REPOSITORY ."
  env = {
    CONTAINER_REGISTRY = "registry.gitlab.com"
  }
}

action "Login to Docker Registry" {
  uses = "actions/docker/login@master"
  needs = ["Filters for GitHub Actions"]
  env = {
    DOCKER_REGISTRY_URL = "registry.gitlab.com"
  }
  secrets = ["DOCKER_USERNAME", "DOCKER_PASSWORD"]
}

action "Push Docker Image" {
  uses = "actions/docker/cli@master"
  needs = ["Build Docker Image", "Login to Docker Registry"]
  args = "push $CONTAINER_REGISTRY/$GITHUB_REPOSITORY"
  env = {
    CONTAINER_REGISTRY = "registry.gitlab.com"
  }
}
