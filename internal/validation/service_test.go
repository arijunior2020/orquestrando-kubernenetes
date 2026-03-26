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
kind: Namespace
metadata:
  name: team-dev
---
apiVersion: v1
kind: Pod
metadata:
  name: nginx-lab
  namespace: team-dev
spec:
  containers:
    - name: nginx
      image: nginx:stable`,
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
kind: Namespace
metadata:
  name: team-dev
---
apiVersion: v12
kind: Pod
metadata:
  name: nginx-lab
  namespace: team-dev
spec:
  containers:
    - name: nginx
      image: nginx:stable`,
	)
	if err != nil {
		t.Fatalf("nao esperava erro ao validar manifesto parseavel: %v", err)
	}

	if result.AllPassed {
		t.Fatalf("esperava falha para apiVersion invalida, recebeu %+v", result)
	}

	foundAPIError := false
	for _, check := range result.Checks {
		if check.Label == "APIs v1 nos manifests" {
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
