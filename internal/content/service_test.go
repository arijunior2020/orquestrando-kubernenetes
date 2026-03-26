package content

import (
	"encoding/json"
	"path/filepath"
	"testing"
)

func TestNewCourseServiceLoadsValidJSON(t *testing.T) {
	t.Parallel()

	service, err := NewCourseService(filepath.Join("..", "..", "content", "course.json"))
	if err != nil {
		t.Fatalf("esperava carregar course.json sem erro, recebeu: %v", err)
	}

	if !json.Valid(service.Payload()) {
		t.Fatal("payload retornado nao e um JSON valido")
	}
}
