package store

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
)

func TestSQLiteStoreUpsertSessionAndLoadDashboard(t *testing.T) {
	t.Parallel()

	store, err := NewSQLiteStore(filepath.Join(t.TempDir(), "kubeclass.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite store: %v", err)
	}

	if _, err := store.CreateCohort(context.Background(), CreateCohortParams{
		Code:  "turma-a",
		Title: "Turma A",
	}); err != nil {
		t.Fatalf("falha ao criar turma: %v", err)
	}

	dashboard, err := store.UpsertSession(context.Background(), SessionUpsertParams{
		Name:       "Aluno Teste",
		Email:      "aluno@example.com",
		CohortCode: "turma-a",
	})
	if err != nil {
		t.Fatalf("falha ao criar sessao do aluno: %v", err)
	}

	if dashboard.Student.ID == 0 {
		t.Fatal("esperava student id valido")
	}

	if dashboard.Cohort.Code != "turma-a" {
		t.Fatalf("esperava turma-a, recebeu %s", dashboard.Cohort.Code)
	}
}

func TestSQLiteStoreSaveWorkspaceAndSubmission(t *testing.T) {
	t.Parallel()

	store, err := NewSQLiteStore(filepath.Join(t.TempDir(), "kubeclass.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite store: %v", err)
	}

	if _, err := store.CreateCohort(context.Background(), CreateCohortParams{
		Code:  "turma-a",
		Title: "Turma A",
	}); err != nil {
		t.Fatalf("falha ao criar turma: %v", err)
	}

	dashboard, err := store.UpsertSession(context.Background(), SessionUpsertParams{
		Name:       "Aluno Teste",
		Email:      "aluno@example.com",
		CohortCode: "turma-a",
	})
	if err != nil {
		t.Fatalf("falha ao criar sessao do aluno: %v", err)
	}

	validationJSON, err := json.Marshal(map[string]any{
		"labId":        "lab-1",
		"score":        100,
		"allPassed":    true,
		"passedChecks": 4,
	})
	if err != nil {
		t.Fatalf("falha ao criar json de validacao: %v", err)
	}

	if err := store.SaveWorkspace(context.Background(), SaveWorkspaceParams{
		StudentID:            dashboard.Student.ID,
		LabID:                "lab-1",
		SessionID:            "encontro-1",
		Solution:             "kind: Pod",
		TerminalLog:          "$ kubectl get pods",
		Validation:           validationJSON,
		CompletedTaskIndexes: []int{0, 2},
	}); err != nil {
		t.Fatalf("falha ao salvar workspace: %v", err)
	}

	if err := store.CreateSubmission(context.Background(), SubmissionParams{
		StudentID:  dashboard.Student.ID,
		LabID:      "lab-1",
		Solution:   "kind: Pod",
		Validation: validationJSON,
		Score:      100,
		AllPassed:  true,
	}); err != nil {
		t.Fatalf("falha ao criar submissao: %v", err)
	}

	reloaded, err := store.LoadDashboard(context.Background(), dashboard.Student.ID)
	if err != nil {
		t.Fatalf("falha ao recarregar dashboard: %v", err)
	}

	if reloaded.SubmissionCount != 1 {
		t.Fatalf("esperava 1 submissao, recebeu %d", reloaded.SubmissionCount)
	}

	workspace, found := reloaded.Workspaces["lab-1"]
	if !found {
		t.Fatal("esperava workspace salvo para lab-1")
	}

	if len(workspace.CompletedTaskIndexes) != 2 {
		t.Fatalf("esperava 2 tarefas concluidas, recebeu %d", len(workspace.CompletedTaskIndexes))
	}
}

func TestSQLiteStoreSubmissionLimitAndBestScore(t *testing.T) {
	t.Parallel()

	store, err := NewSQLiteStore(filepath.Join(t.TempDir(), "kubeclass.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite store: %v", err)
	}

	if _, err := store.CreateCohort(context.Background(), CreateCohortParams{
		Code:  "turma-a",
		Title: "Turma A",
	}); err != nil {
		t.Fatalf("falha ao criar turma: %v", err)
	}

	dashboard, err := store.UpsertSession(context.Background(), SessionUpsertParams{
		Name:       "Aluno Teste",
		Email:      "aluno@example.com",
		CohortCode: "turma-a",
	})
	if err != nil {
		t.Fatalf("falha ao criar sessao do aluno: %v", err)
	}

	validationJSON, err := json.Marshal(map[string]any{"labId": "lab-1", "score": 60, "allPassed": false})
	if err != nil {
		t.Fatalf("falha ao criar json de validacao: %v", err)
	}

	if err := store.SaveWorkspace(context.Background(), SaveWorkspaceParams{
		StudentID:            dashboard.Student.ID,
		LabID:                "lab-1",
		SessionID:            "encontro-1",
		Solution:             "kind: Pod",
		TerminalLog:          "$ kubectl get pods",
		Validation:           validationJSON,
		CompletedTaskIndexes: []int{0},
	}); err != nil {
		t.Fatalf("falha ao salvar workspace: %v", err)
	}

	for i, score := range []int{60, 70, 80} {
		currentValidation, _ := json.Marshal(map[string]any{"labId": "lab-1", "score": score, "allPassed": score == 100})
		if err := store.CreateSubmission(context.Background(), SubmissionParams{
			StudentID:  dashboard.Student.ID,
			LabID:      "lab-1",
			Solution:   "kind: Pod",
			Validation: currentValidation,
			Score:      score,
			AllPassed:  score == 100,
		}); err != nil {
			t.Fatalf("esperava submissao %d bem sucedida, recebeu erro: %v", i+1, err)
		}
	}

	if err := store.CreateSubmission(context.Background(), SubmissionParams{
		StudentID:  dashboard.Student.ID,
		LabID:      "lab-1",
		Solution:   "kind: Pod",
		Validation: validationJSON,
		Score:      90,
		AllPassed:  false,
	}); err == nil {
		t.Fatal("esperava erro ao exceder limite de 3 submissoes", err)
	}

	adminDetail, err := store.LoadAdminStudentDetail(context.Background(), dashboard.Student.ID, "turma-a")
	if err != nil {
		t.Fatalf("falha ao carregar detail admin: %v", err)
	}

	if len(adminDetail.Workspaces) == 0 {
		t.Fatal("esperava pelo menos um workspace no admin detail")
	}

	workspace := adminDetail.Workspaces[0]
	if workspace.SubmissionCount != 3 {
		t.Fatalf("esperava 3 submissoes no status, recebeu %d", workspace.SubmissionCount)
	}

	if workspace.ValidationScore != 80 {
		t.Fatalf("esperava melhor score 80, recebeu %d", workspace.ValidationScore)
	}
}
