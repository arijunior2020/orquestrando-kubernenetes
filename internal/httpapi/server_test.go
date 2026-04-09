package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/content"
	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/labruntime"
	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/store"
	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/validation"
)

type stubRuntimeService struct {
	enabled                   bool
	deleteStudentNamespacesFn func(ctx context.Context, studentID int64) error
}

func (s *stubRuntimeService) Enabled() bool {
	return s.enabled
}

func (s *stubRuntimeService) DisabledReason() string {
	return ""
}

func (s *stubRuntimeService) EnsureLab(ctx context.Context, studentID int64, cohortCode, labID string) (labruntime.Session, error) {
	return labruntime.Session{}, nil
}

func (s *stubRuntimeService) ServeTerminal(response http.ResponseWriter, request *http.Request, session labruntime.Session) error {
	return nil
}

func (s *stubRuntimeService) DeleteStudentNamespaces(ctx context.Context, studentID int64) error {
	if s.deleteStudentNamespacesFn == nil {
		return nil
	}

	return s.deleteStudentNamespacesFn(ctx, studentID)
}

func TestCourseEndpointReturnsPayload(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	request := httptest.NewRequest(http.MethodGet, "/api/course", nil)
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("esperava status 200, recebeu %d", response.Code)
	}

	if !json.Valid(response.Body.Bytes()) {
		t.Fatal("esperava um JSON valido em /api/course")
	}
}

func TestStudentLoginEndpointReturnsDashboard(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	createTestCohort(t, server, "turma-a", "Turma A")
	createTestStudent(t, server, "Aluno", "aluno@example.com", "turma-a", fixturePassword("student"))

	body := mustJSON(t, map[string]string{
		"email":      "aluno@example.com",
		"password":   fixturePassword("student"),
		"cohortCode": "turma-a",
	})
	request := httptest.NewRequest(http.MethodPost, "/api/auth/student/login", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("esperava status 200, recebeu %d", response.Code)
	}

	var dashboard map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &dashboard); err != nil {
		t.Fatalf("dashboard invalido: %v", err)
	}

	student, ok := dashboard["student"].(map[string]any)
	if !ok || student["email"].(string) != "aluno@example.com" {
		t.Fatal("esperava aluno retornado no dashboard")
	}

	cookies := response.Result().Cookies()
	if len(cookies) == 0 || cookies[0].Name != authCookieName {
		t.Fatal("esperava cookie de autenticacao do aluno")
	}
}

func TestStudentLoginEndpointRejectsInvalidCredentials(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	createTestCohort(t, server, "turma-a", "Turma A")
	createTestStudent(t, server, "Aluno", "aluno@example.com", "turma-a", fixturePassword("student"))

	body := mustJSON(t, map[string]string{
		"email":      "aluno@example.com",
		"password":   fixturePassword("invalid"),
		"cohortCode": "turma-a",
	})
	request := httptest.NewRequest(http.MethodPost, "/api/auth/student/login", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("esperava status 401, recebeu %d", response.Code)
	}
}

func TestStudentRegisterEndpointCreatesStudent(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	createTestCohort(t, server, "turma-cadastro", "Turma Cadastro")

	body := mustJSON(t, map[string]string{
		"name":       "Maria Oliveira",
		"email":      "maria@example.com",
		"cohortCode": "turma-cadastro",
		"password":   fixturePassword("student"),
	})
	request := httptest.NewRequest(http.MethodPost, "/api/auth/student/register", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("esperava status 201 ao cadastrar aluno, recebeu %d", response.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("resposta invalida: %v", err)
	}

	student := payload["student"].(map[string]any)
	cohort := payload["cohort"].(map[string]any)
	if student["email"].(string) != "maria@example.com" {
		t.Fatal("esperava aluno cadastrado na resposta")
	}
	if cohort["code"].(string) != "turma-cadastro" {
		t.Fatal("esperava turma associada na resposta do cadastro")
	}

	loginBody := mustJSON(t, map[string]string{
		"email":      "maria@example.com",
		"password":   fixturePassword("student"),
		"cohortCode": "turma-cadastro",
	})
	loginRequest := httptest.NewRequest(http.MethodPost, "/api/auth/student/login", bytes.NewReader(loginBody))
	loginRequest.Header.Set("Content-Type", "application/json")
	loginResponse := httptest.NewRecorder()

	server.Handler().ServeHTTP(loginResponse, loginRequest)

	if loginResponse.Code != http.StatusOK {
		t.Fatalf("esperava status 200 ao autenticar aluno recém-cadastrado, recebeu %d", loginResponse.Code)
	}
}

func TestStudentRegisterPageReturnsRegisterScreen(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	request := httptest.NewRequest(http.MethodGet, "/cadastro", nil)
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("esperava status 200 em /cadastro, recebeu %d", response.Code)
	}

	if !bytes.Contains(response.Body.Bytes(), []byte(`id="register-form"`)) {
		t.Fatal("esperava a tela de cadastro do aluno em /cadastro")
	}
}

func TestStudentAccessEndpointReturnsEnrolledCohorts(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	if _, err := server.store.CreateCohort(context.Background(), store.CreateCohortParams{
		Code:           "turma-futura",
		Title:          "Turma Futura",
		AccessStartsAt: "2999-04-09",
		AccessEndsAt:   "2999-04-25",
	}); err != nil {
		t.Fatalf("falha ao criar turma com janela: %v", err)
	}
	createTestStudent(t, server, "Aluno Futuro", "futuro@example.com", "turma-futura", fixturePassword("student"))

	body := mustJSON(t, map[string]string{
		"email":    "futuro@example.com",
		"password": fixturePassword("student"),
	})
	request := httptest.NewRequest(http.MethodPost, "/api/auth/student/access", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("esperava status 200 ao listar turmas do aluno, recebeu %d", response.Code)
	}

	var payload struct {
		Student store.Student `json:"student"`
		Cohorts []struct {
			AccessOpen   bool   `json:"accessOpen"`
			AccessStatus string `json:"accessStatus"`
			Cohort       struct {
				Code           string `json:"code"`
				AccessStartsAt string `json:"accessStartsAt"`
				AccessEndsAt   string `json:"accessEndsAt"`
			} `json:"cohort"`
		} `json:"cohorts"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("payload invalido: %v", err)
	}

	if payload.Student.Email != "futuro@example.com" {
		t.Fatal("esperava o aluno retornado no lookup de turmas")
	}

	if len(payload.Cohorts) != 1 {
		t.Fatalf("esperava 1 turma matriculada, recebeu %d", len(payload.Cohorts))
	}

	if payload.Cohorts[0].AccessOpen {
		t.Fatal("esperava turma futura bloqueada para acesso")
	}

	if payload.Cohorts[0].AccessStatus != "upcoming" {
		t.Fatalf("esperava status upcoming, recebeu %s", payload.Cohorts[0].AccessStatus)
	}
}

func TestStudentLoginEndpointRejectsCohortBeforeStartDate(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	if _, err := server.store.CreateCohort(context.Background(), store.CreateCohortParams{
		Code:           "turma-bloqueada",
		Title:          "Turma Bloqueada",
		AccessStartsAt: "2999-04-09",
		AccessEndsAt:   "2999-04-25",
	}); err != nil {
		t.Fatalf("falha ao criar turma com janela: %v", err)
	}
	createTestStudent(t, server, "Aluno Bloqueado", "bloqueado@example.com", "turma-bloqueada", fixturePassword("student"))

	body := mustJSON(t, map[string]string{
		"email":      "bloqueado@example.com",
		"password":   fixturePassword("student"),
		"cohortCode": "turma-bloqueada",
	})
	request := httptest.NewRequest(http.MethodPost, "/api/auth/student/login", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("esperava status 403 para turma fora da janela, recebeu %d", response.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("payload de erro invalido: %v", err)
	}

	errorMessage, _ := payload["error"].(string)
	if errorMessage == "" || !bytes.Contains([]byte(errorMessage), []byte("09/04/2999")) {
		t.Fatalf("esperava mensagem com a data de inicio da turma, recebeu %q", errorMessage)
	}
}

func TestValidateEndpointReturnsChecks(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	createTestCohort(t, server, "turma-lab", "Turma Lab")
	cookie := authenticateStudent(t, server, "Aluno", "aluno@example.com", "turma-lab", fixturePassword("student"))

	body := []byte(`{"labId":"lab-1","sessionId":"encontro-1","solution":"apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx-yaml\nspec:\n  containers:\n    - name: nginx\n      image: nginx:stable\n      ports:\n        - containerPort: 80"}`)
	request := httptest.NewRequest(http.MethodPost, "/api/validate", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(cookie)
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("esperava status 200, recebeu %d", response.Code)
	}

	var result map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("resposta invalida: %v", err)
	}

	if result["score"].(float64) != 100 {
		t.Fatalf("esperava score 100, recebeu %v", result["score"])
	}
}

func TestValidateEndpointRejectsStarterMistakes(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	createTestCohort(t, server, "turma-lab", "Turma Lab")
	cookie := authenticateStudent(t, server, "Aluno", "aluno@example.com", "turma-lab", fixturePassword("student"))

	body := []byte(`{"labId":"lab-1","sessionId":"encontro-1","solution":"apiVersion: v12\nkind: Pods\nmetadata:\n  name: nginx-yml\nspec:\n  containers:\n    - name: nginx\n      image: ngnix:stable\n      ports:\n        - containerPort: 8080"}`)
	request := httptest.NewRequest(http.MethodPost, "/api/validate", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(cookie)
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("esperava status 200, recebeu %d", response.Code)
	}

	var result map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("resposta invalida: %v", err)
	}

	if result["allPassed"].(bool) {
		t.Fatal("esperava que manifesto com erros nao fosse totalmente validado")
	}

	if result["score"].(float64) >= 100 {
		t.Fatalf("esperava score abaixo de 100, recebeu %v", result["score"])
	}
}

func TestValidateEndpointPreservesBestScoreWhenSubmissionLimitIsReached(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	createTestCohort(t, server, "turma-lab", "Turma Lab")
	cookie := authenticateStudent(t, server, "Aluno", "aluno@example.com", "turma-lab", fixturePassword("student"))

	validBody := []byte(`{"labId":"lab-1","sessionId":"encontro-1","solution":"apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx-yaml\nspec:\n  containers:\n    - name: nginx\n      image: nginx:stable\n      ports:\n        - containerPort: 80"}`)
	invalidBody := []byte(`{"labId":"lab-1","sessionId":"encontro-1","solution":"apiVersion: v12\nkind: Pod\nmetadata:\n  name: nginx-yml\nspec:\n  containers:\n    - name: nginx\n      image: ngnix:stable\n      ports:\n        - containerPort: 8080"}`)

	postValidation := func(body []byte) *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, "/api/validate", bytes.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		request.AddCookie(cookie)
		response := httptest.NewRecorder()
		server.Handler().ServeHTTP(response, request)
		return response
	}

	for attempt, body := range [][]byte{validBody, invalidBody, invalidBody} {
		response := postValidation(body)
		if response.Code != http.StatusOK {
			t.Fatalf("esperava status 200 na tentativa %d, recebeu %d", attempt+1, response.Code)
		}
	}

	limitedResponse := postValidation(invalidBody)
	if limitedResponse.Code != http.StatusForbidden {
		t.Fatalf("esperava status 403 ao exceder limite, recebeu %d", limitedResponse.Code)
	}

	var limitPayload map[string]any
	if err := json.Unmarshal(limitedResponse.Body.Bytes(), &limitPayload); err != nil {
		t.Fatalf("payload de limite invalido: %v", err)
	}

	if got := limitPayload["error"].(string); got == "" {
		t.Fatal("esperava mensagem de limite de tentativas")
	}

	dashboardRequest := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	dashboardRequest.AddCookie(cookie)
	dashboardResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(dashboardResponse, dashboardRequest)

	if dashboardResponse.Code != http.StatusOK {
		t.Fatalf("esperava status 200 ao recarregar dashboard, recebeu %d", dashboardResponse.Code)
	}

	var dashboard struct {
		Workspaces map[string]struct {
			Validation      map[string]any `json:"validation"`
			SubmissionCount int            `json:"submissionCount"`
		} `json:"workspaces"`
	}
	if err := json.Unmarshal(dashboardResponse.Body.Bytes(), &dashboard); err != nil {
		t.Fatalf("dashboard invalido: %v", err)
	}

	workspace, found := dashboard.Workspaces["lab-1"]
	if !found {
		t.Fatal("esperava workspace lab-1 no dashboard")
	}

	if workspace.SubmissionCount != 3 {
		t.Fatalf("esperava 3 submissoes registradas, recebeu %d", workspace.SubmissionCount)
	}

	if workspace.Validation["score"].(float64) != 100 {
		t.Fatalf("esperava manter a melhor nota 100 no dashboard, recebeu %v", workspace.Validation["score"])
	}
}

func TestWorkspaceSaveEndpointPersistsDashboardState(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	createTestCohort(t, server, "turma-a", "Turma A")
	cookie := authenticateStudent(t, server, "Aluno", "aluno@example.com", "turma-a", fixturePassword("student"))

	workspaceBody := []byte(`{
		"labId": "lab-1",
		"sessionId": "encontro-1",
		"solution": "kind: Pod",
		"terminalLog": "$ kubectl get pods",
		"validation": {"score": 100, "allPassed": true},
		"completedTaskIndexes": [0, 1]
	}`)

	request := httptest.NewRequest(http.MethodPost, "/api/workspaces/save", bytes.NewReader(workspaceBody))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(cookie)
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("esperava status 200 ao salvar workspace, recebeu %d", response.Code)
	}

	var dashboard map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &dashboard); err != nil {
		t.Fatalf("dashboard salvo invalido: %v", err)
	}

	workspaces := dashboard["workspaces"].(map[string]any)
	if _, found := workspaces["lab-1"]; !found {
		t.Fatal("esperava workspace persistido para lab-1")
	}
}

func TestRuntimeOpenEndpointReturnsDisabledWhenRuntimeUnavailable(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	createTestCohort(t, server, "turma-runtime", "Turma Runtime")
	cookie := authenticateStudent(t, server, "Aluno", "aluno@example.com", "turma-runtime", fixturePassword("student"))

	body := []byte(`{"labId":"lab-1"}`)
	request := httptest.NewRequest(http.MethodPost, "/api/runtime/open", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(cookie)
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("esperava status 200, recebeu %d", response.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("payload invalido: %v", err)
	}

	if payload["enabled"].(bool) {
		t.Fatal("esperava runtime desabilitado no ambiente de teste")
	}
}

func TestAdminOverviewEndpointReturnsStudents(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	createTestCohort(t, server, "turma-admin", "Turma Admin")
	createTestStudent(t, server, "Instrucao Aluno", "instrucao@example.com", "turma-admin", fixturePassword("student"))
	adminCookie := authenticateAdmin(t, server, "admin", fixturePassword("admin"))

	request := httptest.NewRequest(http.MethodGet, "/api/admin/overview?cohortCode=turma-admin", nil)
	request.AddCookie(adminCookie)
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("esperava status 200 no overview admin, recebeu %d", response.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("overview admin invalido: %v", err)
	}

	students, ok := payload["students"].([]any)
	if !ok || len(students) != 1 {
		t.Fatal("esperava um aluno retornado no overview admin")
	}
}

func TestAdminGradeEndpointPersistsFinalGrade(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	createTestCohort(t, server, "turma-grade", "Turma Grade")
	registered := createTestStudent(t, server, "Aluno Nota", "nota@example.com", "turma-grade", fixturePassword("student"))
	adminCookie := authenticateAdmin(t, server, "admin", fixturePassword("admin"))

	gradeBody := []byte(`{
		"studentId": 1,
		"cohortCode": "turma-grade",
		"finalGrade": 92.5,
		"instructorNotes": "Entrega final consistente."
	}`)
	gradeBody = bytes.ReplaceAll(
		gradeBody,
		[]byte(`"studentId": 1`),
		[]byte(`"studentId": `+strconv.FormatInt(registered.Student.ID, 10)),
	)

	request := httptest.NewRequest(http.MethodPost, "/api/admin/grade", bytes.NewReader(gradeBody))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(adminCookie)
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("esperava status 200 ao salvar nota admin, recebeu %d", response.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("resposta de nota invalida: %v", err)
	}

	studentDetail := payload["student"].(map[string]any)
	if studentDetail["finalGrade"].(float64) != 92.5 {
		t.Fatalf("esperava nota 92.5, recebeu %v", studentDetail["finalGrade"])
	}
}

func TestAdminStudentsEndpointRegistersStudent(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	createTestCohort(t, server, "turma-auth", "Turma Auth")
	adminCookie := authenticateAdmin(t, server, "admin", fixturePassword("admin"))

	body := mustJSON(t, map[string]string{
		"name":       "Maria Oliveira",
		"email":      "maria@example.com",
		"cohortCode": "turma-auth",
		"password":   fixturePassword("student"),
	})
	request := httptest.NewRequest(http.MethodPost, "/api/admin/students", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(adminCookie)
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("esperava status 200 ao cadastrar aluno, recebeu %d", response.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("resposta invalida: %v", err)
	}

	student := payload["student"].(map[string]any)
	if student["email"].(string) != "maria@example.com" {
		t.Fatal("esperava aluno cadastrado na resposta do admin")
	}
}

func TestAdminStudentsEndpointDeletesStudentAndNamespaces(t *testing.T) {
	t.Parallel()

	var deletedStudentID int64
	server := newTestServerWithRuntime(t, &stubRuntimeService{
		enabled: true,
		deleteStudentNamespacesFn: func(ctx context.Context, studentID int64) error {
			deletedStudentID = studentID
			return nil
		},
	})
	createTestCohort(t, server, "turma-auth", "Turma Auth")
	registered := createTestStudent(t, server, "Maria Oliveira", "maria@example.com", "turma-auth", fixturePassword("student"))
	adminCookie := authenticateAdmin(t, server, "admin", fixturePassword("admin"))

	body := mustJSON(t, map[string]int64{
		"studentId": registered.Student.ID,
	})
	request := httptest.NewRequest(http.MethodDelete, "/api/admin/students", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(adminCookie)
	response := httptest.NewRecorder()

	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("esperava status 200 ao excluir aluno, recebeu %d", response.Code)
	}

	if deletedStudentID != registered.Student.ID {
		t.Fatalf("esperava limpar namespaces do aluno %d, recebeu %d", registered.Student.ID, deletedStudentID)
	}

	if err := server.store.DeleteStudent(context.Background(), registered.Student.ID); err == nil {
		t.Fatal("esperava aluno ja excluido do banco")
	} else if !strings.Contains(err.Error(), "nao encontrado") {
		t.Fatalf("erro inesperado ao confirmar exclusao do aluno: %v", err)
	}
}

func newTestServer(t *testing.T) *Server {
	t.Helper()

	return newTestServerWithRuntime(t, nil)
}

func newTestServerWithRuntime(t *testing.T, runtimeSvc runtimeService) *Server {
	t.Helper()

	courseService, err := content.NewCourseService(filepath.Join("..", "..", "content", "course.json"))
	if err != nil {
		t.Fatalf("falha ao criar course service: %v", err)
	}

	validationService, err := validation.NewService(filepath.Join("..", "..", "content", "validators.json"))
	if err != nil {
		t.Fatalf("falha ao criar validation service: %v", err)
	}

	sqliteStore, err := store.NewSQLiteStore(filepath.Join(t.TempDir(), "kubeclass.db"))
	if err != nil {
		t.Fatalf("falha ao criar sqlite store: %v", err)
	}

	server, err := NewServer(filepath.Join("..", "..", "public"), courseService, validationService, sqliteStore, runtimeSvc)
	if err != nil {
		t.Fatalf("falha ao criar server: %v", err)
	}

	return server
}

func createTestCohort(t *testing.T, server *Server, code, title string) {
	t.Helper()

	if _, err := server.store.CreateCohort(context.Background(), store.CreateCohortParams{
		Code:  code,
		Title: title,
	}); err != nil {
		t.Fatalf("falha ao criar turma de teste: %v", err)
	}
}

func createTestStudent(
	t *testing.T,
	server *Server,
	name, email, cohortCode, password string,
) store.RegisteredStudent {
	t.Helper()

	registered, err := server.store.CreateStudent(context.Background(), store.CreateStudentParams{
		Name:       name,
		Email:      email,
		CohortCode: cohortCode,
		Password:   password,
	})
	if err != nil {
		t.Fatalf("falha ao criar aluno de teste: %v", err)
	}

	return registered
}

func authenticateStudent(
	t *testing.T,
	server *Server,
	name, email, cohortCode, password string,
) *http.Cookie {
	t.Helper()

	createTestStudent(t, server, name, email, cohortCode, password)
	_, token, err := server.store.AuthenticateStudent(context.Background(), store.StudentLoginParams{
		Email:      email,
		Password:   password,
		CohortCode: cohortCode,
	})
	if err != nil {
		t.Fatalf("falha ao autenticar aluno de teste: %v", err)
	}

	return &http.Cookie{Name: authCookieName, Value: token}
}

func authenticateAdmin(t *testing.T, server *Server, username, password string) *http.Cookie {
	t.Helper()

	_, token, err := server.store.BootstrapAdmin(context.Background(), store.AdminLoginParams{
		Username: username,
		Password: password,
	})
	if err != nil {
		t.Fatalf("falha ao autenticar admin de teste: %v", err)
	}

	return &http.Cookie{Name: authCookieName, Value: token}
}

func fixturePassword(scope string) string {
	return strings.Join([]string{"fixture", scope, "access"}, "-")
}

func mustJSON(t *testing.T, payload any) []byte {
	t.Helper()

	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("falha ao serializar payload de teste: %v", err)
	}

	return body
}
