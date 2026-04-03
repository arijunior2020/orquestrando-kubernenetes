package validation

import (
	"path/filepath"
	"testing"
)

func TestValidateReturnsSuccessForLab1(t *testing.T) {
	t.Parallel()

	service, err := NewService(filepath.Join("..", "..", "content", "validators.json"))
	if err != nil {
		t.Fatalf("falha ao carregar validadores: %v", err)
	}

	result, err := service.Validate(
		"lab-1",
		`apiVersion: v1
kind: Pod
metadata:
  name: nginx-yaml
spec:
  containers:
    - name: nginx
      image: nginx:stable
      ports:
        - containerPort: 80`,
	)
	if err != nil {
		t.Fatalf("nao esperava erro ao validar: %v", err)
	}

	if !result.AllPassed {
		t.Fatalf("esperava validacao completa, recebeu %+v", result)
	}
}

func TestValidateReturnsErrorForUnknownLab(t *testing.T) {
	t.Parallel()

	service, err := NewService(filepath.Join("..", "..", "content", "validators.json"))
	if err != nil {
		t.Fatalf("falha ao carregar validadores: %v", err)
	}

	if _, err := service.Validate("desconhecido", ""); err == nil {
		t.Fatal("esperava erro para lab desconhecido")
	}
}

func TestValidateRejectsInvalidAPIVersionForLab1(t *testing.T) {
	t.Parallel()

	service, err := NewService(filepath.Join("..", "..", "content", "validators.json"))
	if err != nil {
		t.Fatalf("falha ao carregar validadores: %v", err)
	}

	result, err := service.Validate(
		"lab-1",
		`apiVersion: v12
kind: Pod
metadata:
  name: nginx-yaml
spec:
  containers:
    - name: nginx
      image: nginx:stable
      ports:
        - containerPort: 80`,
	)
	if err != nil {
		t.Fatalf("nao esperava erro ao validar manifesto parseavel: %v", err)
	}

	if result.AllPassed {
		t.Fatalf("esperava falha para apiVersion invalida, recebeu %+v", result)
	}

	foundAPIError := false
	for _, check := range result.Checks {
		if check.Label == "API v1 do Pod" {
			foundAPIError = true
			if check.Passed {
				t.Fatal("esperava check de apiVersion reprovado")
			}
		}
	}

	if !foundAPIError {
		t.Fatal("esperava check especifico de apiVersion na validacao")
	}
}

func TestValidateReturnsSuccessForLab5(t *testing.T) {
	t.Parallel()

	service, err := NewService(filepath.Join("..", "..", "content", "validators.json"))
	if err != nil {
		t.Fatalf("falha ao carregar validadores: %v", err)
	}

	result, err := service.Validate(
		"lab-5",
		`apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
        - name: nginx
          image: nginx:latest
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: webapp
spec:
  selector:
    app: webapp
  ports:
    - port: 80
      targetPort: 80
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: webapp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: webapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50`,
	)
	if err != nil {
		t.Fatalf("nao esperava erro ao validar lab-5: %v", err)
	}

	if !result.AllPassed {
		t.Fatalf("esperava validacao completa do lab-5, recebeu %+v", result)
	}
}
