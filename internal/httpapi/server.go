package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/content"
	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/labruntime"
	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/store"
	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/validation"
)

type Server struct {
	staticDir         string
	fileServer        http.Handler
	courseService     *content.CourseService
	validationService *validation.Service
	store             *store.SQLiteStore
	runtimeService    *labruntime.Service
}

type validationRequest struct {
	LabID                string `json:"labId"`
	Solution             string `json:"solution"`
	StudentID            int64  `json:"studentId"`
	SessionID            string `json:"sessionId"`
	TerminalLog          string `json:"terminalLog"`
	CompletedTaskIndexes []int  `json:"completedTaskIndexes"`
}

type workspaceSaveRequest struct {
	StudentID            int64           `json:"studentId"`
	LabID                string          `json:"labId"`
	SessionID            string          `json:"sessionId"`
	Solution             string          `json:"solution"`
	TerminalLog          string          `json:"terminalLog"`
	Validation           json.RawMessage `json:"validation"`
	CompletedTaskIndexes []int           `json:"completedTaskIndexes"`
}

type validationResponse struct {
	validation.Result
	Persisted bool `json:"persisted,omitempty"`
}

type runtimeOpenRequest struct {
	StudentID int64  `json:"studentId"`
	LabID     string `json:"labId"`
}

type adminGradeRequest struct {
	StudentID       int64   `json:"studentId"`
	CohortCode      string  `json:"cohortCode"`
	FinalGrade      float64 `json:"finalGrade"`
	InstructorNotes string  `json:"instructorNotes"`
}

type adminCreateCohortRequest struct {
	Code  string `json:"code"`
	Title string `json:"title"`
}

type adminUpdateCohortRequest struct {
	CurrentCode string `json:"currentCode"`
	Code        string `json:"code"`
	Title       string `json:"title"`
}

type adminDeleteCohortRequest struct {
	Code string `json:"code"`
}

type adminUpdateStudentRequest struct {
	StudentID  int64  `json:"studentId"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	CohortCode string `json:"cohortCode"`
	Password   string `json:"password"`
}

type adminDeleteStudentRequest struct {
	StudentID int64 `json:"studentId"`
}

func NewServer(
	staticDir string,
	courseService *content.CourseService,
	validationService *validation.Service,
	store *store.SQLiteStore,
	runtimeService *labruntime.Service,
) (*Server, error) {
	info, err := os.Stat(staticDir)
	if err != nil {
		return nil, fmt.Errorf("falha ao acessar diretorio estatico: %w", err)
	}

	if !info.IsDir() {
		return nil, fmt.Errorf("diretorio estatico invalido")
	}

	return &Server{
		staticDir:         staticDir,
		fileServer:        http.FileServer(http.Dir(staticDir)),
		courseService:     courseService,
		validationService: validationService,
		store:             store,
		runtimeService:    runtimeService,
	}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealthz)
	mux.HandleFunc("/api/course", s.handleCourse)
	mux.HandleFunc("/api/auth/status", s.handleAuthStatus)
	mux.HandleFunc("/api/auth/admin/bootstrap", s.handleAdminBootstrap)
	mux.HandleFunc("/api/auth/admin/login", s.handleAdminLogin)
	mux.HandleFunc("/api/auth/student/login", s.handleStudentLogin)
	mux.HandleFunc("/api/auth/logout", s.handleLogout)
	mux.HandleFunc("/api/dashboard", s.handleDashboard)
	mux.HandleFunc("/api/workspaces/save", s.handleWorkspaceSave)
	mux.HandleFunc("/api/validate", s.handleValidate)
	mux.HandleFunc("/api/runtime/open", s.handleRuntimeOpen)
	mux.HandleFunc("/api/terminal/ws", s.handleTerminalWebSocket)
	mux.HandleFunc("/api/admin/overview", s.handleAdminOverview)
	mux.HandleFunc("/api/admin/cohorts", s.handleAdminCohorts)
	mux.HandleFunc("/api/admin/students", s.handleAdminStudents)
	mux.HandleFunc("/api/admin/student", s.handleAdminStudent)
	mux.HandleFunc("/api/admin/grade", s.handleAdminGrade)
	mux.HandleFunc("/admin", s.handleAdminPage)
	mux.HandleFunc("/admin/", s.handleAdminPage)
	mux.HandleFunc("/", s.handleStatic)
	return mux
}

func (s *Server) handleHealthz(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	writeJSON(response, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleCourse(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	response.Header().Set("Content-Type", "application/json; charset=utf-8")
	response.WriteHeader(http.StatusOK)
	_, _ = response.Write(s.courseService.Payload())
}

func (s *Server) handleValidate(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	principal, ok := s.requireStudent(response, request)
	if !ok {
		return
	}

	var payload validationRequest
	if err := decodeJSONBody(response, request, &payload); err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	result, err := s.validationService.Validate(payload.LabID, payload.Solution)
	if err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	validationJSON, err := json.Marshal(result)
	if err != nil {
		writeJSON(response, http.StatusInternalServerError, map[string]string{"error": "falha ao serializar validacao"})
		return
	}

	submissionStatus, err := s.store.LoadSubmissionStatus(request.Context(), principal.Student.ID, payload.LabID)
	if err != nil {
		writeJSON(response, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	persistBestValidation := validationJSON
	if len(submissionStatus.BestValidation) > 0 {
		shouldKeepExistingBest := submissionStatus.BestScore > result.Score ||
			(submissionStatus.BestScore == result.Score && submissionStatus.BestAllPassed && !result.AllPassed)
		if shouldKeepExistingBest {
			persistBestValidation = submissionStatus.BestValidation
		}
	}

	if submissionStatus.Count >= 3 {
		if err := s.store.SaveWorkspace(request.Context(), store.SaveWorkspaceParams{
			StudentID:            principal.Student.ID,
			LabID:                payload.LabID,
			SessionID:            payload.SessionID,
			Solution:             payload.Solution,
			TerminalLog:          payload.TerminalLog,
			Validation:           persistBestValidation,
			CompletedTaskIndexes: payload.CompletedTaskIndexes,
		}); err != nil {
			writeJSON(response, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		message := "limite de 3 tentativas de entrega atingido"
		if submissionStatus.BestScore > 0 {
			message = fmt.Sprintf("%s. Melhor nota registrada: %d%%.", message, submissionStatus.BestScore)
		}
		writeJSON(response, http.StatusForbidden, map[string]string{"error": message})
		return
	}

	if err := s.store.CreateSubmission(request.Context(), store.SubmissionParams{
		StudentID:  principal.Student.ID,
		LabID:      payload.LabID,
		Solution:   payload.Solution,
		Validation: validationJSON,
		Score:      result.Score,
		AllPassed:  result.AllPassed,
	}); err != nil {
		if errors.Is(err, store.ErrSubmissionLimitReached) {
			writeJSON(response, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(response, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if err := s.store.SaveWorkspace(request.Context(), store.SaveWorkspaceParams{
		StudentID:            principal.Student.ID,
		LabID:                payload.LabID,
		SessionID:            payload.SessionID,
		Solution:             payload.Solution,
		TerminalLog:          payload.TerminalLog,
		Validation:           persistBestValidation,
		CompletedTaskIndexes: payload.CompletedTaskIndexes,
	}); err != nil {
		writeJSON(response, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(response, http.StatusOK, validationResponse{
		Result:    result,
		Persisted: true,
	})
}

func (s *Server) handleDashboard(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	principal, ok := s.requireStudent(response, request)
	if !ok {
		return
	}

	dashboard, err := s.store.LoadDashboard(request.Context(), principal.Student.ID)
	if err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(response, http.StatusOK, dashboard)
}

func (s *Server) handleWorkspaceSave(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	principal, ok := s.requireStudent(response, request)
	if !ok {
		return
	}

	var payload workspaceSaveRequest
	if err := decodeJSONBody(response, request, &payload); err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	if err := s.store.SaveWorkspace(request.Context(), store.SaveWorkspaceParams{
		StudentID:            principal.Student.ID,
		LabID:                payload.LabID,
		SessionID:            payload.SessionID,
		Solution:             payload.Solution,
		TerminalLog:          payload.TerminalLog,
		Validation:           payload.Validation,
		CompletedTaskIndexes: payload.CompletedTaskIndexes,
	}); err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	dashboard, err := s.store.LoadDashboard(request.Context(), principal.Student.ID)
	if err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(response, http.StatusOK, dashboard)
}

func (s *Server) handleRuntimeOpen(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	principal, ok := s.requireStudent(response, request)
	if !ok {
		return
	}

	var payload runtimeOpenRequest
	if err := decodeJSONBody(response, request, &payload); err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	if s.runtimeService == nil || !s.runtimeService.Enabled() {
		disabledReason := "runtime real indisponivel"
		if s.runtimeService != nil {
			disabledReason = s.runtimeService.DisabledReason()
		}
		writeJSON(response, http.StatusOK, labruntime.Session{
			Enabled: false,
			LabID:   payload.LabID,
			Note:    disabledReason,
		})
		return
	}

	session, err := s.runtimeService.EnsureLab(
		request.Context(),
		principal.Student.ID,
		principal.Cohort.Code,
		payload.LabID,
	)
	if err != nil {
		writeJSON(response, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(response, http.StatusOK, session)
}

func (s *Server) handleTerminalWebSocket(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	if s.runtimeService == nil || !s.runtimeService.Enabled() {
		disabledReason := "runtime real indisponivel"
		if s.runtimeService != nil {
			disabledReason = s.runtimeService.DisabledReason()
		}
		writeJSON(response, http.StatusServiceUnavailable, map[string]string{"error": disabledReason})
		return
	}

	principal, ok := s.requireStudent(response, request)
	if !ok {
		return
	}

	labID := request.URL.Query().Get("labId")
	if labID == "" {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": "labId obrigatorio"})
		return
	}

	session, err := s.runtimeService.EnsureLab(request.Context(), principal.Student.ID, principal.Cohort.Code, labID)
	if err != nil {
		writeJSON(response, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if err := s.runtimeService.ServeTerminal(response, request, session); err != nil {
		log.Printf("terminal websocket encerrado com erro: %v", err)
	}
}

func (s *Server) handleAdminOverview(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	if _, ok := s.requireAdmin(response, request); !ok {
		return
	}

	overview, err := s.store.LoadAdminOverview(request.Context(), request.URL.Query().Get("cohortCode"))
	if err != nil {
		writeJSON(response, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(response, http.StatusOK, overview)
}

func (s *Server) handleAdminCohorts(response http.ResponseWriter, request *http.Request) {
	if _, ok := s.requireAdmin(response, request); !ok {
		return
	}

	switch request.Method {
	case http.MethodGet:
		overview, err := s.store.LoadAdminOverview(request.Context(), "")
		if err != nil {
			writeJSON(response, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(response, http.StatusOK, overview.Cohorts)
	case http.MethodPost:
		var payload adminCreateCohortRequest
		if err := decodeJSONBody(response, request, &payload); err != nil {
			writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		cohort, err := s.store.CreateCohort(request.Context(), store.CreateCohortParams{
			Code:  payload.Code,
			Title: payload.Title,
		})
		if err != nil {
			writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(response, http.StatusOK, cohort)
	case http.MethodPut:
		var payload adminUpdateCohortRequest
		if err := decodeJSONBody(response, request, &payload); err != nil {
			writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		cohort, err := s.store.UpdateCohort(request.Context(), store.UpdateCohortParams{
			CurrentCode: payload.CurrentCode,
			Code:        payload.Code,
			Title:       payload.Title,
		})
		if err != nil {
			writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(response, http.StatusOK, cohort)
	case http.MethodDelete:
		var payload adminDeleteCohortRequest
		if err := decodeJSONBody(response, request, &payload); err != nil {
			writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		if err := s.store.DeleteCohort(request.Context(), payload.Code); err != nil {
			writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(response, http.StatusOK, map[string]string{"status": "ok"})
	default:
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
	}
}

func (s *Server) handleAdminStudent(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	if _, ok := s.requireAdmin(response, request); !ok {
		return
	}

	studentID, err := strconv.ParseInt(request.URL.Query().Get("studentId"), 10, 64)
	if err != nil || studentID <= 0 {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": "studentId invalido"})
		return
	}

	detail, err := s.store.LoadAdminStudentDetail(
		request.Context(),
		studentID,
		request.URL.Query().Get("cohortCode"),
	)
	if err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(response, http.StatusOK, detail)
}

func (s *Server) handleAdminGrade(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	if _, ok := s.requireAdmin(response, request); !ok {
		return
	}

	var payload adminGradeRequest
	if err := decodeJSONBody(response, request, &payload); err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	detail, err := s.store.SaveGrade(request.Context(), store.GradeParams{
		StudentID:       payload.StudentID,
		CohortCode:      payload.CohortCode,
		FinalGrade:      payload.FinalGrade,
		InstructorNotes: payload.InstructorNotes,
	})
	if err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(response, http.StatusOK, detail)
}

func (s *Server) handleAdminPage(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	http.ServeFile(response, request, filepath.Join(s.staticDir, "admin.html"))
}

func (s *Server) handleStatic(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	if request.URL.Path == "/" {
		http.ServeFile(response, request, filepath.Join(s.staticDir, "index.html"))
		return
	}

	if s.fileExists(request.URL.Path) {
		s.fileServer.ServeHTTP(response, request)
		return
	}

	http.ServeFile(response, request, filepath.Join(s.staticDir, "index.html"))
}

func (s *Server) fileExists(requestPath string) bool {
	cleanPath := filepath.Clean(requestPath)
	if cleanPath == "." || cleanPath == "/" {
		return true
	}

	target := filepath.Join(s.staticDir, cleanPath)
	rel, err := filepath.Rel(s.staticDir, target)
	if err != nil {
		return false
	}

	if rel == ".." || bytes.HasPrefix([]byte(rel), []byte(".."+string(filepath.Separator))) {
		return false
	}

	info, err := os.Stat(target)
	if err != nil {
		return false
	}

	return !info.IsDir()
}

func writeJSON(response http.ResponseWriter, statusCode int, payload any) {
	response.Header().Set("Content-Type", "application/json; charset=utf-8")
	response.WriteHeader(statusCode)
	_ = json.NewEncoder(response).Encode(payload)
}

func decodeJSONBody(response http.ResponseWriter, request *http.Request, target any) error {
	request.Body = http.MaxBytesReader(response, request.Body, 1_000_000)
	defer request.Body.Close()

	body, err := io.ReadAll(request.Body)
	if err != nil {
		if errors.Is(err, http.ErrBodyReadAfterClose) || strings.Contains(err.Error(), "http: request body too large") {
			return fmt.Errorf("requisicao muito grande")
		}
		return fmt.Errorf("falha ao ler requisicao")
	}

	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("json invalido: %v", err)
	}

	return nil
}
