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

action "Push Docker Image" {
  uses = "actions/docker/cli@master"
  needs = ["Test Project", "Build Docker Image"]
  args = "login -u $DOCKER_USERNAME -p $DOCKER_PASSWORD $CONTAINER_REGISTRY && docker push $CONTAINER_REGISTRY/$GITHUB_REPOSITORY"
  env = {
    CONTAINER_REGISTRY = "registry.gitlab.com"
  }
}
