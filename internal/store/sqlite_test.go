package store

import (
	"context"
	"encoding/json"
	"errors"
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

	for i := 0; i < SubmissionLimitPerLab; i++ {
		score := 60 + i
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
	}); !errors.Is(err, ErrSubmissionLimitReached) {
		t.Fatalf("esperava erro de limite de submissao, recebeu: %v", err)
	}

	reloaded, err := store.LoadDashboard(context.Background(), dashboard.Student.ID)
	if err != nil {
		t.Fatalf("falha ao recarregar dashboard: %v", err)
	}

	dashboardWorkspace, found := reloaded.Workspaces["lab-1"]
	if !found {
		t.Fatal("esperava workspace lab-1 no dashboard")
	}

	if dashboardWorkspace.SubmissionCount != SubmissionLimitPerLab {
		t.Fatalf("esperava %d tentativas no dashboard, recebeu %d", SubmissionLimitPerLab, dashboardWorkspace.SubmissionCount)
	}

	var bestValidation struct {
		Score int `json:"score"`
	}
	if err := json.Unmarshal(dashboardWorkspace.Validation, &bestValidation); err != nil {
		t.Fatalf("falha ao ler melhor validacao do dashboard: %v", err)
	}

	expectedBestScore := 60 + SubmissionLimitPerLab - 1
	if bestValidation.Score != expectedBestScore {
		t.Fatalf("esperava melhor validacao %d no dashboard, recebeu %d", expectedBestScore, bestValidation.Score)
	}

	adminDetail, err := store.LoadAdminStudentDetail(context.Background(), dashboard.Student.ID, "turma-a")
	if err != nil {
		t.Fatalf("falha ao carregar detail admin: %v", err)
	}

	if len(adminDetail.Workspaces) == 0 {
		t.Fatal("esperava pelo menos um workspace no admin detail")
	}

	workspace := adminDetail.Workspaces[0]
	if workspace.SubmissionCount != SubmissionLimitPerLab {
		t.Fatalf("esperava %d submissoes no status, recebeu %d", SubmissionLimitPerLab, workspace.SubmissionCount)
	}

	if workspace.ValidationScore != expectedBestScore {
		t.Fatalf("esperava melhor score %d, recebeu %d", expectedBestScore, workspace.ValidationScore)
	}
}

func TestSQLiteStoreLoadAdminStudentDetailKeepsCompletedTasksPerLab(t *testing.T) {
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

	lab1Validation, err := json.Marshal(map[string]any{"labId": "lab-1", "score": 100, "allPassed": true})
	if err != nil {
		t.Fatalf("falha ao criar validacao do lab-1: %v", err)
	}

	lab2Validation, err := json.Marshal(map[string]any{"labId": "lab-2", "score": 80, "allPassed": false})
	if err != nil {
		t.Fatalf("falha ao criar validacao do lab-2: %v", err)
	}

	if err := store.SaveWorkspace(context.Background(), SaveWorkspaceParams{
		StudentID:            dashboard.Student.ID,
		LabID:                "lab-1",
		SessionID:            "encontro-1",
		Solution:             "kind: Pod",
		TerminalLog:          "$ kubectl get pods",
		Validation:           lab1Validation,
		CompletedTaskIndexes: []int{0, 2},
	}); err != nil {
		t.Fatalf("falha ao salvar workspace do lab-1: %v", err)
	}

	if err := store.SaveWorkspace(context.Background(), SaveWorkspaceParams{
		StudentID:            dashboard.Student.ID,
		LabID:                "lab-2",
		SessionID:            "encontro-2",
		Solution:             "kind: Deployment",
		TerminalLog:          "$ kubectl get deploy",
		Validation:           lab2Validation,
		CompletedTaskIndexes: []int{1, 3, 4},
	}); err != nil {
		t.Fatalf("falha ao salvar workspace do lab-2: %v", err)
	}

	adminDetail, err := store.LoadAdminStudentDetail(context.Background(), dashboard.Student.ID, "turma-a")
	if err != nil {
		t.Fatalf("falha ao carregar detail admin: %v", err)
	}

	if adminDetail.Student.CompletedTasks != 5 {
		t.Fatalf("esperava 5 tarefas concluidas no resumo, recebeu %d", adminDetail.Student.CompletedTasks)
	}

	workspacesByLab := make(map[string]AdminLabStatus, len(adminDetail.Workspaces))
	for _, workspace := range adminDetail.Workspaces {
		workspacesByLab[workspace.LabID] = workspace
	}

	if len(workspacesByLab["lab-1"].CompletedTaskIndexes) != 2 {
		t.Fatalf("esperava 2 tarefas concluidas no lab-1, recebeu %d", len(workspacesByLab["lab-1"].CompletedTaskIndexes))
	}

	if len(workspacesByLab["lab-2"].CompletedTaskIndexes) != 3 {
		t.Fatalf("esperava 3 tarefas concluidas no lab-2, recebeu %d", len(workspacesByLab["lab-2"].CompletedTaskIndexes))
	}
}
