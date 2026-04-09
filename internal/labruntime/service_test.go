package labruntime

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestNamespaceNameForStudentAndLab(t *testing.T) {
	t.Parallel()

	service := &Service{namespacePrefix: "kubeclass"}
	name := service.namespaceNameFor(42, "lab_1")

	if name != "kubeclass-s42-lab-1" {
		t.Fatalf("namespace inesperado: %s", name)
	}
}

func TestSanitizeDNSLabelFallback(t *testing.T) {
	t.Parallel()

	if got := sanitizeDNSLabel("$$$"); got != "lab" {
		t.Fatalf("esperava fallback lab, recebeu %s", got)
	}
}

func TestDeleteStudentNamespacesRemovesOnlyMatchingNamespaces(t *testing.T) {
	t.Parallel()

	service := &Service{
		enabled: true,
		clientset: fake.NewSimpleClientset(
			&corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: "kubeclass-s42-lab-1",
					Labels: map[string]string{
						"app.kubernetes.io/managed-by": "kubeclass-web",
						"kubeclass.io/student-id":      "42",
					},
				},
			},
			&corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: "kubeclass-s42-lab-2",
					Labels: map[string]string{
						"app.kubernetes.io/managed-by": "kubeclass-web",
						"kubeclass.io/student-id":      "42",
					},
				},
			},
			&corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: "kubeclass-s7-lab-1",
					Labels: map[string]string{
						"app.kubernetes.io/managed-by": "kubeclass-web",
						"kubeclass.io/student-id":      "7",
					},
				},
			},
		),
	}

	if err := service.DeleteStudentNamespaces(context.Background(), 42); err != nil {
		t.Fatalf("nao esperava erro ao remover namespaces do aluno: %v", err)
	}

	namespaces, err := service.clientset.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		t.Fatalf("falha ao listar namespaces apos exclusao: %v", err)
	}

	if len(namespaces.Items) != 1 {
		t.Fatalf("esperava apenas 1 namespace restante, recebeu %d", len(namespaces.Items))
	}

	if namespaces.Items[0].Name != "kubeclass-s7-lab-1" {
		t.Fatalf("namespace inesperado restante: %s", namespaces.Items[0].Name)
	}
}
