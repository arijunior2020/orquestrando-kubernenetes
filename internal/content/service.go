package content

import (
	"encoding/json"
	"fmt"
	"os"
)

type CourseService struct {
	payload []byte
}

func NewCourseService(path string) (*CourseService, error) {
	payload, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("falha ao ler arquivo de curso: %w", err)
	}

	if !json.Valid(payload) {
		return nil, fmt.Errorf("arquivo de curso invalido")
	}

	return &CourseService{payload: payload}, nil
}

func (s *CourseService) Payload() []byte {
	out := make([]byte, len(s.payload))
	copy(out, s.payload)
	return out
}
