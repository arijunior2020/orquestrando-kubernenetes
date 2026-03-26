APP_NAME := kubeclass-web
IMAGE ?= kubeclass-web-lab:dev
REMOTE_USER ?= ubuntu
REMOTE_HOST ?= 54.159.107.223
REMOTE_SSH_KEY ?= ~/.ssh/kubeclass-pilot-key.pem
REMOTE_TMP ?= /home/$(REMOTE_USER)/kubeclass-web-lab-pilot.tar.gz
REMOTE_K3S_CTR ?= /usr/local/bin/k3s ctr
REMOTE_K8S_NS ?= platform
REMOTE_DEPLOYMENT ?= kubeclass-web

.PHONY: run test build docker-build deploy-remote terraform-fmt

run:
	go run ./cmd/$(APP_NAME)

test:
	GOCACHE=/tmp/go-build-cache go test ./...

build:
	mkdir -p bin
	go build -o ./bin/$(APP_NAME) ./cmd/$(APP_NAME)

docker-build:
	docker build -t $(IMAGE) .

deploy-remote: docker-build
	@echo "[deploy] salvando imagem $(IMAGE) em tar.gz"
	docker save $(IMAGE) | gzip > kubeclass-web-lab-pilot.tar.gz
	@echo "[deploy] copiando para $(REMOTE_USER)@$(REMOTE_HOST):$(REMOTE_TMP)"
	scp -i $(REMOTE_SSH_KEY) kubeclass-web-lab-pilot.tar.gz $(REMOTE_USER)@$(REMOTE_HOST):$(REMOTE_TMP)
	@echo "[deploy] importando imagem no k3s do host remoto"
	ssh -i $(REMOTE_SSH_KEY) $(REMOTE_USER)@$(REMOTE_HOST) \
		"gunzip -c $(REMOTE_TMP) | sudo $(REMOTE_K3S_CTR) images import - && \
		kubectl rollout restart deployment/$(REMOTE_DEPLOYMENT) -n $(REMOTE_K8S_NS) && \
		kubectl rollout status deployment/$(REMOTE_DEPLOYMENT) -n $(REMOTE_K8S_NS) && \
		kubectl get pods -n $(REMOTE_K8S_NS)"

terraform-fmt:
	terraform -chdir=infra/terraform/aws-ec2-k3s fmt -recursive
