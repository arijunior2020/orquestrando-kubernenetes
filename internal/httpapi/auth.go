package httpapi

import (
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/store"
)

const authCookieName = "kubeclass_session"

type authStatusResponse struct {
	Authenticated      bool                `json:"authenticated"`
	Role               string              `json:"role,omitempty"`
	AdminSetupRequired bool                `json:"adminSetupRequired"`
	Admin              *store.AdminAccount `json:"admin,omitempty"`
	Student            *store.Student      `json:"student,omitempty"`
	Cohort             *store.Cohort       `json:"cohort,omitempty"`
}

type studentLoginRequest struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	CohortCode string `json:"cohortCode"`
}

type studentAccessRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type studentRegisterRequest struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	CohortCode string `json:"cohortCode"`
	Password   string `json:"password"`
}

type adminLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type adminStudentRequest struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	CohortCode string `json:"cohortCode"`
	Password   string `json:"password"`
}

func (s *Server) setSessionCookie(response http.ResponseWriter, request *http.Request, token string) {
	secureCookie := request.TLS != nil
	if os.Getenv("APP_FORCE_SECURE_COOKIES") == "true" {
		secureCookie = true
	}

	sameSite := http.SameSiteLaxMode
	if strings.EqualFold(os.Getenv("APP_COOKIE_SAMESITE"), "None") {
		sameSite = http.SameSiteNoneMode
	}

	http.SetCookie(response, &http.Cookie{
		Name:     authCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: sameSite,
		Secure:   secureCookie,
		MaxAge:   int((18 * time.Hour).Seconds()),
	})
}

func (s *Server) clearSessionCookie(response http.ResponseWriter) {
	http.SetCookie(response, &http.Cookie{
		Name:     authCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

func (s *Server) currentPrincipal(request *http.Request) (store.SessionPrincipal, error) {
	cookie, err := request.Cookie(authCookieName)
	if err != nil {
		return store.SessionPrincipal{}, store.ErrAuthRequired
	}

	return s.store.ResolveSession(request.Context(), cookie.Value)
}

func (s *Server) requireStudent(response http.ResponseWriter, request *http.Request) (store.SessionPrincipal, bool) {
	principal, err := s.currentPrincipal(request)
	if err != nil || principal.Role != "student" || principal.Student == nil || principal.Cohort == nil {
		writeJSON(response, http.StatusUnauthorized, map[string]string{"error": "autenticacao do aluno obrigatoria"})
		return store.SessionPrincipal{}, false
	}

	return principal, true
}

func (s *Server) requireAdmin(response http.ResponseWriter, request *http.Request) (store.SessionPrincipal, bool) {
	principal, err := s.currentPrincipal(request)
	if err != nil || principal.Role != "admin" || principal.Admin == nil {
		writeJSON(response, http.StatusUnauthorized, map[string]string{"error": "autenticacao administrativa obrigatoria"})
		return store.SessionPrincipal{}, false
	}

	return principal, true
}

func (s *Server) handleAuthStatus(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	setupRequired, err := s.store.AdminSetupRequired(request.Context())
	if err != nil {
		writeJSON(response, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	status := authStatusResponse{AdminSetupRequired: setupRequired}
	principal, err := s.currentPrincipal(request)
	if err == nil && principal.Authenticated {
		status.Authenticated = true
		status.Role = principal.Role
		status.Admin = principal.Admin
		status.Student = principal.Student
		status.Cohort = principal.Cohort
	}

	writeJSON(response, http.StatusOK, status)
}

func (s *Server) handleAdminBootstrap(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	var payload adminLoginRequest
	if err := decodeJSONBody(response, request, &payload); err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	admin, token, err := s.store.BootstrapAdmin(request.Context(), store.AdminLoginParams{
		Username: payload.Username,
		Password: payload.Password,
	})
	if err != nil {
		statusCode := http.StatusBadRequest
		if errors.Is(err, store.ErrAdminAlreadyBootstrapped) {
			statusCode = http.StatusConflict
		}
		writeJSON(response, statusCode, map[string]string{"error": err.Error()})
		return
	}

	s.setSessionCookie(response, request, token)
	writeJSON(response, http.StatusOK, authStatusResponse{
		Authenticated:      true,
		Role:               "admin",
		AdminSetupRequired: false,
		Admin:              &admin,
	})
}

func (s *Server) handleAdminLogin(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	var payload adminLoginRequest
	if err := decodeJSONBody(response, request, &payload); err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	admin, token, err := s.store.AuthenticateAdmin(request.Context(), store.AdminLoginParams{
		Username: payload.Username,
		Password: payload.Password,
	})
	if err != nil {
		statusCode := http.StatusUnauthorized
		if !errors.Is(err, store.ErrInvalidCredentials) {
			statusCode = http.StatusBadRequest
		}
		writeJSON(response, statusCode, map[string]string{"error": err.Error()})
		return
	}

	s.setSessionCookie(response, request, token)
	writeJSON(response, http.StatusOK, authStatusResponse{
		Authenticated:      true,
		Role:               "admin",
		AdminSetupRequired: false,
		Admin:              &admin,
	})
}

func (s *Server) handleStudentAccess(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	var payload studentAccessRequest
	if err := decodeJSONBody(response, request, &payload); err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	lookup, err := s.store.LoadStudentAccessLookup(request.Context(), store.StudentAccessLookupParams{
		Email:    payload.Email,
		Password: payload.Password,
	})
	if err != nil {
		statusCode := http.StatusUnauthorized
		if !errors.Is(err, store.ErrInvalidCredentials) {
			statusCode = http.StatusBadRequest
		}
		writeJSON(response, statusCode, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(response, http.StatusOK, lookup)
}

func (s *Server) handleStudentLogin(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	var payload studentLoginRequest
	if err := decodeJSONBody(response, request, &payload); err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	dashboard, token, err := s.store.AuthenticateStudent(request.Context(), store.StudentLoginParams{
		Email:      payload.Email,
		Password:   payload.Password,
		CohortCode: payload.CohortCode,
	})
	if err != nil {
		statusCode := http.StatusUnauthorized
		var accessErr *store.CohortAccessError
		if errors.As(err, &accessErr) {
			statusCode = http.StatusForbidden
		} else if !errors.Is(err, store.ErrInvalidCredentials) {
			statusCode = http.StatusBadRequest
		}
		writeJSON(response, statusCode, map[string]string{"error": err.Error()})
		return
	}

	s.setSessionCookie(response, request, token)
	writeJSON(response, http.StatusOK, dashboard)
}

func (s *Server) handleStudentRegister(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	var payload studentRegisterRequest
	if err := decodeJSONBody(response, request, &payload); err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	student, err := s.store.CreateStudent(request.Context(), store.CreateStudentParams{
		Name:       payload.Name,
		Email:      payload.Email,
		CohortCode: payload.CohortCode,
		Password:   payload.Password,
	})
	if err != nil {
		writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(response, http.StatusCreated, student)
}

func (s *Server) handleLogout(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
		return
	}

	if cookie, err := request.Cookie(authCookieName); err == nil {
		_ = s.store.DeleteSession(request.Context(), cookie.Value)
	}

	s.clearSessionCookie(response)
	writeJSON(response, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleAdminStudents(response http.ResponseWriter, request *http.Request) {
	if _, ok := s.requireAdmin(response, request); !ok {
		return
	}

	switch request.Method {
	case http.MethodGet:
		overview, err := s.store.LoadAdminOverview(request.Context(), request.URL.Query().Get("cohortCode"))
		if err != nil {
			writeJSON(response, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(response, http.StatusOK, overview.Students)
	case http.MethodPost:
		var payload adminStudentRequest
		if err := decodeJSONBody(response, request, &payload); err != nil {
			writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		student, err := s.store.CreateStudent(request.Context(), store.CreateStudentParams{
			Name:       payload.Name,
			Email:      payload.Email,
			CohortCode: payload.CohortCode,
			Password:   payload.Password,
		})
		if err != nil {
			writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(response, http.StatusOK, student)
	case http.MethodPut:
		var payload adminUpdateStudentRequest
		if err := decodeJSONBody(response, request, &payload); err != nil {
			writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		student, err := s.store.UpdateStudent(request.Context(), store.UpdateStudentParams{
			ID:         payload.StudentID,
			Name:       payload.Name,
			Email:      payload.Email,
			CohortCode: payload.CohortCode,
			Password:   payload.Password,
		})
		if err != nil {
			writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(response, http.StatusOK, student)
	case http.MethodDelete:
		var payload adminDeleteStudentRequest
		if err := decodeJSONBody(response, request, &payload); err != nil {
			writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		if s.runtimeService != nil && s.runtimeService.Enabled() {
			if err := s.runtimeService.DeleteStudentNamespaces(request.Context(), payload.StudentID); err != nil {
				writeJSON(response, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}

		if err := s.store.DeleteStudent(request.Context(), payload.StudentID); err != nil {
			writeJSON(response, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(response, http.StatusOK, map[string]string{"status": "ok"})
	default:
		writeJSON(response, http.StatusMethodNotAllowed, map[string]string{"error": "metodo nao permitido"})
	}
}
