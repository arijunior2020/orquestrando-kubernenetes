package labruntime

import "testing"

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
