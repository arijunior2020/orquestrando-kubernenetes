package store

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
)

const sessionLifetime = 18 * time.Hour

var (
	ErrAuthRequired             = errors.New("autenticacao obrigatoria")
	ErrInvalidCredentials       = errors.New("credenciais invalidas")
	ErrAdminAlreadyBootstrapped = errors.New("admin ja configurado")
)

type AdminAccount struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
}

type SessionPrincipal struct {
	Authenticated bool          `json:"authenticated"`
	Role          string        `json:"role"`
	Admin         *AdminAccount `json:"admin,omitempty"`
	Student       *Student      `json:"student,omitempty"`
	Cohort        *Cohort       `json:"cohort,omitempty"`
}

type StudentLoginParams struct {
	Email      string
	Password   string
	CohortCode string
}

type AdminLoginParams struct {
	Username string
	Password string
}

type CreateStudentParams struct {
	Name       string
	Email      string
	CohortCode string
	Password   string
}

type UpdateStudentParams struct {
	ID         int64
	Name       string
	Email      string
	CohortCode string
	Password   string
}

type RegisteredStudent struct {
	Student Student `json:"student"`
	Cohort  Cohort  `json:"cohort"`
}

func (s *SQLiteStore) AdminSetupRequired(ctx context.Context) (bool, error) {
	var count int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM admins`).Scan(&count); err != nil {
		return false, fmt.Errorf("falha ao verificar bootstrap admin: %w", err)
	}

	return count == 0, nil
}

func (s *SQLiteStore) BootstrapAdmin(ctx context.Context, params AdminLoginParams) (AdminAccount, string, error) {
	setupRequired, err := s.AdminSetupRequired(ctx)
	if err != nil {
		return AdminAccount{}, "", err
	}
	if !setupRequired {
		return AdminAccount{}, "", ErrAdminAlreadyBootstrapped
	}

	username := strings.ToLower(strings.TrimSpace(params.Username))
	password := strings.TrimSpace(params.Password)
	if username == "" || password == "" {
		return AdminAccount{}, "", fmt.Errorf("usuario e senha sao obrigatorios")
	}

	passwordHash, err := hashPassword(password)
	if err != nil {
		return AdminAccount{}, "", fmt.Errorf("falha ao preparar senha do admin: %w", err)
	}

	result, err := s.db.ExecContext(
		ctx,
		`INSERT INTO admins (username, password_hash) VALUES (?, ?)`,
		username,
		passwordHash,
	)
	if err != nil {
		return AdminAccount{}, "", fmt.Errorf("falha ao criar admin: %w", err)
	}

	adminID, err := result.LastInsertId()
	if err != nil {
		return AdminAccount{}, "", fmt.Errorf("falha ao identificar admin criado: %w", err)
	}

	account := AdminAccount{ID: adminID, Username: username}
	token, err := s.createSession(ctx, "admin", adminID, 0, 0)
	if err != nil {
		return AdminAccount{}, "", err
	}

	return account, token, nil
}

func (s *SQLiteStore) AuthenticateAdmin(ctx context.Context, params AdminLoginParams) (AdminAccount, string, error) {
	username := strings.ToLower(strings.TrimSpace(params.Username))
	password := strings.TrimSpace(params.Password)
	if username == "" || password == "" {
		return AdminAccount{}, "", ErrInvalidCredentials
	}

	var (
		account      AdminAccount
		passwordHash string
	)
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT id, username, password_hash FROM admins WHERE username = ?`,
		username,
	).Scan(&account.ID, &account.Username, &passwordHash); err != nil {
		if err == sql.ErrNoRows {
			return AdminAccount{}, "", ErrInvalidCredentials
		}
		return AdminAccount{}, "", fmt.Errorf("falha ao autenticar admin: %w", err)
	}

	if !verifyPassword(passwordHash, password) {
		return AdminAccount{}, "", ErrInvalidCredentials
	}

	token, err := s.createSession(ctx, "admin", account.ID, 0, 0)
	if err != nil {
		return AdminAccount{}, "", err
	}

	return account, token, nil
}

func (s *SQLiteStore) CreateStudent(ctx context.Context, params CreateStudentParams) (RegisteredStudent, error) {
	name := strings.TrimSpace(params.Name)
	email := strings.ToLower(strings.TrimSpace(params.Email))
	cohortCode := strings.ToLower(strings.TrimSpace(params.CohortCode))
	password := strings.TrimSpace(params.Password)

	if name == "" || email == "" || cohortCode == "" || password == "" {
		return RegisteredStudent{}, fmt.Errorf("nome, email, turma e senha sao obrigatorios")
	}

	if len(password) < 6 {
		return RegisteredStudent{}, fmt.Errorf("a senha do aluno deve ter pelo menos 6 caracteres")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return RegisteredStudent{}, fmt.Errorf("falha ao abrir transacao do aluno: %w", err)
	}
	defer tx.Rollback()

	var cohort Cohort
	if err := tx.QueryRowContext(
		ctx,
		`SELECT id, code, title FROM cohorts WHERE code = ?`,
		cohortCode,
	).Scan(&cohort.ID, &cohort.Code, &cohort.Title); err != nil {
		if err == sql.ErrNoRows {
			return RegisteredStudent{}, fmt.Errorf("codigo de turma invalido ou nao cadastrado pelo instrutor")
		}
		return RegisteredStudent{}, fmt.Errorf("falha ao localizar turma do aluno: %w", err)
	}

	var existingID int64
	if err := tx.QueryRowContext(
		ctx,
		`SELECT id FROM students WHERE email = ?`,
		email,
	).Scan(&existingID); err == nil {
		return RegisteredStudent{}, fmt.Errorf("email ja cadastrado; use editar para atualizar este aluno")
	} else if err != sql.ErrNoRows {
		return RegisteredStudent{}, fmt.Errorf("falha ao verificar duplicidade do aluno: %w", err)
	}

	passwordHash, err := hashPassword(password)
	if err != nil {
		return RegisteredStudent{}, fmt.Errorf("falha ao preparar senha do aluno: %w", err)
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO students (name, email, password_hash)
		 VALUES (?, ?, ?)`,
		name,
		email,
		passwordHash,
	); err != nil {
		return RegisteredStudent{}, fmt.Errorf("falha ao salvar aluno: %w", err)
	}

	var student Student
	if err := tx.QueryRowContext(
		ctx,
		`SELECT id, name, email FROM students WHERE email = ?`,
		email,
	).Scan(&student.ID, &student.Name, &student.Email); err != nil {
		return RegisteredStudent{}, fmt.Errorf("falha ao carregar aluno salvo: %w", err)
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT OR IGNORE INTO enrollments (student_id, cohort_id, role) VALUES (?, ?, 'student')`,
		student.ID,
		cohort.ID,
	); err != nil {
		return RegisteredStudent{}, fmt.Errorf("falha ao vincular aluno a turma: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return RegisteredStudent{}, fmt.Errorf("falha ao concluir cadastro de aluno: %w", err)
	}

	return RegisteredStudent{
		Student: student,
		Cohort:  cohort,
	}, nil
}

func (s *SQLiteStore) UpdateStudent(ctx context.Context, params UpdateStudentParams) (RegisteredStudent, error) {
	name := strings.TrimSpace(params.Name)
	email := strings.ToLower(strings.TrimSpace(params.Email))
	cohortCode := strings.ToLower(strings.TrimSpace(params.CohortCode))
	password := strings.TrimSpace(params.Password)

	if params.ID <= 0 || name == "" || email == "" || cohortCode == "" {
		return RegisteredStudent{}, fmt.Errorf("id, nome, email e turma sao obrigatorios")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return RegisteredStudent{}, fmt.Errorf("falha ao abrir transacao de edicao do aluno: %w", err)
	}
	defer tx.Rollback()

	var cohort Cohort
	if err := tx.QueryRowContext(
		ctx,
		`SELECT id, code, title FROM cohorts WHERE code = ?`,
		cohortCode,
	).Scan(&cohort.ID, &cohort.Code, &cohort.Title); err != nil {
		if err == sql.ErrNoRows {
			return RegisteredStudent{}, fmt.Errorf("codigo de turma invalido ou nao cadastrado pelo instrutor")
		}
		return RegisteredStudent{}, fmt.Errorf("falha ao localizar turma do aluno: %w", err)
	}

	var currentID int64
	if err := tx.QueryRowContext(
		ctx,
		`SELECT id FROM students WHERE id = ?`,
		params.ID,
	).Scan(&currentID); err != nil {
		if err == sql.ErrNoRows {
			return RegisteredStudent{}, fmt.Errorf("aluno nao encontrado para edicao")
		}
		return RegisteredStudent{}, fmt.Errorf("falha ao localizar aluno para edicao: %w", err)
	}

	if password != "" && len(password) < 6 {
		return RegisteredStudent{}, fmt.Errorf("a senha do aluno deve ter pelo menos 6 caracteres")
	}

	var (
		updateQuery string
		args        []any
	)
	if password != "" {
		passwordHash, err := hashPassword(password)
		if err != nil {
			return RegisteredStudent{}, fmt.Errorf("falha ao preparar senha do aluno: %w", err)
		}

		updateQuery = `UPDATE students
			SET name = ?, email = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = ?`
		args = []any{name, email, passwordHash, params.ID}
	} else {
		updateQuery = `UPDATE students
			SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = ?`
		args = []any{name, email, params.ID}
	}

	if _, err := tx.ExecContext(ctx, updateQuery, args...); err != nil {
		return RegisteredStudent{}, fmt.Errorf("falha ao atualizar aluno: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM enrollments WHERE student_id = ?`, params.ID); err != nil {
		return RegisteredStudent{}, fmt.Errorf("falha ao atualizar matricula do aluno: %w", err)
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO enrollments (student_id, cohort_id, role) VALUES (?, ?, 'student')`,
		params.ID,
		cohort.ID,
	); err != nil {
		return RegisteredStudent{}, fmt.Errorf("falha ao vincular aluno a nova turma: %w", err)
	}

	var student Student
	if err := tx.QueryRowContext(
		ctx,
		`SELECT id, name, email FROM students WHERE id = ?`,
		params.ID,
	).Scan(&student.ID, &student.Name, &student.Email); err != nil {
		return RegisteredStudent{}, fmt.Errorf("falha ao recarregar aluno atualizado: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return RegisteredStudent{}, fmt.Errorf("falha ao concluir edicao do aluno: %w", err)
	}

	return RegisteredStudent{Student: student, Cohort: cohort}, nil
}

func (s *SQLiteStore) DeleteStudent(ctx context.Context, studentID int64) error {
	if studentID <= 0 {
		return fmt.Errorf("studentId invalido")
	}

	result, err := s.db.ExecContext(ctx, `DELETE FROM students WHERE id = ?`, studentID)
	if err != nil {
		return fmt.Errorf("falha ao excluir aluno: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("falha ao confirmar exclusao do aluno: %w", err)
	}
	if affected == 0 {
		return fmt.Errorf("aluno nao encontrado para exclusao")
	}

	return nil
}

func (s *SQLiteStore) AuthenticateStudent(ctx context.Context, params StudentLoginParams) (Dashboard, string, error) {
	email := strings.ToLower(strings.TrimSpace(params.Email))
	password := strings.TrimSpace(params.Password)
	cohortCode := strings.ToLower(strings.TrimSpace(params.CohortCode))
	if email == "" || password == "" || cohortCode == "" {
		return Dashboard{}, "", ErrInvalidCredentials
	}

	var (
		student      Student
		cohort       Cohort
		passwordHash string
	)
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT
			s.id,
			s.name,
			s.email,
			s.password_hash,
			c.id,
			c.code,
			c.title
		FROM students s
		JOIN enrollments e ON e.student_id = s.id
		JOIN cohorts c ON c.id = e.cohort_id
		WHERE s.email = ? AND c.code = ?
		LIMIT 1`,
		email,
		cohortCode,
	).Scan(
		&student.ID,
		&student.Name,
		&student.Email,
		&passwordHash,
		&cohort.ID,
		&cohort.Code,
		&cohort.Title,
	); err != nil {
		if err == sql.ErrNoRows {
			return Dashboard{}, "", ErrInvalidCredentials
		}
		return Dashboard{}, "", fmt.Errorf("falha ao autenticar aluno: %w", err)
	}

	if passwordHash == "" || !verifyPassword(passwordHash, password) {
		return Dashboard{}, "", ErrInvalidCredentials
	}

	dashboard, err := s.LoadDashboard(ctx, student.ID)
	if err != nil {
		return Dashboard{}, "", err
	}
	dashboard.Cohort = cohort

	token, err := s.createSession(ctx, "student", 0, student.ID, cohort.ID)
	if err != nil {
		return Dashboard{}, "", err
	}

	return dashboard, token, nil
}

func (s *SQLiteStore) ResolveSession(ctx context.Context, rawToken string) (SessionPrincipal, error) {
	tokenHash := hashToken(rawToken)
	if tokenHash == "" {
		return SessionPrincipal{}, ErrAuthRequired
	}

	var (
		role      string
		adminID   sql.NullInt64
		studentID sql.NullInt64
		cohortID  sql.NullInt64
	)

	if err := s.cleanupExpiredSessions(ctx); err != nil {
		return SessionPrincipal{}, fmt.Errorf("falha ao limpar sessoes expiradas: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT role, admin_id, student_id, cohort_id
		 FROM auth_sessions
		 WHERE token_hash = ? AND expires_at > ?
		 LIMIT 1`,
		tokenHash,
		now,
	).Scan(&role, &adminID, &studentID, &cohortID); err != nil {
		if err == sql.ErrNoRows {
			return SessionPrincipal{}, ErrAuthRequired
		}
		return SessionPrincipal{}, fmt.Errorf("falha ao resolver sessao: %w", err)
	}

	_, _ = s.db.ExecContext(
		ctx,
		`UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?`,
		tokenHash,
	)

	principal := SessionPrincipal{
		Authenticated: true,
		Role:          role,
	}

	switch role {
	case "admin":
		admin := &AdminAccount{}
		if err := s.db.QueryRowContext(
			ctx,
			`SELECT id, username FROM admins WHERE id = ?`,
			adminID,
		).Scan(&admin.ID, &admin.Username); err != nil {
			if err == sql.ErrNoRows {
				return SessionPrincipal{}, ErrAuthRequired
			}
			return SessionPrincipal{}, fmt.Errorf("falha ao carregar admin autenticado: %w", err)
		}
		principal.Admin = admin
	case "student":
		student := &Student{}
		cohort := &Cohort{}
		if err := s.db.QueryRowContext(
			ctx,
			`SELECT id, name, email FROM students WHERE id = ?`,
			studentID,
		).Scan(&student.ID, &student.Name, &student.Email); err != nil {
			if err == sql.ErrNoRows {
				return SessionPrincipal{}, ErrAuthRequired
			}
			return SessionPrincipal{}, fmt.Errorf("falha ao carregar aluno autenticado: %w", err)
		}
		if err := s.db.QueryRowContext(
			ctx,
			`SELECT id, code, title FROM cohorts WHERE id = ?`,
			cohortID,
		).Scan(&cohort.ID, &cohort.Code, &cohort.Title); err != nil {
			if err == sql.ErrNoRows {
				return SessionPrincipal{}, ErrAuthRequired
			}
			return SessionPrincipal{}, fmt.Errorf("falha ao carregar turma autenticada: %w", err)
		}
		principal.Student = student
		principal.Cohort = cohort
	default:
		return SessionPrincipal{}, ErrAuthRequired
	}

	return principal, nil
}

func (s *SQLiteStore) DeleteSession(ctx context.Context, rawToken string) error {
	tokenHash := hashToken(rawToken)
	if tokenHash == "" {
		return nil
	}

	if _, err := s.db.ExecContext(ctx, `DELETE FROM auth_sessions WHERE token_hash = ?`, tokenHash); err != nil {
		return fmt.Errorf("falha ao remover sessao: %w", err)
	}

	return nil
}

func (s *SQLiteStore) cleanupExpiredSessions(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx,
		`DELETE FROM auth_sessions WHERE expires_at <= ?`,
		time.Now().UTC().Format(time.RFC3339),
	); err != nil {
		return fmt.Errorf("falha ao limpar sessoes expiradas: %w", err)
	}

	return nil
}

func (s *SQLiteStore) StartSessionCleanup(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 30 * time.Minute
	}

	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				_ = s.cleanupExpiredSessions(ctx)
			}
		}
	}()
}

func (s *SQLiteStore) createSession(ctx context.Context, role string, adminID, studentID, cohortID int64) (string, error) {
	token, err := randomToken(32)
	if err != nil {
		return "", fmt.Errorf("falha ao gerar token de sessao: %w", err)
	}

	expiresAt := time.Now().UTC().Add(sessionLifetime).Format(time.RFC3339)
	var (
		adminRef   any
		studentRef any
		cohortRef  any
	)
	if adminID > 0 {
		adminRef = adminID
	}
	if studentID > 0 {
		studentRef = studentID
	}
	if cohortID > 0 {
		cohortRef = cohortID
	}

	if _, err := s.db.ExecContext(
		ctx,
		`INSERT INTO auth_sessions (token_hash, role, admin_id, student_id, cohort_id, expires_at, last_seen_at)
		 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		hashToken(token),
		role,
		adminRef,
		studentRef,
		cohortRef,
		expiresAt,
	); err != nil {
		return "", fmt.Errorf("falha ao criar sessao autenticada: %w", err)
	}

	return token, nil
}

func hashToken(rawToken string) string {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return ""
	}

	sum := sha256.Sum256([]byte(rawToken))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	const iterations = 120000
	key := pbkdf2SHA256([]byte(password), salt, iterations, 32)
	return fmt.Sprintf(
		"pbkdf2-sha256$%d$%s$%s",
		iterations,
		base64.RawURLEncoding.EncodeToString(salt),
		base64.RawURLEncoding.EncodeToString(key),
	), nil
}

func verifyPassword(encodedHash, password string) bool {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2-sha256" {
		return false
	}

	iterations, err := parseInt(parts[1])
	if err != nil || iterations <= 0 {
		return false
	}

	salt, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}

	expected, err := base64.RawURLEncoding.DecodeString(parts[3])
	if err != nil {
		return false
	}

	actual := pbkdf2SHA256([]byte(password), salt, iterations, len(expected))
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

func pbkdf2SHA256(password, salt []byte, iterations, keyLength int) []byte {
	const hLen = 32
	blocks := (keyLength + hLen - 1) / hLen
	out := make([]byte, 0, blocks*hLen)

	for block := 1; block <= blocks; block++ {
		u := pbkdf2Block(password, salt, block)
		t := append([]byte(nil), u...)
		for index := 1; index < iterations; index++ {
			u = pbkdf2HMAC(password, u)
			for byteIndex := range t {
				t[byteIndex] ^= u[byteIndex]
			}
		}
		out = append(out, t...)
	}

	return out[:keyLength]
}

func pbkdf2Block(password, salt []byte, block int) []byte {
	buffer := make([]byte, len(salt)+4)
	copy(buffer, salt)
	buffer[len(salt)] = byte(block >> 24)
	buffer[len(salt)+1] = byte(block >> 16)
	buffer[len(salt)+2] = byte(block >> 8)
	buffer[len(salt)+3] = byte(block)
	return pbkdf2HMAC(password, buffer)
}

func pbkdf2HMAC(password, data []byte) []byte {
	mac := hmac.New(sha256.New, password)
	mac.Write(data)
	return mac.Sum(nil)
}

func randomToken(size int) (string, error) {
	data := make([]byte, size)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func parseInt(value string) (int, error) {
	var parsed int
	_, err := fmt.Sscanf(value, "%d", &parsed)
	if err != nil {
		return 0, err
	}
	return parsed, nil
}
