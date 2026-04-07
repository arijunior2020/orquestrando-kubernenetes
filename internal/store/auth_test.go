package store

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
)

func TestLoadStudentAccessLookupReturnsCohortWindows(t *testing.T) {
	t.Parallel()

	store, err := NewSQLiteStore(filepath.Join(t.TempDir(), "kubeclass.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite store: %v", err)
	}

	openCohort, err := store.CreateCohort(context.Background(), CreateCohortParams{
		Code:           "turma-aberta",
		Title:          "Turma Aberta",
		AccessStartsAt: "2020-01-01",
		AccessEndsAt:   "2999-12-31",
	})
	if err != nil {
		t.Fatalf("falha ao criar turma aberta: %v", err)
	}

	futureCohort, err := store.CreateCohort(context.Background(), CreateCohortParams{
		Code:           "turma-futura",
		Title:          "Turma Futura",
		AccessStartsAt: "2999-04-09",
		AccessEndsAt:   "2999-04-25",
	})
	if err != nil {
		t.Fatalf("falha ao criar turma futura: %v", err)
	}

	registered, err := store.CreateStudent(context.Background(), CreateStudentParams{
		Name:       "Aluno Lookup",
		Email:      "lookup@example.com",
		CohortCode: openCohort.Code,
		Password:   "senha123",
	})
	if err != nil {
		t.Fatalf("falha ao criar aluno para lookup: %v", err)
	}

	if _, err := store.db.ExecContext(
		context.Background(),
		`INSERT INTO enrollments (student_id, cohort_id, role) VALUES (?, ?, 'student')`,
		registered.Student.ID,
		futureCohort.ID,
	); err != nil {
		t.Fatalf("falha ao vincular aluno a segunda turma: %v", err)
	}

	lookup, err := store.LoadStudentAccessLookup(context.Background(), StudentAccessLookupParams{
		Email:    "lookup@example.com",
		Password: "senha123",
	})
	if err != nil {
		t.Fatalf("falha ao carregar turmas do aluno: %v", err)
	}

	if len(lookup.Cohorts) != 2 {
		t.Fatalf("esperava 2 turmas matriculadas, recebeu %d", len(lookup.Cohorts))
	}

	cohortsByCode := map[string]StudentCohortAccess{}
	for _, item := range lookup.Cohorts {
		cohortsByCode[item.Cohort.Code] = item
	}

	if !cohortsByCode["turma-aberta"].AccessOpen {
		t.Fatal("esperava turma-aberta com acesso liberado")
	}

	if cohortsByCode["turma-futura"].AccessStatus != "upcoming" {
		t.Fatalf(
			"esperava turma-futura com status upcoming, recebeu %s",
			cohortsByCode["turma-futura"].AccessStatus,
		)
	}
}

func TestAuthenticateStudentBlocksClosedWindow(t *testing.T) {
	t.Parallel()

	store, err := NewSQLiteStore(filepath.Join(t.TempDir(), "kubeclass.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite store: %v", err)
	}

	cohort, err := store.CreateCohort(context.Background(), CreateCohortParams{
		Code:           "turma-bloqueada",
		Title:          "Turma Bloqueada",
		AccessStartsAt: "2999-04-09",
		AccessEndsAt:   "2999-04-25",
	})
	if err != nil {
		t.Fatalf("falha ao criar turma bloqueada: %v", err)
	}

	if _, err := store.CreateStudent(context.Background(), CreateStudentParams{
		Name:       "Aluno Bloqueado",
		Email:      "bloqueado@example.com",
		CohortCode: cohort.Code,
		Password:   "senha123",
	}); err != nil {
		t.Fatalf("falha ao criar aluno bloqueado: %v", err)
	}

	_, _, err = store.AuthenticateStudent(context.Background(), StudentLoginParams{
		Email:      "bloqueado@example.com",
		Password:   "senha123",
		CohortCode: cohort.Code,
	})

	var accessErr *CohortAccessError
	if !errors.As(err, &accessErr) {
		t.Fatalf("esperava erro de janela de acesso, recebeu %v", err)
	}
}
