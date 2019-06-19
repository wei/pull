workflow "Build and Push Docker Container" {
  resolves = [
    "Push Docker Image",
  ]
  on = "push"
}

action "Test Project" {
  uses = "actions/npm@master"
  args = "ci && npm test"
}

action "Filters for GitHub Actions" {
  uses = "actions/bin/filter@master"
  args = "branch master"
}

action "Build Docker Image" {
  uses = "actions/docker/cli@master"
  needs = ["Filters for GitHub Actions"]
  args = "build -t $CONTAINER_REGISTRY/$GITHUB_REPOSITORY . --build-arg VCS_REF=$GITHUB_SHA --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  env = {
    CONTAINER_REGISTRY = "registry.gitlab.com"
  }
}

action "Push Docker Image" {
  uses = "actions/docker/cli@master"
  needs = ["Test Project", "Build Docker Image"]
  args = "login -u $DOCKER_USERNAME -p $DOCKER_PASSWORD $CONTAINER_REGISTRY && docker push $CONTAINER_REGISTRY/$GITHUB_REPOSITORY"
  env = {
    CONTAINER_REGISTRY = "registry.gitlab.com"
  }
  secrets = ["DOCKER_PASSWORD", "DOCKER_USERNAME"]
}
