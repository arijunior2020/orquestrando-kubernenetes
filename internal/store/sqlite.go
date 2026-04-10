package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

const (
	retiredChallengeLabID = "challenge-final"
	cohortDateLayout      = "2006-01-02"
)

type SQLiteStore struct {
	db *sql.DB
}

type Student struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type Cohort struct {
	ID             int64  `json:"id"`
	Code           string `json:"code"`
	Title          string `json:"title"`
	AccessStartsAt string `json:"accessStartsAt,omitempty"`
	AccessEndsAt   string `json:"accessEndsAt,omitempty"`
}

type Workspace struct {
	LabID                string          `json:"labId"`
	SessionID            string          `json:"sessionId"`
	Solution             string          `json:"solution"`
	TerminalLog          string          `json:"terminalLog"`
	Validation           json.RawMessage `json:"validation"`
	CompletedTaskIndexes []int           `json:"completedTaskIndexes"`
	UpdatedAt            string          `json:"updatedAt"`
	SubmissionCount      int             `json:"submissionCount,omitempty"`
	BestScore            int             `json:"bestScore,omitempty"`
	BestAllPassed        bool            `json:"bestAllPassed,omitempty"`
}

type Dashboard struct {
	Student         Student              `json:"student"`
	Cohort          Cohort               `json:"cohort"`
	SubmissionCount int                  `json:"submissionCount"`
	ValidatedLabs   int                  `json:"validatedLabs"`
	Workspaces      map[string]Workspace `json:"workspaces"`
}

type SessionUpsertParams struct {
	Name        string
	Email       string
	CohortCode  string
	CohortTitle string
}

type SaveWorkspaceParams struct {
	StudentID            int64
	LabID                string
	SessionID            string
	Solution             string
	TerminalLog          string
	Validation           json.RawMessage
	CompletedTaskIndexes []int
}

type SubmissionParams struct {
	StudentID  int64
	LabID      string
	Solution   string
	Validation json.RawMessage
	Score      int
	AllPassed  bool
}

type SubmissionStatus struct {
	Count          int
	BestScore      int
	BestAllPassed  bool
	BestValidation json.RawMessage
}

const SubmissionLimitPerLab = 20

var ErrSubmissionLimitReached = errors.New(fmt.Sprintf("limite de %d tentativas de entrega atingido", SubmissionLimitPerLab))

type AdminCohortSummary struct {
	ID             int64  `json:"id"`
	Code           string `json:"code"`
	Title          string `json:"title"`
	AccessStartsAt string `json:"accessStartsAt,omitempty"`
	AccessEndsAt   string `json:"accessEndsAt,omitempty"`
	StudentCount   int    `json:"studentCount"`
}

type AdminStudentSummary struct {
	Student         Student  `json:"student"`
	Cohort          Cohort   `json:"cohort"`
	SubmissionCount int      `json:"submissionCount"`
	ValidatedLabs   int      `json:"validatedLabs"`
	CompletedTasks  int      `json:"completedTasks"`
	LastActivity    string   `json:"lastActivity"`
	FinalGrade      *float64 `json:"finalGrade,omitempty"`
	InstructorNotes string   `json:"instructorNotes,omitempty"`
	GradedAt        string   `json:"gradedAt,omitempty"`
}

type AdminOverview struct {
	Cohorts        []AdminCohortSummary  `json:"cohorts"`
	Students       []AdminStudentSummary `json:"students"`
	SelectedCohort *Cohort               `json:"selectedCohort,omitempty"`
}

type AdminLabStatus struct {
	LabID                string `json:"labId"`
	SessionID            string `json:"sessionId"`
	UpdatedAt            string `json:"updatedAt"`
	ValidationScore      int    `json:"validationScore"`
	ValidationPassed     bool   `json:"validationPassed"`
	CompletedTaskIndexes []int  `json:"completedTaskIndexes"`
	SubmissionCount      int    `json:"submissionCount"`
	LastSubmissionAt     string `json:"lastSubmissionAt"`
}

type AdminSubmissionRecord struct {
	LabID     string `json:"labId"`
	Score     int    `json:"score"`
	AllPassed bool   `json:"allPassed"`
	CreatedAt string `json:"createdAt"`
}

type AdminStudentDetail struct {
	Student     AdminStudentSummary     `json:"student"`
	Workspaces  []AdminLabStatus        `json:"workspaces"`
	Submissions []AdminSubmissionRecord `json:"submissions"`
}

type GradeParams struct {
	StudentID       int64
	CohortCode      string
	FinalGrade      float64
	InstructorNotes string
}

type CreateCohortParams struct {
	Code           string
	Title          string
	AccessStartsAt string
	AccessEndsAt   string
}

type UpdateCohortParams struct {
	CurrentCode    string
	Code           string
	Title          string
	AccessStartsAt string
	AccessEndsAt   string
}

func NewSQLiteStore(path string) (*SQLiteStore, error) {
	if strings.TrimSpace(path) == "" {
		path = filepath.Join("data", "kubeclass.db")
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("falha ao preparar diretorio do banco: %w", err)
	}

	db, err := sql.Open("sqlite3", path+"?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("falha ao abrir sqlite: %w", err)
	}

	db.SetMaxOpenConns(1)

	store := &SQLiteStore{db: db}
	if err := store.migrate(); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *SQLiteStore) migrate() error {
	schema := `
CREATE TABLE IF NOT EXISTS cohorts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  access_starts_at TEXT NOT NULL DEFAULT '',
  access_ends_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  cohort_id INTEGER NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, cohort_id)
);

CREATE TABLE IF NOT EXISTS workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lab_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  solution TEXT NOT NULL DEFAULT '',
  terminal_log TEXT NOT NULL DEFAULT '',
  validation_json TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, lab_id)
);

CREATE TABLE IF NOT EXISTS task_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lab_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  task_index INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, lab_id, task_index)
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  cohort_id INTEGER REFERENCES cohorts(id) ON DELETE SET NULL,
  lab_id TEXT NOT NULL,
  solution TEXT NOT NULL,
  validation_json TEXT NOT NULL,
  score INTEGER NOT NULL,
  all_passed INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  cohort_id INTEGER REFERENCES cohorts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`

	if _, err := s.db.Exec(schema); err != nil {
		return fmt.Errorf("falha ao aplicar schema sqlite: %w", err)
	}

	if err := s.ensureStudentColumns(); err != nil {
		return err
	}

	if err := s.ensureCohortColumns(); err != nil {
		return err
	}

	if err := s.ensureEnrollmentColumns(); err != nil {
		return err
	}

	return nil
}

func (s *SQLiteStore) ensureCohortColumns() error {
	columns, err := s.tableColumns("cohorts")
	if err != nil {
		return fmt.Errorf("falha ao listar colunas de cohorts: %w", err)
	}

	definitions := map[string]string{
		"access_starts_at": "ALTER TABLE cohorts ADD COLUMN access_starts_at TEXT NOT NULL DEFAULT ''",
		"access_ends_at":   "ALTER TABLE cohorts ADD COLUMN access_ends_at TEXT NOT NULL DEFAULT ''",
	}

	for column, statement := range definitions {
		if columns[column] {
			continue
		}

		if _, err := s.db.Exec(statement); err != nil {
			return fmt.Errorf("falha ao criar coluna %s em cohorts: %w", column, err)
		}
	}

	return nil
}

func (s *SQLiteStore) ensureStudentColumns() error {
	columns, err := s.tableColumns("students")
	if err != nil {
		return fmt.Errorf("falha ao listar colunas de students: %w", err)
	}

	if columns["password_hash"] {
		return nil
	}

	if _, err := s.db.Exec(`ALTER TABLE students ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''`); err != nil {
		return fmt.Errorf("falha ao criar coluna password_hash em students: %w", err)
	}

	return nil
}

func (s *SQLiteStore) ensureEnrollmentColumns() error {
	columns, err := s.tableColumns("enrollments")
	if err != nil {
		return fmt.Errorf("falha ao listar colunas de enrollments: %w", err)
	}

	definitions := map[string]string{
		"final_grade":      "ALTER TABLE enrollments ADD COLUMN final_grade REAL",
		"instructor_notes": "ALTER TABLE enrollments ADD COLUMN instructor_notes TEXT NOT NULL DEFAULT ''",
		"graded_at":        "ALTER TABLE enrollments ADD COLUMN graded_at TEXT NOT NULL DEFAULT ''",
	}

	for column, statement := range definitions {
		if columns[column] {
			continue
		}

		if _, err := s.db.Exec(statement); err != nil {
			return fmt.Errorf("falha ao criar coluna %s: %w", column, err)
		}
	}

	return nil
}

func (s *SQLiteStore) tableColumns(tableName string) (map[string]bool, error) {
	rows, err := s.db.Query(`PRAGMA table_info(` + tableName + `)`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := map[string]bool{}
	for rows.Next() {
		var (
			cid        int
			name       string
			typ        string
			notNull    int
			defaultVal sql.NullString
			primaryKey int
		)

		if err := rows.Scan(&cid, &name, &typ, &notNull, &defaultVal, &primaryKey); err != nil {
			return nil, err
		}

		columns[name] = true
	}

	return columns, rows.Err()
}

func (s *SQLiteStore) UpsertSession(ctx context.Context, params SessionUpsertParams) (Dashboard, error) {
	name := strings.TrimSpace(params.Name)
	email := strings.ToLower(strings.TrimSpace(params.Email))
	cohortCode := strings.ToLower(strings.TrimSpace(params.CohortCode))

	if name == "" || email == "" || cohortCode == "" {
		return Dashboard{}, fmt.Errorf("nome, email e turma sao obrigatorios")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Dashboard{}, fmt.Errorf("falha ao abrir transacao: %w", err)
	}
	defer tx.Rollback()

	var cohortID int64
	if err := tx.QueryRowContext(ctx, `SELECT id FROM cohorts WHERE code = ?`, cohortCode).Scan(&cohortID); err != nil {
		if err == sql.ErrNoRows {
			return Dashboard{}, fmt.Errorf("codigo de turma invalido ou nao cadastrado pelo instrutor")
		}
		return Dashboard{}, fmt.Errorf("falha ao validar turma: %w", err)
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO students (name, email)
		 VALUES (?, ?)
		 ON CONFLICT(email) DO UPDATE SET name = excluded.name, updated_at = CURRENT_TIMESTAMP`,
		name,
		email,
	); err != nil {
		return Dashboard{}, fmt.Errorf("falha ao garantir aluno: %w", err)
	}

	var studentID int64
	if err := tx.QueryRowContext(ctx, `SELECT id FROM students WHERE email = ?`, email).Scan(&studentID); err != nil {
		return Dashboard{}, fmt.Errorf("falha ao carregar aluno: %w", err)
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT OR IGNORE INTO enrollments (student_id, cohort_id, role) VALUES (?, ?, 'student')`,
		studentID,
		cohortID,
	); err != nil {
		return Dashboard{}, fmt.Errorf("falha ao criar matricula: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Dashboard{}, fmt.Errorf("falha ao concluir sessao: %w", err)
	}

	return s.LoadDashboard(ctx, studentID)
}

func normalizeCohortDate(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}

	parsed, err := time.Parse(cohortDateLayout, trimmed)
	if err != nil {
		return "", fmt.Errorf("use datas no formato AAAA-MM-DD")
	}

	return parsed.Format(cohortDateLayout), nil
}

func normalizeCohortWindow(startsAt, endsAt string) (string, string, error) {
	normalizedStart, err := normalizeCohortDate(startsAt)
	if err != nil {
		return "", "", fmt.Errorf("data inicial invalida: %w", err)
	}

	normalizedEnd, err := normalizeCohortDate(endsAt)
	if err != nil {
		return "", "", fmt.Errorf("data final invalida: %w", err)
	}

	if normalizedStart != "" && normalizedEnd != "" && normalizedEnd < normalizedStart {
		return "", "", fmt.Errorf("a data final da turma deve ser igual ou posterior a data inicial")
	}

	return normalizedStart, normalizedEnd, nil
}

func (s *SQLiteStore) CreateCohort(ctx context.Context, params CreateCohortParams) (Cohort, error) {
	code := strings.ToLower(strings.TrimSpace(params.Code))
	title := strings.TrimSpace(params.Title)
	accessStartsAt, accessEndsAt, err := normalizeCohortWindow(params.AccessStartsAt, params.AccessEndsAt)

	if code == "" || title == "" {
		return Cohort{}, fmt.Errorf("codigo e titulo da turma sao obrigatorios")
	}
	if err != nil {
		return Cohort{}, err
	}

	if _, err := s.db.ExecContext(
		ctx,
		`INSERT INTO cohorts (code, title, access_starts_at, access_ends_at)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(code) DO UPDATE SET
		   title = excluded.title,
		   access_starts_at = excluded.access_starts_at,
		   access_ends_at = excluded.access_ends_at,
		   updated_at = CURRENT_TIMESTAMP`,
		code,
		title,
		accessStartsAt,
		accessEndsAt,
	); err != nil {
		return Cohort{}, fmt.Errorf("falha ao salvar turma: %w", err)
	}

	var cohort Cohort
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT id, code, title, access_starts_at, access_ends_at FROM cohorts WHERE code = ?`,
		code,
	).Scan(&cohort.ID, &cohort.Code, &cohort.Title, &cohort.AccessStartsAt, &cohort.AccessEndsAt); err != nil {
		return Cohort{}, fmt.Errorf("falha ao carregar turma salva: %w", err)
	}

	return cohort, nil
}

func (s *SQLiteStore) UpdateCohort(ctx context.Context, params UpdateCohortParams) (Cohort, error) {
	currentCode := strings.ToLower(strings.TrimSpace(params.CurrentCode))
	code := strings.ToLower(strings.TrimSpace(params.Code))
	title := strings.TrimSpace(params.Title)
	accessStartsAt, accessEndsAt, err := normalizeCohortWindow(params.AccessStartsAt, params.AccessEndsAt)

	if currentCode == "" || code == "" || title == "" {
		return Cohort{}, fmt.Errorf("codigo atual, codigo novo e titulo da turma sao obrigatorios")
	}
	if err != nil {
		return Cohort{}, err
	}

	result, err := s.db.ExecContext(
		ctx,
		`UPDATE cohorts
		 SET code = ?, title = ?, access_starts_at = ?, access_ends_at = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE code = ?`,
		code,
		title,
		accessStartsAt,
		accessEndsAt,
		currentCode,
	)
	if err != nil {
		return Cohort{}, fmt.Errorf("falha ao atualizar turma: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return Cohort{}, fmt.Errorf("falha ao confirmar turma atualizada: %w", err)
	}
	if affected == 0 {
		return Cohort{}, fmt.Errorf("turma nao encontrada para edicao")
	}

	var cohort Cohort
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT id, code, title, access_starts_at, access_ends_at FROM cohorts WHERE code = ?`,
		code,
	).Scan(&cohort.ID, &cohort.Code, &cohort.Title, &cohort.AccessStartsAt, &cohort.AccessEndsAt); err != nil {
		return Cohort{}, fmt.Errorf("falha ao recarregar turma atualizada: %w", err)
	}

	return cohort, nil
}

func (s *SQLiteStore) DeleteCohort(ctx context.Context, code string) error {
	code = strings.ToLower(strings.TrimSpace(code))
	if code == "" {
		return fmt.Errorf("codigo da turma obrigatorio")
	}

	var studentCount int
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*)
		 FROM enrollments
		 WHERE cohort_id = (SELECT id FROM cohorts WHERE code = ?)`,
		code,
	).Scan(&studentCount); err != nil {
		return fmt.Errorf("falha ao verificar alunos da turma: %w", err)
	}

	if studentCount > 0 {
		return fmt.Errorf("remova ou mova os alunos desta turma antes de exclui-la")
	}

	result, err := s.db.ExecContext(ctx, `DELETE FROM cohorts WHERE code = ?`, code)
	if err != nil {
		return fmt.Errorf("falha ao excluir turma: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("falha ao confirmar exclusao da turma: %w", err)
	}
	if affected == 0 {
		return fmt.Errorf("turma nao encontrada para exclusao")
	}

	return nil
}

func (s *SQLiteStore) LoadDashboard(ctx context.Context, studentID int64) (Dashboard, error) {
	if studentID <= 0 {
		return Dashboard{}, fmt.Errorf("studentId invalido")
	}

	var dashboard Dashboard
	row := s.db.QueryRowContext(
		ctx,
		`SELECT
			s.id,
			s.name,
			s.email,
			COALESCE(c.id, 0),
			COALESCE(c.code, ''),
			COALESCE(c.title, ''),
			COALESCE(c.access_starts_at, ''),
			COALESCE(c.access_ends_at, '')
		FROM students s
		LEFT JOIN enrollments e ON e.student_id = s.id
		LEFT JOIN cohorts c ON c.id = e.cohort_id
		WHERE s.id = ?
		ORDER BY e.id DESC
		LIMIT 1`,
		studentID,
	)

	if err := row.Scan(
		&dashboard.Student.ID,
		&dashboard.Student.Name,
		&dashboard.Student.Email,
		&dashboard.Cohort.ID,
		&dashboard.Cohort.Code,
		&dashboard.Cohort.Title,
		&dashboard.Cohort.AccessStartsAt,
		&dashboard.Cohort.AccessEndsAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return Dashboard{}, fmt.Errorf("aluno nao encontrado")
		}
		return Dashboard{}, fmt.Errorf("falha ao carregar dashboard: %w", err)
	}

	workspaces := make(map[string]Workspace)
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT lab_id, session_id, solution, terminal_log, validation_json, updated_at
		 FROM workspaces
		 WHERE student_id = ? AND lab_id <> ?`,
		studentID,
		retiredChallengeLabID,
	)
	if err != nil {
		return Dashboard{}, fmt.Errorf("falha ao listar workspaces: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var workspace Workspace
		var validationJSON string
		if err := rows.Scan(
			&workspace.LabID,
			&workspace.SessionID,
			&workspace.Solution,
			&workspace.TerminalLog,
			&validationJSON,
			&workspace.UpdatedAt,
		); err != nil {
			return Dashboard{}, fmt.Errorf("falha ao ler workspace: %w", err)
		}

		if strings.TrimSpace(validationJSON) != "" {
			workspace.Validation = json.RawMessage(validationJSON)
		}

		workspaces[workspace.LabID] = workspace
	}

	taskRows, err := s.db.QueryContext(
		ctx,
		`SELECT lab_id, task_index
		 FROM task_progress
		 WHERE student_id = ? AND completed = 1 AND lab_id <> ?
		 ORDER BY task_index ASC`,
		studentID,
		retiredChallengeLabID,
	)
	if err != nil {
		return Dashboard{}, fmt.Errorf("falha ao listar progresso de tarefas: %w", err)
	}
	defer taskRows.Close()

	for taskRows.Next() {
		var labID string
		var taskIndex int
		if err := taskRows.Scan(&labID, &taskIndex); err != nil {
			return Dashboard{}, fmt.Errorf("falha ao ler progresso de tarefas: %w", err)
		}

		workspace := workspaces[labID]
		workspace.CompletedTaskIndexes = append(workspace.CompletedTaskIndexes, taskIndex)
		workspaces[labID] = workspace
	}

	validatedLabs := 0
	for labID, workspace := range workspaces {
		status, err := s.LoadSubmissionStatus(ctx, studentID, labID)
		if err != nil {
			return Dashboard{}, fmt.Errorf("falha ao carregar status de submissao do lab %s: %w", labID, err)
		}

		workspace.SubmissionCount = status.Count
		workspace.BestScore = status.BestScore
		workspace.BestAllPassed = status.BestAllPassed
		if len(status.BestValidation) > 0 {
			workspace.Validation = status.BestValidation
		}

		if validationAllPassed(workspace.Validation) || workspace.BestAllPassed {
			validatedLabs++
		}

		workspaces[labID] = workspace
	}

	if err := s.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM submissions WHERE student_id = ? AND lab_id <> ?`,
		studentID,
		retiredChallengeLabID,
	).Scan(&dashboard.SubmissionCount); err != nil {
		return Dashboard{}, fmt.Errorf("falha ao contar submisses: %w", err)
	}

	dashboard.ValidatedLabs = validatedLabs
	dashboard.Workspaces = workspaces
	return dashboard, nil
}

func (s *SQLiteStore) SaveWorkspace(ctx context.Context, params SaveWorkspaceParams) error {
	if params.StudentID <= 0 {
		return fmt.Errorf("studentId invalido")
	}

	if strings.TrimSpace(params.LabID) == "" || strings.TrimSpace(params.SessionID) == "" {
		return fmt.Errorf("labId e sessionId sao obrigatorios")
	}

	validationJSON := ""
	if len(params.Validation) > 0 {
		validationJSON = string(params.Validation)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("falha ao abrir transacao de workspace: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO workspaces (student_id, lab_id, session_id, solution, terminal_log, validation_json, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(student_id, lab_id) DO UPDATE SET
		   session_id = excluded.session_id,
		   solution = excluded.solution,
		   terminal_log = excluded.terminal_log,
		   validation_json = excluded.validation_json,
		   updated_at = CURRENT_TIMESTAMP`,
		params.StudentID,
		params.LabID,
		params.SessionID,
		params.Solution,
		params.TerminalLog,
		validationJSON,
	); err != nil {
		return fmt.Errorf("falha ao salvar workspace: %w", err)
	}

	if _, err := tx.ExecContext(
		ctx,
		`DELETE FROM task_progress WHERE student_id = ? AND lab_id = ?`,
		params.StudentID,
		params.LabID,
	); err != nil {
		return fmt.Errorf("falha ao limpar progresso antigo: %w", err)
	}

	for _, taskIndex := range params.CompletedTaskIndexes {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO task_progress (student_id, lab_id, session_id, task_index, completed, updated_at)
			 VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
			params.StudentID,
			params.LabID,
			params.SessionID,
			taskIndex,
		); err != nil {
			return fmt.Errorf("falha ao salvar tarefa concluida: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("falha ao concluir workspace: %w", err)
	}

	return nil
}

func (s *SQLiteStore) LoadSubmissionStatus(ctx context.Context, studentID int64, labID string) (SubmissionStatus, error) {
	if studentID <= 0 {
		return SubmissionStatus{}, fmt.Errorf("studentId invalido")
	}

	if strings.TrimSpace(labID) == "" {
		return SubmissionStatus{}, fmt.Errorf("labId obrigatorio")
	}

	status := SubmissionStatus{}
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM submissions WHERE student_id = ? AND lab_id = ?`,
		studentID,
		labID,
	).Scan(&status.Count); err != nil {
		return SubmissionStatus{}, fmt.Errorf("falha ao contar submissoes do lab: %w", err)
	}

	var (
		bestValidation string
		anyPassed      int
	)

	err := s.db.QueryRowContext(
		ctx,
		`SELECT score, all_passed, validation_json
		 FROM submissions
		 WHERE student_id = ? AND lab_id = ?
		 ORDER BY score DESC, all_passed DESC, id DESC
		 LIMIT 1`,
		studentID,
		labID,
	).Scan(&status.BestScore, &anyPassed, &bestValidation)
	if err != nil {
		if err == sql.ErrNoRows {
			return status, nil
		}

		return SubmissionStatus{}, fmt.Errorf("falha ao carregar melhor submissao do lab: %w", err)
	}

	status.BestAllPassed = anyPassed == 1
	if strings.TrimSpace(bestValidation) != "" {
		status.BestValidation = json.RawMessage(bestValidation)
	}

	return status, nil
}

func (s *SQLiteStore) CreateSubmission(ctx context.Context, params SubmissionParams) error {
	if params.StudentID <= 0 || strings.TrimSpace(params.LabID) == "" {
		return fmt.Errorf("submissao invalida")
	}

	var count int
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM submissions WHERE student_id = ? AND lab_id = ?`,
		params.StudentID,
		params.LabID,
	).Scan(&count); err != nil {
		return fmt.Errorf("falha ao verificar limite de submissao: %w", err)
	}

	if count >= SubmissionLimitPerLab {
		return ErrSubmissionLimitReached
	}

	var cohortID sql.NullInt64
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT cohort_id FROM enrollments WHERE student_id = ? ORDER BY id DESC LIMIT 1`,
		params.StudentID,
	).Scan(&cohortID); err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("falha ao identificar turma da submissao: %w", err)
	}

	allPassed := 0
	if params.AllPassed {
		allPassed = 1
	}

	if _, err := s.db.ExecContext(
		ctx,
		`INSERT INTO submissions (student_id, cohort_id, lab_id, solution, validation_json, score, all_passed)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		params.StudentID,
		cohortID,
		params.LabID,
		params.Solution,
		string(params.Validation),
		params.Score,
		allPassed,
	); err != nil {
		return fmt.Errorf("falha ao registrar submissao: %w", err)
	}

	return nil
}

func (s *SQLiteStore) LoadAdminOverview(ctx context.Context, cohortCode string) (AdminOverview, error) {
	selectedCode := strings.ToLower(strings.TrimSpace(cohortCode))
	overview := AdminOverview{}

	cohortRows, err := s.db.QueryContext(
		ctx,
		`SELECT c.id, c.code, c.title, c.access_starts_at, c.access_ends_at, COUNT(e.student_id)
		 FROM cohorts c
		 LEFT JOIN enrollments e ON e.cohort_id = c.id
		 GROUP BY c.id, c.code, c.title, c.access_starts_at, c.access_ends_at
		 ORDER BY c.code ASC`,
	)
	if err != nil {
		return overview, fmt.Errorf("falha ao listar turmas: %w", err)
	}
	defer cohortRows.Close()

	for cohortRows.Next() {
		var cohort AdminCohortSummary
		if err := cohortRows.Scan(
			&cohort.ID,
			&cohort.Code,
			&cohort.Title,
			&cohort.AccessStartsAt,
			&cohort.AccessEndsAt,
			&cohort.StudentCount,
		); err != nil {
			return overview, fmt.Errorf("falha ao ler turma: %w", err)
		}
		overview.Cohorts = append(overview.Cohorts, cohort)
		if selectedCode != "" && cohort.Code == selectedCode {
			overview.SelectedCohort = &Cohort{
				ID:             cohort.ID,
				Code:           cohort.Code,
				Title:          cohort.Title,
				AccessStartsAt: cohort.AccessStartsAt,
				AccessEndsAt:   cohort.AccessEndsAt,
			}
		}
	}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT
			s.id,
			s.name,
			s.email,
			c.id,
			c.code,
			c.title,
			COALESCE(c.access_starts_at, ''),
			COALESCE(c.access_ends_at, ''),
			COALESCE(workspace_stats.validated_labs, 0),
			COALESCE(task_stats.completed_tasks, 0),
			COALESCE(submission_stats.submission_count, 0),
			COALESCE(activity_stats.last_activity, ''),
			e.final_grade,
			COALESCE(e.instructor_notes, ''),
			COALESCE(e.graded_at, '')
		FROM enrollments e
		JOIN students s ON s.id = e.student_id
		JOIN cohorts c ON c.id = e.cohort_id
		LEFT JOIN (
			SELECT
				student_id,
				SUM(CASE WHEN validation_json LIKE '%"allPassed":true%' THEN 1 ELSE 0 END) AS validated_labs
			FROM workspaces
			WHERE lab_id <> ?
			GROUP BY student_id
		) workspace_stats ON workspace_stats.student_id = s.id
		LEFT JOIN (
			SELECT student_id, COUNT(*) AS completed_tasks
			FROM task_progress
			WHERE completed = 1 AND lab_id <> ?
			GROUP BY student_id
		) task_stats ON task_stats.student_id = s.id
		LEFT JOIN (
			SELECT student_id, COUNT(*) AS submission_count
			FROM submissions
			WHERE lab_id <> ?
			GROUP BY student_id
		) submission_stats ON submission_stats.student_id = s.id
		LEFT JOIN (
			SELECT
				student_id,
				MAX(activity_at) AS last_activity
			FROM (
				SELECT student_id, updated_at AS activity_at FROM workspaces WHERE lab_id <> ?
				UNION ALL
				SELECT student_id, created_at AS activity_at FROM submissions WHERE lab_id <> ?
			)
			GROUP BY student_id
		) activity_stats ON activity_stats.student_id = s.id
		WHERE (? = '' OR c.code = ?)
		ORDER BY c.code ASC, s.name ASC`,
		retiredChallengeLabID,
		retiredChallengeLabID,
		retiredChallengeLabID,
		retiredChallengeLabID,
		retiredChallengeLabID,
		selectedCode,
		selectedCode,
	)
	if err != nil {
		return overview, fmt.Errorf("falha ao listar alunos: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		summary, err := scanAdminStudentSummary(rows)
		if err != nil {
			return overview, err
		}
		overview.Students = append(overview.Students, summary)
	}

	if err := rows.Err(); err != nil {
		return overview, fmt.Errorf("falha ao iterar alunos: %w", err)
	}

	return overview, nil
}

func (s *SQLiteStore) LoadAdminStudentDetail(ctx context.Context, studentID int64, cohortCode string) (AdminStudentDetail, error) {
	if studentID <= 0 {
		return AdminStudentDetail{}, fmt.Errorf("studentId invalido")
	}

	summary, err := s.loadAdminStudentSummary(ctx, studentID, cohortCode)
	if err != nil {
		return AdminStudentDetail{}, err
	}

	detail := AdminStudentDetail{Student: summary}
	workspacesMap := map[string]int{}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT lab_id, session_id, validation_json, updated_at
		 FROM workspaces
		 WHERE student_id = ? AND lab_id <> ?
		 ORDER BY updated_at DESC`,
		studentID,
		retiredChallengeLabID,
	)
	if err != nil {
		return detail, fmt.Errorf("falha ao listar workspaces do aluno: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			labStatus      AdminLabStatus
			validationJSON string
		)
		if err := rows.Scan(&labStatus.LabID, &labStatus.SessionID, &validationJSON, &labStatus.UpdatedAt); err != nil {
			return detail, fmt.Errorf("falha ao ler workspace do aluno: %w", err)
		}

		if strings.TrimSpace(validationJSON) != "" {
			var validationState struct {
				Score     int  `json:"score"`
				AllPassed bool `json:"allPassed"`
			}
			if err := json.Unmarshal([]byte(validationJSON), &validationState); err == nil {
				labStatus.ValidationScore = validationState.Score
				labStatus.ValidationPassed = validationState.AllPassed
			}
		}

		detail.Workspaces = append(detail.Workspaces, labStatus)
		workspacesMap[labStatus.LabID] = len(detail.Workspaces) - 1
	}

	taskRows, err := s.db.QueryContext(
		ctx,
		`SELECT lab_id, task_index
		 FROM task_progress
		 WHERE student_id = ? AND completed = 1 AND lab_id <> ?
		 ORDER BY task_index ASC`,
		studentID,
		retiredChallengeLabID,
	)
	if err != nil {
		return detail, fmt.Errorf("falha ao listar tarefas do aluno: %w", err)
	}
	defer taskRows.Close()

	for taskRows.Next() {
		var (
			labID     string
			taskIndex int
		)
		if err := taskRows.Scan(&labID, &taskIndex); err != nil {
			return detail, fmt.Errorf("falha ao ler tarefa concluida: %w", err)
		}
		if workspaceIndex, ok := workspacesMap[labID]; ok {
			detail.Workspaces[workspaceIndex].CompletedTaskIndexes = append(
				detail.Workspaces[workspaceIndex].CompletedTaskIndexes,
				taskIndex,
			)
		}
	}

	submissionStats, err := s.db.QueryContext(
		ctx,
		`SELECT lab_id, COUNT(*) AS submission_count, MAX(created_at) AS last_submission_at, MAX(score) AS best_score, MAX(all_passed) AS any_passed
		 FROM submissions
		 WHERE student_id = ? AND lab_id <> ?
		 GROUP BY lab_id`,
		studentID,
		retiredChallengeLabID,
	)
	if err != nil {
		return detail, fmt.Errorf("falha ao listar estatisticas de submissao: %w", err)
	}
	defer submissionStats.Close()

	for submissionStats.Next() {
		var (
			labID            string
			submissionCount  int
			lastSubmissionAt string
			bestScore        int
			anyPassed        int
		)
		if err := submissionStats.Scan(&labID, &submissionCount, &lastSubmissionAt, &bestScore, &anyPassed); err != nil {
			return detail, fmt.Errorf("falha ao ler estatistica de submissao: %w", err)
		}
		if workspaceIndex, ok := workspacesMap[labID]; ok {
			detail.Workspaces[workspaceIndex].SubmissionCount = submissionCount
			detail.Workspaces[workspaceIndex].LastSubmissionAt = lastSubmissionAt
			if bestScore > detail.Workspaces[workspaceIndex].ValidationScore {
				detail.Workspaces[workspaceIndex].ValidationScore = bestScore
			}
			if anyPassed == 1 {
				detail.Workspaces[workspaceIndex].ValidationPassed = true
			}
		}
	}

	submissions, err := s.db.QueryContext(
		ctx,
		`SELECT lab_id, score, all_passed, created_at
		 FROM submissions
		 WHERE student_id = ? AND lab_id <> ?
		 ORDER BY created_at DESC, id DESC`,
		studentID,
		retiredChallengeLabID,
	)
	if err != nil {
		return detail, fmt.Errorf("falha ao listar historico de submissoes: %w", err)
	}
	defer submissions.Close()

	for submissions.Next() {
		var record AdminSubmissionRecord
		var allPassed int
		if err := submissions.Scan(&record.LabID, &record.Score, &allPassed, &record.CreatedAt); err != nil {
			return detail, fmt.Errorf("falha ao ler submissao: %w", err)
		}
		record.AllPassed = allPassed == 1
		detail.Submissions = append(detail.Submissions, record)
	}

	return detail, nil
}

func (s *SQLiteStore) SaveGrade(ctx context.Context, params GradeParams) (AdminStudentDetail, error) {
	if params.StudentID <= 0 {
		return AdminStudentDetail{}, fmt.Errorf("studentId invalido")
	}

	cohortCode := strings.ToLower(strings.TrimSpace(params.CohortCode))
	if cohortCode == "" {
		return AdminStudentDetail{}, fmt.Errorf("cohortCode obrigatorio")
	}

	result, err := s.db.ExecContext(
		ctx,
		`UPDATE enrollments
		 SET final_grade = ?, instructor_notes = ?, graded_at = CURRENT_TIMESTAMP
		 WHERE student_id = ? AND cohort_id = (
		   SELECT id FROM cohorts WHERE code = ?
		 )`,
		params.FinalGrade,
		strings.TrimSpace(params.InstructorNotes),
		params.StudentID,
		cohortCode,
	)
	if err != nil {
		return AdminStudentDetail{}, fmt.Errorf("falha ao salvar nota final: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return AdminStudentDetail{}, fmt.Errorf("falha ao confirmar nota final: %w", err)
	}

	if affected == 0 {
		return AdminStudentDetail{}, fmt.Errorf("matricula do aluno nao encontrada na turma")
	}

	return s.LoadAdminStudentDetail(ctx, params.StudentID, cohortCode)
}

func (s *SQLiteStore) loadAdminStudentSummary(ctx context.Context, studentID int64, cohortCode string) (AdminStudentSummary, error) {
	selectedCode := strings.ToLower(strings.TrimSpace(cohortCode))
	row := s.db.QueryRowContext(
		ctx,
		`SELECT
			s.id,
			s.name,
			s.email,
			c.id,
			c.code,
			c.title,
			COALESCE(c.access_starts_at, ''),
			COALESCE(c.access_ends_at, ''),
			COALESCE(workspace_stats.validated_labs, 0),
			COALESCE(task_stats.completed_tasks, 0),
			COALESCE(submission_stats.submission_count, 0),
			COALESCE(activity_stats.last_activity, ''),
			e.final_grade,
			COALESCE(e.instructor_notes, ''),
			COALESCE(e.graded_at, '')
		FROM enrollments e
		JOIN students s ON s.id = e.student_id
		JOIN cohorts c ON c.id = e.cohort_id
		LEFT JOIN (
			SELECT
				student_id,
				SUM(CASE WHEN validation_json LIKE '%"allPassed":true%' THEN 1 ELSE 0 END) AS validated_labs
			FROM workspaces
			WHERE lab_id <> ?
			GROUP BY student_id
		) workspace_stats ON workspace_stats.student_id = s.id
		LEFT JOIN (
			SELECT student_id, COUNT(*) AS completed_tasks
			FROM task_progress
			WHERE completed = 1 AND lab_id <> ?
			GROUP BY student_id
		) task_stats ON task_stats.student_id = s.id
		LEFT JOIN (
			SELECT student_id, COUNT(*) AS submission_count
			FROM submissions
			WHERE lab_id <> ?
			GROUP BY student_id
		) submission_stats ON submission_stats.student_id = s.id
		LEFT JOIN (
			SELECT
				student_id,
				MAX(activity_at) AS last_activity
			FROM (
				SELECT student_id, updated_at AS activity_at FROM workspaces WHERE lab_id <> ?
				UNION ALL
				SELECT student_id, created_at AS activity_at FROM submissions WHERE lab_id <> ?
			)
			GROUP BY student_id
		) activity_stats ON activity_stats.student_id = s.id
		WHERE s.id = ? AND (? = '' OR c.code = ?)
		ORDER BY e.id DESC
		LIMIT 1`,
		retiredChallengeLabID,
		retiredChallengeLabID,
		retiredChallengeLabID,
		retiredChallengeLabID,
		retiredChallengeLabID,
		studentID,
		selectedCode,
		selectedCode,
	)

	summary, err := scanAdminStudentSummary(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return AdminStudentSummary{}, fmt.Errorf("aluno nao encontrado na visao administrativa")
		}
		return AdminStudentSummary{}, err
	}

	return summary, nil
}

type summaryScanner interface {
	Scan(dest ...any) error
}

func scanAdminStudentSummary(scanner summaryScanner) (AdminStudentSummary, error) {
	var (
		summary         AdminStudentSummary
		finalGrade      sql.NullFloat64
		instructorNotes string
		gradedAt        string
	)

	if err := scanner.Scan(
		&summary.Student.ID,
		&summary.Student.Name,
		&summary.Student.Email,
		&summary.Cohort.ID,
		&summary.Cohort.Code,
		&summary.Cohort.Title,
		&summary.Cohort.AccessStartsAt,
		&summary.Cohort.AccessEndsAt,
		&summary.ValidatedLabs,
		&summary.CompletedTasks,
		&summary.SubmissionCount,
		&summary.LastActivity,
		&finalGrade,
		&instructorNotes,
		&gradedAt,
	); err != nil {
		return AdminStudentSummary{}, err
	}

	if finalGrade.Valid {
		value := finalGrade.Float64
		summary.FinalGrade = &value
	}

	summary.InstructorNotes = instructorNotes
	summary.GradedAt = gradedAt

	return summary, nil
}

func validationAllPassed(payload json.RawMessage) bool {
	if len(payload) == 0 {
		return false
	}

	var state struct {
		AllPassed bool `json:"allPassed"`
	}

	return json.Unmarshal(payload, &state) == nil && state.AllPassed
}
