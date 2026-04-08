const state = {
  course: null,
  overview: null,
  selectedCohortCode: "",
  selectedStudentId: null,
  selectedDetail: null,
  search: "",
  admin: null,
  adminSetupRequired: false,
  routeKey: "overview",
  pagination: {
    cohorts: 1,
    students: 1,
    submissions: 1,
  },
  modal: {
    resolver: null,
    onSubmit: null,
    submitLabel: "Confirmar",
  },
};

const elements = {
  alerts: document.querySelector("#admin-alerts"),
  gateScreen: document.querySelector("#admin-gate-screen"),
  shell: document.querySelector("#admin-shell"),
  nav: document.querySelector("#admin-nav"),
  routeEyebrow: document.querySelector("#admin-route-eyebrow"),
  routeTitle: document.querySelector("#admin-route-title"),
  routeCopy: document.querySelector("#admin-route-copy"),
  gateCopy: document.querySelector("#admin-gate-copy"),
  bootstrapForm: document.querySelector("#admin-bootstrap-form"),
  bootstrapUsername: document.querySelector("#admin-bootstrap-username"),
  bootstrapPassword: document.querySelector("#admin-bootstrap-password"),
  bootstrapConfirm: document.querySelector("#admin-bootstrap-confirm"),
  bootstrapSubmit: document.querySelector("#admin-bootstrap-submit"),
  bootstrapStatus: document.querySelector("#admin-bootstrap-status"),
  loginForm: document.querySelector("#admin-login-form"),
  loginUsername: document.querySelector("#admin-login-username"),
  loginPassword: document.querySelector("#admin-login-password"),
  loginSubmit: document.querySelector("#admin-login-submit"),
  loginStatus: document.querySelector("#admin-login-status"),
  logoutButton: document.querySelector("#admin-logout-button"),
  totalStudents: document.querySelector("#admin-total-students"),
  completeStudents: document.querySelector("#admin-complete-students"),
  averageGrade: document.querySelector("#admin-average-grade"),
  cohortSelect: document.querySelector("#admin-cohort-select"),
  search: document.querySelector("#admin-search"),
  refreshButton: document.querySelector("#admin-refresh-button"),
  status: document.querySelector("#admin-status"),
  cohortForm: document.querySelector("#admin-cohort-form"),
  cohortCode: document.querySelector("#admin-cohort-code"),
  cohortTitle: document.querySelector("#admin-cohort-title"),
  cohortStart: document.querySelector("#admin-cohort-start"),
  cohortEnd: document.querySelector("#admin-cohort-end"),
  cohortSubmit: document.querySelector("#admin-cohort-submit"),
  cohortCancel: document.querySelector("#admin-cohort-cancel"),
  cohortStatus: document.querySelector("#admin-cohort-status"),
  cohortManageList: document.querySelector("#admin-cohort-manage-list"),
  cohortPagination: document.querySelector("#admin-cohort-pagination"),
  overviewCard: document.querySelector("#admin-overview-card"),
  overviewHighlights: document.querySelector("#admin-overview-highlights"),
  selectedCohort: document.querySelector("#admin-selected-cohort"),
  selectedCohortCopy: document.querySelector("#admin-selected-cohort-copy"),
  readyLabel: document.querySelector("#admin-ready-label"),
  readyFill: document.querySelector("#admin-ready-fill"),
  metricStrip: document.querySelector("#admin-metric-strip"),
  managementGrid: document.querySelector("#admin-management-grid"),
  layout: document.querySelector("#admin-layout"),
  studentListCard: document.querySelector("#admin-section-students"),
  studentList: document.querySelector("#admin-student-list"),
  studentPagination: document.querySelector("#admin-student-pagination"),
  detailColumn: document.querySelector("#admin-detail-column"),
  studentDetail: document.querySelector("#admin-student-detail"),
  gradeForm: document.querySelector("#admin-grade-form"),
  gradeInput: document.querySelector("#admin-grade-input"),
  gradeNotes: document.querySelector("#admin-grade-notes"),
  gradeSubmit: document.querySelector("#admin-grade-submit"),
  gradeStatus: document.querySelector("#admin-grade-status"),
  studentForm: document.querySelector("#admin-student-form"),
  studentName: document.querySelector("#admin-student-name"),
  studentEmail: document.querySelector("#admin-student-email"),
  studentCohort: document.querySelector("#admin-student-cohort"),
  studentPassword: document.querySelector("#admin-student-password"),
  studentSubmit: document.querySelector("#admin-student-submit"),
  studentCancel: document.querySelector("#admin-student-cancel"),
  studentStatus: document.querySelector("#admin-student-status"),
  labList: document.querySelector("#admin-lab-list"),
  submissionList: document.querySelector("#admin-submission-list"),
  submissionPagination: document.querySelector("#admin-submission-pagination"),
  modal: document.querySelector("#admin-modal"),
  modalForm: document.querySelector("#admin-modal-form"),
  modalClose: document.querySelector("#admin-modal-close"),
  modalCancel: document.querySelector("#admin-modal-cancel"),
  modalConfirm: document.querySelector("#admin-modal-confirm"),
  modalEyebrow: document.querySelector("#admin-modal-eyebrow"),
  modalTitle: document.querySelector("#admin-modal-title"),
  modalCopy: document.querySelector("#admin-modal-copy"),
  modalBody: document.querySelector("#admin-modal-body"),
  modalStatus: document.querySelector("#admin-modal-status"),
};

const ADMIN_ROUTE_CONFIG = {
  overview: {
    path: "/admin/overview",
    eyebrow: "Resumo",
    title: "Resumo executivo da turma",
    copy: "Acompanhe os indicadores principais, a turma selecionada e o aluno atualmente em destaque sem navegar por múltiplas telas.",
  },
  cohorts: {
    path: "/admin/cohorts",
    eyebrow: "Turmas",
    title: "Cadastrar e ajustar janelas das turmas",
    copy: "Cadastre, revise e remova turmas. Somente códigos registrados aqui serão aceitos no acesso do aluno.",
  },
  students: {
    path: "/admin/students",
    eyebrow: "Alunos",
    title: "Liberar acesso e manter dados dos estudantes",
    copy: "Cadastre novos alunos, abra a lista paginada e use o modal de edição para manter nome, turma e credenciais corretos.",
  },
  grading: {
    path: "/admin/grading",
    eyebrow: "Notas",
    title: "Lancar a nota final com contexto completo",
    copy: "Selecione um aluno, confira a trilha realizada e salve a avaliacao final da disciplina sem perder o contexto.",
  },
  labs: {
    path: "/admin/labs",
    eyebrow: "Labs",
    title: "Inspecionar progresso por unidade",
    copy: "Veja o status de cada laboratorio, os checkpoints validados e o ritmo de execucao por aluno.",
  },
  submissions: {
    path: "/admin/submissions",
    eyebrow: "Evidências",
    title: "Auditar o historico de entregas",
    copy: "Abra uma pagina focada nas submissões para revisar score, horario e consistencia das entregas.",
  },
};

const PAGINATION_SIZE = {
  cohorts: 6,
  students: 8,
  submissions: 8,
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatTimestamp = (value) => {
  if (!value) {
    return "sem atividade registrada";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "sem atividade registrada";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const formatDateOnly = (value) => {
  if (!value) {
    return "sem data definida";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(date);
};

const formatCohortWindow = (cohort) => {
  const start = formatDateOnly(cohort?.accessStartsAt);
  const end = formatDateOnly(cohort?.accessEndsAt);
  return `Acesso: ${start} até ${end}`;
};

const getCohortAccessState = (cohort) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = cohort?.accessStartsAt ? new Date(`${cohort.accessStartsAt}T00:00:00`) : null;
  const end = cohort?.accessEndsAt ? new Date(`${cohort.accessEndsAt}T00:00:00`) : null;

  if (start && !Number.isNaN(start.getTime()) && today < start) {
    return "upcoming";
  }

  if (end && !Number.isNaN(end.getTime()) && today > end) {
    return "closed";
  }

  return "open";
};

const getCohortAccessTone = (status) => {
  if (status === "open") {
    return "success";
  }

  if (status === "upcoming") {
    return "info";
  }

  return "neutral";
};

const getCohortAccessLabel = (status) => {
  if (status === "open") {
    return "Aberta";
  }

  if (status === "upcoming") {
    return "Em breve";
  }

  if (status === "closed") {
    return "Encerrada";
  }

  return "Indisponivel";
};

const formatGrade = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
};

const FEEDBACK_TITLES = {
  muted: "Status",
  info: "Aviso",
  success: "Sucesso",
  warning: "Atencao",
  danger: "Erro",
};

const normalizeErrorMessage = (error, fallback = "Nao foi possivel concluir a operacao agora.") => {
  const rawMessage =
    typeof error === "string" ? error : error?.message ? String(error.message) : fallback;
  const message = rawMessage.trim();

  if (!message) {
    return fallback;
  }

  if (/Cannot read properties of (null|undefined)|reading ['"]/.test(message)) {
    return fallback;
  }

  return message;
};

const renderFeedback = (element, message, tone = "muted", title = FEEDBACK_TITLES[tone] || "Status") => {
  element.className = `status-text ${tone}`;
  element.innerHTML = `
    <strong class="status-title">${escapeHtml(title)}</strong>
    <span class="status-copy">${escapeHtml(message)}</span>
  `;
};

const buildRequiredMessage = (pairs) => {
  const missing = pairs
    .filter(([input]) => !input.value.trim())
    .map(([, label]) => label);

  if (missing.length === 0) {
    return "";
  }

  if (missing.length === 1) {
    return `Preencha o campo ${missing[0]}.`;
  }

  return `Preencha os campos ${missing.slice(0, -1).join(", ")} e ${missing.at(-1)}.`;
};

const normalizeAdminPath = (pathname) => {
  if (!pathname || pathname === "/admin") {
    return "/admin/overview";
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
};

const getRouteKeyFromPath = (pathname) => {
  const normalizedPath = normalizeAdminPath(pathname);
  const entry = Object.entries(ADMIN_ROUTE_CONFIG).find(([, config]) => config.path === normalizedPath);
  return entry?.[0] || "overview";
};

const resetPagination = (key) => {
  state.pagination[key] = 1;
};

const paginateItems = (items, key) => {
  const totalItems = items.length;
  const pageSize = PAGINATION_SIZE[key];
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const nextPage = Math.min(Math.max(state.pagination[key] || 1, 1), totalPages);
  state.pagination[key] = nextPage;

  const startIndex = totalItems === 0 ? 0 : (nextPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return {
    items: items.slice(startIndex, endIndex),
    page: nextPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
  };
};

const renderPagination = (container, key, pagination, label) => {
  if (!container) {
    return;
  }

  if (pagination.totalItems <= 0) {
    container.innerHTML = "";
    return;
  }

  const pages = [];
  for (let page = 1; page <= pagination.totalPages; page += 1) {
    if (
      page === 1 ||
      page === pagination.totalPages ||
      Math.abs(page - pagination.page) <= 1
    ) {
      pages.push(page);
      continue;
    }

    if (pages.at(-1) !== "...") {
      pages.push("...");
    }
  }

  container.innerHTML = `
    <div class="pagination-summary">
      Mostrando ${pagination.startIndex + 1}-${pagination.endIndex} de ${pagination.totalItems} ${label}
    </div>
    <div class="pagination-actions">
      <button
        class="ghost-button button-compact"
        type="button"
        data-pagination-key="${key}"
        data-pagination-page="${pagination.page - 1}"
        ${pagination.page === 1 ? "disabled" : ""}
      >
        Anterior
      </button>
        <div class="pagination-pages">
        ${pages
          .map(
            (page) => `
              ${
                page === "..."
                  ? '<span class="pagination-ellipsis">…</span>'
                  : `
                    <button
                      class="pagination-page ${page === pagination.page ? "active" : ""}"
                      type="button"
                      data-pagination-key="${key}"
                      data-pagination-page="${page}"
                    >
                      ${page}
                    </button>
                  `
              }
            `,
          )
          .join("")}
      </div>
      <button
        class="ghost-button button-compact"
        type="button"
        data-pagination-key="${key}"
        data-pagination-page="${pagination.page + 1}"
        ${pagination.page === pagination.totalPages ? "disabled" : ""}
      >
        Próxima
      </button>
    </div>
  `;
};

const renderAdminNavigation = () => {
  if (!elements.nav) {
    return;
  }

  const links = Array.from(elements.nav.querySelectorAll("[data-admin-route]"));
  links.forEach((link) => {
    link.classList.toggle("active", link.dataset.adminRoute === state.routeKey);
  });
};

const setModalStatus = (message, tone = "muted") => {
  renderFeedback(elements.modalStatus, message, tone);
};

const isAdminModalOpen = () => !elements.modal.hidden;

const setAdminModalVisibility = (visible) => {
  elements.modal.hidden = !visible;
  elements.modal.setAttribute("aria-hidden", visible ? "false" : "true");
  document.body.classList.toggle("modal-open", visible);
};

const closeAdminModal = (result = null) => {
  if (!isAdminModalOpen()) {
    return;
  }

  setAdminModalVisibility(false);
  const resolver = state.modal.resolver;
  state.modal.resolver = null;
  state.modal.onSubmit = null;
  state.modal.submitLabel = "Confirmar";
  elements.modalBody.innerHTML = "";
  elements.modalConfirm.className = "primary-button";
  elements.modalConfirm.disabled = false;
  elements.modalConfirm.textContent = "Confirmar";
  setModalStatus("Revise os dados e confirme para continuar.", "muted");

  if (resolver) {
    resolver(result);
  }
};

const openAdminModal = ({
  eyebrow = "Ação",
  title,
  copy,
  bodyHTML = "",
  confirmLabel = "Confirmar",
  confirmClassName = "primary-button",
  cancelLabel = "Cancelar",
  statusMessage = "Revise os dados e confirme para continuar.",
  statusTone = "muted",
  onSubmit = null,
}) =>
  new Promise((resolve) => {
    state.modal.resolver = resolve;
    state.modal.onSubmit = onSubmit;
    state.modal.submitLabel = confirmLabel;

    elements.modalEyebrow.textContent = eyebrow;
    elements.modalTitle.textContent = title;
    elements.modalCopy.textContent = copy;
    elements.modalBody.innerHTML = bodyHTML;
    elements.modalCancel.textContent = cancelLabel;
    elements.modalConfirm.textContent = confirmLabel;
    elements.modalConfirm.className = confirmClassName;
    setModalStatus(statusMessage, statusTone);

    if (!isAdminModalOpen()) {
      setAdminModalVisibility(true);
    }

    window.requestAnimationFrame(() => {
      const firstField = elements.modal.querySelector("input, textarea, select, button[type='submit']");
      firstField?.focus();
    });
  });

const openConfirmModal = ({ title, copy, confirmLabel, danger = false }) =>
  openAdminModal({
    eyebrow: "Confirmação",
    title,
    copy,
    bodyHTML: '<p class="modal-note">Esta ação altera os dados do ambiente e pode impactar a turma ativa.</p>',
    confirmLabel,
    confirmClassName: danger ? "primary-button danger-button" : "primary-button",
    statusMessage: danger
      ? "Confirme apenas se tiver certeza de que deseja continuar."
      : "Revise a ação antes de confirmar.",
    statusTone: danger ? "warning" : "muted",
  });

const openCohortEditModal = async (cohort) =>
  openAdminModal({
    eyebrow: "Editar turma",
    title: cohort.title,
    copy: "Atualize o código, o título e a janela de acesso da turma. Apenas turmas abertas poderão ser acessadas pelos alunos.",
    bodyHTML: `
      <div class="modal-field-grid">
        <label class="field-group">
          <span>Código da turma</span>
          <input id="modal-cohort-code" type="text" value="${escapeHtml(cohort.code)}" autocomplete="off" />
        </label>
        <label class="field-group">
          <span>Título da turma</span>
          <input id="modal-cohort-title" type="text" value="${escapeHtml(cohort.title)}" autocomplete="off" />
        </label>
        <label class="field-group">
          <span>Início do acesso</span>
          <input id="modal-cohort-start" type="date" value="${escapeHtml(cohort.accessStartsAt || "")}" />
        </label>
        <label class="field-group">
          <span>Fim do acesso</span>
          <input id="modal-cohort-end" type="date" value="${escapeHtml(cohort.accessEndsAt || "")}" />
        </label>
      </div>
    `,
    confirmLabel: "Salvar alterações",
    statusMessage: "Ajuste os dados e confirme para atualizar a turma.",
    onSubmit: async () => {
      const codeInput = elements.modal.querySelector("#modal-cohort-code");
      const titleInput = elements.modal.querySelector("#modal-cohort-title");
      const startInput = elements.modal.querySelector("#modal-cohort-start");
      const endInput = elements.modal.querySelector("#modal-cohort-end");
      const requiredMessage = buildRequiredMessage([
        [codeInput, "codigo da turma"],
        [titleInput, "titulo da turma"],
      ]);

      if (requiredMessage) {
        setModalStatus(requiredMessage, "warning");
        return false;
      }

      const updated = await fetchJSON("/api/admin/cohorts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentCode: cohort.code,
          code: codeInput.value.trim(),
          title: titleInput.value.trim(),
          accessStartsAt: startInput.value,
          accessEndsAt: endInput.value,
        }),
      });

      closeAdminModal(updated);
      return false;
    },
  });

const openStudentEditModal = async (studentSummary) =>
  openAdminModal({
    eyebrow: "Editar aluno",
    title: studentSummary.student.name,
    copy: "Ajuste nome, e-mail, turma e senha. Deixe a senha em branco para manter a atual.",
    bodyHTML: `
      <div class="modal-field-grid">
        <label class="field-group">
          <span>Nome do aluno</span>
          <input id="modal-student-name" type="text" value="${escapeHtml(studentSummary.student.name)}" autocomplete="name" />
        </label>
        <label class="field-group">
          <span>E-mail do aluno</span>
          <input id="modal-student-email" type="email" value="${escapeHtml(studentSummary.student.email)}" autocomplete="email" />
        </label>
        <label class="field-group">
          <span>Código da turma</span>
          <input id="modal-student-cohort" type="text" value="${escapeHtml(studentSummary.cohort.code)}" autocomplete="off" />
        </label>
        <label class="field-group">
          <span>Nova senha</span>
          <input id="modal-student-password" type="password" value="" autocomplete="new-password" placeholder="Opcional para redefinir" />
        </label>
      </div>
    `,
    confirmLabel: "Salvar alterações",
    statusMessage: "Revise os campos do aluno e confirme a atualização.",
    onSubmit: async () => {
      const nameInput = elements.modal.querySelector("#modal-student-name");
      const emailInput = elements.modal.querySelector("#modal-student-email");
      const cohortInput = elements.modal.querySelector("#modal-student-cohort");
      const passwordInput = elements.modal.querySelector("#modal-student-password");

      const requiredMessage = buildRequiredMessage([
        [nameInput, "nome do aluno"],
        [emailInput, "e-mail do aluno"],
        [cohortInput, "codigo da turma"],
      ]);

      if (requiredMessage) {
        setModalStatus(requiredMessage, "warning");
        return false;
      }

      const updated = await fetchJSON("/api/admin/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentSummary.student.id,
          name: nameInput.value.trim(),
          email: emailInput.value.trim(),
          cohortCode: cohortInput.value.trim(),
          password: passwordInput.value,
        }),
      });

      closeAdminModal(updated);
      return false;
    },
  });

const syncContainerVisibility = () => {
  const managementCards = Array.from(elements.managementGrid.querySelectorAll("[data-admin-card]")).filter(
    (card) => !card.hidden,
  );
  elements.managementGrid.hidden = managementCards.length === 0;
  elements.managementGrid.classList.toggle("single-column", managementCards.length <= 1);

  const detailCards = Array.from(elements.detailColumn.querySelectorAll("[data-admin-card]")).filter(
    (card) => !card.hidden,
  );
  elements.detailColumn.hidden = detailCards.length === 0;
  elements.detailColumn.classList.toggle("single-column", detailCards.length <= 1);

  const layoutVisibleChildren = [elements.studentListCard, elements.detailColumn].filter(
    (item) => !item.hidden,
  );
  elements.layout.hidden = layoutVisibleChildren.length === 0;
  elements.layout.classList.toggle("single-column", layoutVisibleChildren.length <= 1);
};

const renderAdminRoute = () => {
  const route = ADMIN_ROUTE_CONFIG[state.routeKey] || ADMIN_ROUTE_CONFIG.overview;
  elements.routeEyebrow.textContent = route.eyebrow;
  elements.routeTitle.textContent = route.title;
  elements.routeCopy.textContent = route.copy;
  document.title = `KubeClass Admin · ${route.title}`;

  const cards = Array.from(document.querySelectorAll("[data-admin-card]"));
  cards.forEach((card) => {
    const routes = (card.dataset.adminCard || "").split(/\s+/).filter(Boolean);
    card.hidden = !routes.includes(state.routeKey);
  });

  syncContainerVisibility();
};

const setAdminRoute = (routeKey, { replace = false } = {}) => {
  const nextRoute = ADMIN_ROUTE_CONFIG[routeKey] ? routeKey : "overview";
  state.routeKey = nextRoute;

  const nextPath = ADMIN_ROUTE_CONFIG[nextRoute].path;
  if (normalizeAdminPath(window.location.pathname) !== nextPath) {
    const method = replace ? "replaceState" : "pushState";
    window.history[method]({}, "", nextPath);
  }

  renderAdminNavigation();
  renderAdminRoute();
};

const setStatus = (message, tone = "muted") => {
  renderFeedback(elements.status, message, tone);
};

const setBootstrapStatus = (message, tone = "muted") => {
  renderFeedback(elements.bootstrapStatus, message, tone);
};

const setLoginStatus = (message, tone = "muted") => {
  renderFeedback(elements.loginStatus, message, tone);
};

const setGradeStatus = (message, tone = "muted") => {
  renderFeedback(elements.gradeStatus, message, tone);
};

const setCohortStatus = (message, tone = "muted") => {
  renderFeedback(elements.cohortStatus, message, tone);
};

const setStudentStatus = (message, tone = "muted") => {
  renderFeedback(elements.studentStatus, message, tone);
};

const resetCohortForm = () => {
  elements.cohortForm.reset();
  elements.cohortSubmit.textContent = "Salvar turma";
  elements.cohortCancel.hidden = true;
};

const resetStudentForm = () => {
  elements.studentForm.reset();
  elements.studentSubmit.textContent = "Salvar aluno";
  elements.studentCancel.hidden = true;
  if (state.selectedCohortCode) {
    elements.studentCohort.value = state.selectedCohortCode;
  }
};

const showToast = (message, tone = "info") => {
  const toast = document.createElement("article");
  toast.className = `toast toast-${tone}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <div class="toast-body">
      <strong>${FEEDBACK_TITLES[tone] || "Aviso"}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;

  elements.alerts.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 240);
  }, 4200);
};

const fetchJSON = async (url, options) => {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Falha ao processar requisicao.");
  }

  return payload;
};

const syncAdminVisibility = () => {
  const isAdminAuthenticated = Boolean(state.admin);
  elements.gateScreen.hidden = isAdminAuthenticated;
  elements.shell.hidden = !isAdminAuthenticated;
  elements.bootstrapForm.hidden = !state.adminSetupRequired || isAdminAuthenticated;
  elements.loginForm.hidden = state.adminSetupRequired || isAdminAuthenticated;
};

const enterAdminMode = (admin) => {
  state.admin = admin;
  state.adminSetupRequired = false;
  syncAdminVisibility();
  setStatus(`Painel liberado para ${admin.username}.`, "success");
};

const leaveAdminMode = (message, tone = "muted") => {
  state.admin = null;
  state.overview = null;
  state.selectedCohortCode = "";
  state.selectedStudentId = null;
  state.selectedDetail = null;
  syncAdminVisibility();
  setLoginStatus(message, tone);
};

const getTotalLabs = () => state.course?.meetings?.length || 0;

const getTotalTasks = () =>
  state.course?.meetings?.reduce((sum, meeting) => sum + meeting.practiceTasks.length, 0) || 0;

const getVisibleStudents = () => {
  const students = state.overview?.students || [];
  const search = state.search.trim().toLowerCase();

  if (!search) {
    return students;
  }

  return students.filter((item) => {
    const haystack = `${item.student.name} ${item.student.email}`.toLowerCase();
    return haystack.includes(search);
  });
};

const getSelectedStudentSummary = () =>
  (state.overview?.students || []).find((item) => item.student.id === state.selectedStudentId) || null;

const buildPartialStudentDetail = (studentSummary) => ({
  student: studentSummary,
  workspaces: [],
  submissions: [],
});

const hasCompletedTrail = (student) =>
  student.validatedLabs >= getTotalLabs() && student.completedTasks >= getTotalTasks();

const getStudentProgressLabel = (student) => {
  if (hasCompletedTrail(student)) {
    return { label: "Pronto para nota", tone: "success" };
  }

  if (student.validatedLabs > 0 || student.completedTasks > 0 || student.submissionCount > 0) {
    return { label: "Em progresso", tone: "draft" };
  }

  return { label: "Nao iniciou", tone: "neutral" };
};

const buildMetricCards = (students) => {
  const completed = students.filter(hasCompletedTrail).length;
  const pendingGrade = students.filter(
    (student) => hasCompletedTrail(student) && student.finalGrade == null,
  ).length;
  const graded = students.filter((student) => student.finalGrade != null);
  const averageSubmissions =
    students.length === 0
      ? 0
      : students.reduce((sum, item) => sum + item.submissionCount, 0) / students.length;

  return [
    {
      label: "Labs completos",
      value: `${completed}/${students.length || 0}`,
      note: "Alunos com labs validados e checklist completo.",
    },
    {
      label: "Pendentes de nota",
      value: String(pendingGrade),
      note: "Alunos prontos para fechamento, mas ainda sem nota final.",
    },
    {
      label: "Notas lancadas",
      value: String(graded.length),
      note: "Quantidade de alunos ja avaliados na turma filtrada.",
    },
    {
      label: "Media de submissoes",
      value: averageSubmissions.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      note: "Indicador rapido de iteracao por aluno ao longo da trilha.",
    },
  ];
};

const renderOverviewHeader = (students) => {
  const completed = students.filter(hasCompletedTrail).length;
  const gradedStudents = students.filter((student) => student.finalGrade != null);
  const averageGrade =
    gradedStudents.length === 0
      ? null
      : gradedStudents.reduce((sum, item) => sum + item.finalGrade, 0) / gradedStudents.length;

  elements.totalStudents.textContent = String(students.length);
  elements.completeStudents.textContent = String(completed);
  elements.averageGrade.textContent = averageGrade === null ? "-" : formatGrade(averageGrade);

  const selectedCohort = state.overview?.selectedCohort;
  elements.selectedCohort.textContent = selectedCohort
    ? `${selectedCohort.title}`
    : "Todas as turmas";
  elements.selectedCohortCopy.textContent = selectedCohort
    ? `Acompanhamento administrativo da turma ${selectedCohort.code.toUpperCase()}. ${formatCohortWindow(selectedCohort)}.`
    : "Visao consolidada de todas as turmas cadastradas na plataforma.";

  const readiness = students.length === 0 ? 0 : Math.round((completed / students.length) * 100);
  elements.readyLabel.textContent = `${readiness}%`;
  elements.readyFill.style.width = `${readiness}%`;

  elements.metricStrip.innerHTML = buildMetricCards(students)
    .map(
      (card) => `
        <article class="summary-card">
          <span class="hero-label">${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <p>${escapeHtml(card.note)}</p>
        </article>
      `,
    )
    .join("");
};

const renderOverviewHighlights = (students) => {
  const selectedStudentName = state.selectedDetail?.student?.student?.name || "Nenhum aluno selecionado";
  const selectedStudentNote = state.selectedDetail?.student?.student?.email
    ? `${state.selectedDetail.student.student.email} • detalhe carregado`
    : "Abra um aluno para ver labs, submissões e nota.";
  const selectedCohortLabel = state.overview?.selectedCohort
    ? `${state.overview.selectedCohort.code.toUpperCase()} • ${state.overview.selectedCohort.title}`
    : "Consolidado de todas as turmas";
  const readiness = students.length === 0
    ? "Ainda sem base suficiente para fechamento."
    : `${students.filter(hasCompletedTrail).length} aluno(s) prontos para nota final.`;

  elements.overviewHighlights.innerHTML = [
    {
      label: "Turma observada",
      value: selectedCohortLabel,
      note: "Use o filtro superior para refinar a leitura por código de turma.",
    },
    {
      label: "Aluno em foco",
      value: selectedStudentName,
      note: selectedStudentNote,
    },
    {
      label: "Fechamento",
      value: readiness,
      note: "A página de notas mostra apenas o que interessa para avaliação final.",
    },
  ]
    .map(
      (item) => `
        <article class="overview-mini-card">
          <span class="hero-label">${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <p>${escapeHtml(item.note)}</p>
        </article>
      `,
    )
    .join("");
};

const renderCohortOptions = () => {
  const cohorts = state.overview?.cohorts || [];
  const currentValue = state.selectedCohortCode;

  elements.cohortSelect.innerHTML = `
    <option value="">Todas as turmas</option>
    ${cohorts
      .map(
        (cohort) => `
          <option value="${escapeHtml(cohort.code)}">
            ${escapeHtml(cohort.title)} (${cohort.studentCount})
          </option>
        `,
      )
      .join("")}
  `;

  elements.cohortSelect.value = currentValue;
};

const renderCohortManageList = () => {
  const cohorts = state.overview?.cohorts || [];
  const pagination = paginateItems(cohorts, "cohorts");

  if (pagination.totalItems === 0) {
    elements.cohortManageList.innerHTML =
      '<p class="empty-state">Nenhuma turma cadastrada ainda.</p>';
    renderPagination(elements.cohortPagination, "cohorts", pagination, "turmas");
    return;
  }

  elements.cohortManageList.innerHTML = pagination.items
    .map(
      (cohort) => {
        const accessState = getCohortAccessState(cohort);
        const accessTone = getCohortAccessTone(accessState);

        return `
        <article class="admin-manage-item">
          <div class="admin-manage-copy">
            <div class="admin-manage-topline">
              <span class="hero-label">${escapeHtml(cohort.code.toUpperCase())}</span>
              <span class="timeline-status ${accessTone}">${escapeHtml(getCohortAccessLabel(accessState))}</span>
            </div>
            <strong>${escapeHtml(cohort.title)}</strong>
            <p>${escapeHtml(formatCohortWindow(cohort))}</p>
            <div class="admin-manage-meta">
              <span>${cohort.studentCount} aluno(s)</span>
              <span>Use este codigo no vinculo do estudante.</span>
            </div>
          </div>
          <div class="admin-inline-actions">
            <button class="ghost-button button-compact" data-cohort-edit="${escapeHtml(cohort.code)}" type="button">
              Editar
            </button>
            <button class="ghost-button button-compact danger-button" data-cohort-delete="${escapeHtml(cohort.code)}" type="button">
              Excluir
            </button>
          </div>
        </article>
      `;
      },
    )
    .join("");

  renderPagination(elements.cohortPagination, "cohorts", pagination, "turmas");
};

const renderStudentList = () => {
  const students = getVisibleStudents();
  renderOverviewHeader(students);
  const pagination = paginateItems(students, "students");

  if (pagination.totalItems === 0) {
    elements.studentList.innerHTML =
      '<p class="empty-state">Nenhum aluno encontrado para o filtro selecionado.</p>';
    renderPagination(elements.studentPagination, "students", pagination, "alunos");
    return;
  }

  elements.studentList.innerHTML = pagination.items
    .map((item) => {
      const status = getStudentProgressLabel(item);
      const isActive = item.student.id === state.selectedStudentId;
      const labsPercent = getTotalLabs() === 0 ? 0 : Math.round((item.validatedLabs / getTotalLabs()) * 100);
      const tasksPercent = getTotalTasks() === 0 ? 0 : Math.round((item.completedTasks / getTotalTasks()) * 100);

      return `
        <article
          class="admin-student-item ${isActive ? "active" : ""}"
          data-student-id="${item.student.id}"
        >
          <div class="admin-student-topline">
            <button class="admin-select-button" data-student-id="${item.student.id}" type="button">
              <div>
                <strong>${escapeHtml(item.student.name)}</strong>
                <p>${escapeHtml(item.student.email)}</p>
              </div>
            </button>
            <div class="admin-inline-actions">
              <span class="timeline-status ${status.tone}">${escapeHtml(status.label)}</span>
              <button class="ghost-button button-compact" data-student-edit="${item.student.id}" type="button">
                Editar
              </button>
              <button class="ghost-button button-compact danger-button" data-student-delete="${item.student.id}" type="button">
                Excluir
              </button>
            </div>
          </div>

          <div class="admin-student-metrics">
            <article>
              <span>Labs</span>
              <strong>${item.validatedLabs}/${getTotalLabs()}</strong>
            </article>
            <article>
              <span>Tarefas</span>
              <strong>${item.completedTasks}/${getTotalTasks()}</strong>
            </article>
            <article>
              <span>Submissoes</span>
              <strong>${item.submissionCount}</strong>
            </article>
            <article>
              <span>Nota</span>
              <strong>${formatGrade(item.finalGrade)}</strong>
            </article>
          </div>

          <div class="admin-progress-pair">
            <div class="admin-progress-block">
              <div class="progress-row">
                <span>Labs validados</span>
                <strong>${labsPercent}%</strong>
              </div>
              <div class="progress-bar compact">
                <span style="width: ${labsPercent}%"></span>
              </div>
            </div>
            <div class="admin-progress-block">
              <div class="progress-row">
                <span>Checklist</span>
                <strong>${tasksPercent}%</strong>
              </div>
              <div class="progress-bar compact">
                <span style="width: ${tasksPercent}%"></span>
              </div>
            </div>
          </div>

          <div class="admin-student-footer">
            <span>${escapeHtml(item.cohort.title)}</span>
            <span>Ultima atividade: ${escapeHtml(formatTimestamp(item.lastActivity))}</span>
          </div>
        </article>
      `;
    })
    .join("");

  renderPagination(elements.studentPagination, "students", pagination, "alunos");
};

const findMeetingByLabId = (labId) =>
  state.course?.meetings?.find((meeting) => meeting.lab.id === labId) || null;

const renderStudentDetail = () => {
  const detail = state.selectedDetail;
  if (!detail) {
    const selectedStudent = getSelectedStudentSummary();

    elements.studentDetail.innerHTML = `
      <div class="panel-header">
        <p class="eyebrow">Detalhe do aluno</p>
        <h2>${selectedStudent ? escapeHtml(selectedStudent.student.name) : "Selecione um aluno"}</h2>
      </div>
      <p class="status-text muted">
        ${
          selectedStudent
            ? "O detalhamento completo ainda esta sendo carregado. A nota final ja pode ser editada."
            : "Clique em um aluno da lista para abrir o detalhamento de labs, submissões e nota final."
        }
      </p>
    `;
    elements.labList.innerHTML =
      '<p class="empty-state">O mapa de labs aparece quando um aluno e selecionado.</p>';
    elements.submissionList.innerHTML =
      '<p class="empty-state">O historico de submissoes sera exibido aqui.</p>';
    elements.submissionPagination.innerHTML = "";

    elements.gradeInput.value =
      selectedStudent?.finalGrade === null || selectedStudent?.finalGrade === undefined
        ? ""
        : String(selectedStudent.finalGrade);
    elements.gradeNotes.value = selectedStudent?.instructorNotes || "";
    setGradeStatus(
      selectedStudent
        ? "Aluno identificado. O detalhe completo esta carregando, mas a nota final ja pode ser salva."
        : "Selecione um aluno para registrar a nota final.",
      selectedStudent ? "warning" : "muted",
    );
    return;
  }

  const student = detail.student;
  const labsPercent = getTotalLabs() === 0 ? 0 : Math.round((student.validatedLabs / getTotalLabs()) * 100);
  const tasksPercent =
    getTotalTasks() === 0 ? 0 : Math.round((student.completedTasks / getTotalTasks()) * 100);

  elements.studentDetail.innerHTML = `
    <div class="panel-header">
      <p class="eyebrow">Detalhe do aluno</p>
      <h2>${escapeHtml(student.student.name)}</h2>
    </div>
    <p class="hero-text compact">
      ${escapeHtml(student.student.email)} • ${escapeHtml(student.cohort.title)}
    </p>
    <div class="admin-detail-grid">
      <article class="summary-card">
        <span class="hero-label">Labs validados</span>
        <strong>${student.validatedLabs}/${getTotalLabs()}</strong>
        <p>Checkpoint automatico por laboratorio.</p>
      </article>
      <article class="summary-card">
        <span class="hero-label">Checklist</span>
        <strong>${student.completedTasks}/${getTotalTasks()}</strong>
        <p>Atividades praticas marcadas ao longo da trilha.</p>
      </article>
      <article class="summary-card">
        <span class="hero-label">Submissoes</span>
        <strong>${student.submissionCount}</strong>
        <p>Historico total de validacoes salvas.</p>
      </article>
      <article class="summary-card">
        <span class="hero-label">Nota final</span>
        <strong>${formatGrade(student.finalGrade)}</strong>
        <p>${student.gradedAt ? `Lancada em ${escapeHtml(formatTimestamp(student.gradedAt))}` : "Ainda nao lancada."}</p>
      </article>
    </div>
    <div class="admin-progress-pair">
      <div class="admin-progress-block">
        <div class="progress-row">
          <span>Labs concluidos</span>
          <strong>${labsPercent}%</strong>
        </div>
        <div class="progress-bar compact">
          <span style="width: ${labsPercent}%"></span>
        </div>
      </div>
      <div class="admin-progress-block">
        <div class="progress-row">
          <span>Tarefas concluidas</span>
          <strong>${tasksPercent}%</strong>
        </div>
        <div class="progress-bar compact">
          <span style="width: ${tasksPercent}%"></span>
        </div>
      </div>
    </div>
    <p class="status-text muted">Ultima atividade: ${escapeHtml(formatTimestamp(student.lastActivity))}</p>
  `;

  elements.gradeInput.value =
    student.finalGrade === null || student.finalGrade === undefined ? "" : String(student.finalGrade);
  elements.gradeNotes.value = student.instructorNotes || "";
  setGradeStatus(
    student.finalGrade == null
      ? "Aluno selecionado. Preencha a nota final e salve."
      : "Nota carregada. Ajuste e salve se precisar revisar a avaliacao.",
    student.finalGrade == null ? "muted" : "success",
  );

  const workspaces = Array.isArray(detail.workspaces) ? detail.workspaces : [];
  const submissions = Array.isArray(detail.submissions) ? detail.submissions : [];
  const submissionPagination = paginateItems(submissions, "submissions");
  const workspaceByLabId = new Map(workspaces.map((workspace) => [workspace.labId, workspace]));
  elements.labList.innerHTML = state.course.meetings
    .map((meeting) => {
      const workspace = workspaceByLabId.get(meeting.lab.id);
      const validationStatus = workspace?.bestAllPassed || workspace?.validationPassed
        ? { label: "Validado", tone: "success" }
        : workspace
          ? { label: "Em trabalho", tone: "draft" }
          : { label: "Sem entrega", tone: "neutral" };
      const completedTasks = workspace?.completedTaskIndexes?.length || 0;
      const bestScore = workspace?.bestScore || workspace?.validationScore || 0;

      return `
        <article class="admin-lab-item">
          <div class="admin-lab-header">
            <div>
              <span class="hero-label">${escapeHtml(meeting.label || `Unidade ${meeting.order}`)}</span>
              <h3>${escapeHtml(meeting.title)}</h3>
            </div>
            <span class="timeline-status ${validationStatus.tone}">${escapeHtml(validationStatus.label)}</span>
          </div>
          <div class="admin-lab-meta">
            <span>Lab: ${escapeHtml(meeting.lab.id)}</span>
            <span>Score: ${workspace ? `${bestScore}%` : "-"}</span>
            <span>Tarefas: ${completedTasks}/${meeting.practiceTasks.length}</span>
          </div>
          <div class="admin-lab-meta">
            <span>Submissoes: ${workspace?.submissionCount || 0}</span>
            <span>Ultima entrega: ${escapeHtml(formatTimestamp(workspace?.updatedAt || workspace?.lastSubmissionAt))}</span>
          </div>
        </article>
      `;
    })
    .join("");

  elements.submissionList.innerHTML =
    submissionPagination.totalItems === 0
      ? '<p class="empty-state">Nenhuma submissao registrada para este aluno.</p>'
      : submissionPagination.items
          .map((submission) => {
            const meeting = findMeetingByLabId(submission.labId);
            return `
              <article class="admin-submission-item">
                <div>
                  <strong>${escapeHtml(meeting?.title || submission.labId)}</strong>
                  <p>${escapeHtml(formatTimestamp(submission.createdAt))}</p>
                </div>
                <div class="admin-submission-stats">
                  <span class="timeline-status ${submission.allPassed ? "success" : "draft"}">
                    ${submission.allPassed ? "Aprovado" : "Parcial"}
                  </span>
                  <strong>${submission.score}%</strong>
                </div>
              </article>
            `;
          })
          .join("");

  renderPagination(elements.submissionPagination, "submissions", submissionPagination, "submissoes");
};

const render = () => {
  renderCohortOptions();
  renderCohortManageList();
  renderStudentList();
  renderStudentDetail();
  renderAdminNavigation();
  renderOverviewHighlights(getVisibleStudents());
  renderAdminRoute();
};

const loadOverview = async ({ preserveSelection = true } = {}) => {
  setStatus("Atualizando painel administrativo...", "muted");
  const cohortQuery = state.selectedCohortCode
    ? `?cohortCode=${encodeURIComponent(state.selectedCohortCode)}`
    : "";
  state.overview = await fetchJSON(`/api/admin/overview${cohortQuery}`);

  if (!preserveSelection) {
    state.selectedStudentId = null;
    state.selectedDetail = null;
    resetPagination("cohorts");
    resetPagination("students");
    resetPagination("submissions");
  }

  const visibleStudents = getVisibleStudents();
  if (state.selectedStudentId && !visibleStudents.some((item) => item.student.id === state.selectedStudentId)) {
    state.selectedStudentId = visibleStudents[0]?.student.id || null;
    state.selectedDetail = null;
  }

  if (!state.selectedStudentId && visibleStudents.length > 0) {
    state.selectedStudentId = visibleStudents[0].student.id;
  }

  if (state.selectedStudentId && !state.selectedDetail) {
    const selectedStudent = getSelectedStudentSummary();
    if (selectedStudent) {
      state.selectedDetail = buildPartialStudentDetail(selectedStudent);
    }
  }

  render();

  if (state.selectedStudentId) {
    await loadStudentDetail(state.selectedStudentId, { silent: true });
  }

  setStatus("Painel administrativo sincronizado.", "success");
};

const loadStudentDetail = async (studentID, { silent = false } = {}) => {
  const cohortQuery = state.selectedCohortCode
    ? `&cohortCode=${encodeURIComponent(state.selectedCohortCode)}`
    : "";

  if (!silent) {
    setStatus("Carregando detalhe do aluno...", "muted");
  }

  state.selectedDetail = await fetchJSON(
    `/api/admin/student?studentId=${studentID}${cohortQuery}`,
  );
  state.selectedStudentId = studentID;
  renderStudentList();
  renderStudentDetail();

  if (!silent) {
    setStatus("Detalhe do aluno carregado.", "success");
  }
};

const attachEventListeners = () => {
  elements.bootstrapForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = elements.bootstrapUsername.value.trim();
    const password = elements.bootstrapPassword.value;
    const confirm = elements.bootstrapConfirm.value;

    const requiredMessage = buildRequiredMessage([
      [elements.bootstrapUsername, "usuario admin"],
      [elements.bootstrapPassword, "senha"],
      [elements.bootstrapConfirm, "confirmacao de senha"],
    ]);
    if (requiredMessage) {
      setBootstrapStatus(requiredMessage, "warning");
      showToast(requiredMessage, "warning");
      return;
    }

    if (password.length < 8) {
      setBootstrapStatus("Use ao menos 8 caracteres na senha administrativa.", "danger");
      return;
    }

    if (password !== confirm) {
      setBootstrapStatus("A confirmacao de senha nao confere.", "danger");
      return;
    }

    elements.bootstrapSubmit.disabled = true;
    elements.bootstrapSubmit.textContent = "Salvando...";

    try {
      const auth = await fetchJSON("/api/auth/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      enterAdminMode(auth.admin);
      setBootstrapStatus("Primeiro acesso configurado com sucesso.", "success");
      showToast("Admin configurado e autenticado.", "success");
      await loadOverview({ preserveSelection: false });
    } catch (error) {
      const message = normalizeErrorMessage(
        error,
        "Nao foi possivel configurar o primeiro acesso administrativo.",
      );
      setBootstrapStatus(message, "danger");
      showToast(message, "danger");
    } finally {
      elements.bootstrapSubmit.disabled = false;
      elements.bootstrapSubmit.textContent = "Salvar primeiro acesso";
    }
  });

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const requiredMessage = buildRequiredMessage([
      [elements.loginUsername, "usuario"],
      [elements.loginPassword, "senha"],
    ]);
    if (requiredMessage) {
      setLoginStatus(requiredMessage, "warning");
      showToast(requiredMessage, "warning");
      return;
    }

    elements.loginSubmit.disabled = true;
    elements.loginSubmit.textContent = "Entrando...";

    try {
      const auth = await fetchJSON("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: elements.loginUsername.value.trim(),
          password: elements.loginPassword.value,
        }),
      });

      enterAdminMode(auth.admin);
      elements.loginPassword.value = "";
      setLoginStatus("Autenticacao administrativa concluida.", "success");
      showToast("Painel administrativo liberado.", "success");
      await loadOverview({ preserveSelection: false });
    } catch (error) {
      const message = normalizeErrorMessage(
        error,
        "Nao foi possivel autenticar o admin. Revise usuario e senha.",
      );
      setLoginStatus(message, "danger");
      showToast(message, "danger");
    } finally {
      elements.loginSubmit.disabled = false;
      elements.loginSubmit.textContent = "Entrar";
    }
  });

  elements.logoutButton.addEventListener("click", async () => {
    try {
      await fetchJSON("/api/auth/logout", { method: "POST" });
    } catch {
      // limpeza local continua mesmo se a remocao remota da sessao falhar
    }

    leaveAdminMode("Sessao administrativa encerrada.", "muted");
    showToast("Sessao do admin encerrada.", "info");
  });

  elements.cohortCancel.addEventListener("click", () => resetCohortForm());
  elements.studentCancel.addEventListener("click", () => resetStudentForm());

  elements.modalClose.addEventListener("click", () => closeAdminModal(null));
  elements.modalCancel.addEventListener("click", () => closeAdminModal(null));
  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) {
      closeAdminModal(null);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isAdminModalOpen()) {
      return;
    }

    event.preventDefault();
    closeAdminModal(null);
  });
  elements.modalForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.modal.onSubmit) {
      closeAdminModal(true);
      return;
    }

    const originalLabel = state.modal.submitLabel;
    elements.modalConfirm.disabled = true;
    elements.modalConfirm.textContent = "Processando...";

    try {
      const result = await state.modal.onSubmit();
      if (result !== false) {
        closeAdminModal(result ?? true);
      }
    } catch (error) {
      setModalStatus(
        normalizeErrorMessage(error, "Nao foi possivel concluir a operacao no modal."),
        "danger",
      );
    } finally {
      if (isAdminModalOpen()) {
        elements.modalConfirm.disabled = false;
        elements.modalConfirm.textContent = originalLabel;
      }
    }
  });

  elements.nav?.addEventListener("click", (event) => {
    const link = event.target.closest("[data-admin-route]");
    if (!link) {
      return;
    }

    event.preventDefault();
    setAdminRoute(link.dataset.adminRoute);
  });

  window.addEventListener("popstate", () => {
    setAdminRoute(getRouteKeyFromPath(window.location.pathname), { replace: true });
  });

  elements.cohortSelect.addEventListener("change", async () => {
    state.selectedCohortCode = elements.cohortSelect.value;
    elements.studentCohort.value = state.selectedCohortCode;
    state.selectedStudentId = null;
    state.selectedDetail = null;
    resetPagination("students");
    resetPagination("submissions");

    try {
      await loadOverview({ preserveSelection: false });
    } catch (error) {
      setStatus(
        normalizeErrorMessage(error, "Nao foi possivel filtrar a turma selecionada."),
        "danger",
      );
    }
  });

  elements.search.addEventListener("input", () => {
    state.search = elements.search.value;
    resetPagination("students");
    renderStudentList();
  });

  elements.refreshButton.addEventListener("click", async () => {
    elements.refreshButton.disabled = true;
    elements.refreshButton.textContent = "Atualizando...";

    try {
      await loadOverview();
    } catch (error) {
      setStatus(
        normalizeErrorMessage(error, "Nao foi possivel atualizar o painel administrativo."),
        "danger",
      );
    } finally {
      elements.refreshButton.disabled = false;
      elements.refreshButton.textContent = "Atualizar painel";
    }
  });

  [elements.cohortPagination, elements.studentPagination, elements.submissionPagination].forEach(
    (container) => {
      container?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-pagination-key]");
        if (!button) {
          return;
        }

        const key = button.dataset.paginationKey;
        const page = Number(button.dataset.paginationPage);
        if (!PAGINATION_SIZE[key] || Number.isNaN(page) || page < 1) {
          return;
        }

        state.pagination[key] = page;

        if (key === "submissions") {
          renderStudentDetail();
          return;
        }

        render();
      });
    },
  );

  elements.studentList.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-student-edit]");
    if (editButton) {
      const studentID = Number(editButton.dataset.studentEdit);
      const selected = (state.overview?.students || []).find((item) => item.student.id === studentID);
      if (selected) {
        const result = await openStudentEditModal(selected);
        if (result?.student?.id) {
          resetPagination("students");
          setStudentStatus(`Aluno ${result.student.name} atualizado com sucesso.`, "success");
          showToast("Aluno atualizado com sucesso.", "success");
          await loadOverview({ preserveSelection: false });
        }
      }
      return;
    }

    const deleteButton = event.target.closest("[data-student-delete]");
    if (deleteButton) {
      const studentID = Number(deleteButton.dataset.studentDelete);
      const selected = (state.overview?.students || []).find((item) => item.student.id === studentID);
      if (!selected) {
        return;
      }

      const confirmed = await openConfirmModal({
        title: `Excluir ${selected.student.name}?`,
        copy: "Esta ação remove o acesso do aluno, os workspaces e o histórico de submissões vinculados a ele.",
        confirmLabel: "Excluir aluno",
        danger: true,
      });
      if (!confirmed) {
        return;
      }

      try {
        await fetchJSON("/api/admin/students", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: studentID }),
        });

        if (state.selectedStudentId === studentID) {
          state.selectedStudentId = null;
          state.selectedDetail = null;
        }
        resetPagination("students");
        resetPagination("submissions");
        resetStudentForm();
        setStudentStatus(`Aluno ${selected.student.name} excluido com sucesso.`, "success");
        showToast("Aluno excluido com sucesso.", "success");
        await loadOverview({ preserveSelection: false });
      } catch (error) {
        const message = normalizeErrorMessage(error, "Nao foi possivel excluir o aluno agora.");
        setStudentStatus(message, "danger");
        showToast(message, "danger");
      }
      return;
    }

    const selectButton = event.target.closest("[data-student-id]");
    if (!selectButton) {
      return;
    }

    const studentID = Number(selectButton.dataset.studentId);
    const selected = (state.overview?.students || []).find((item) => item.student.id === studentID);
    if (selected) {
      state.selectedStudentId = studentID;
      state.selectedDetail = buildPartialStudentDetail(selected);
      renderStudentList();
      renderStudentDetail();
    }

    try {
      await loadStudentDetail(studentID);
    } catch (error) {
      setStatus(
        normalizeErrorMessage(error, "Nao foi possivel carregar o detalhe do aluno."),
        "danger",
      );
    }
  });

  elements.gradeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selectedStudent = state.selectedDetail?.student || getSelectedStudentSummary();
    if (!selectedStudent) {
      setGradeStatus("Selecione um aluno antes de salvar a nota.", "danger");
      return;
    }

    const rawGrade = elements.gradeInput.value.trim();
    const finalGrade = Number(rawGrade);
    if (rawGrade === "" || Number.isNaN(finalGrade) || finalGrade < 0 || finalGrade > 100) {
      setGradeStatus("Informe uma nota valida entre 0 e 100.", "danger");
      return;
    }

    elements.gradeSubmit.disabled = true;
    elements.gradeSubmit.textContent = "Salvando...";

    try {
      const detail = await fetchJSON("/api/admin/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.student.id,
          cohortCode: selectedStudent.cohort.code,
          finalGrade,
          instructorNotes: elements.gradeNotes.value,
        }),
      });

      state.selectedDetail = detail;
      if (state.overview?.students) {
        state.overview.students = state.overview.students.map((item) =>
          item.student.id === detail.student.student.id ? detail.student : item,
        );
      }

      render();
      setGradeStatus("Nota final salva com sucesso.", "success");
      setStatus("Painel administrativo atualizado com a nova nota.", "success");
    } catch (error) {
      setGradeStatus(
        normalizeErrorMessage(error, "Nao foi possivel salvar a nota final do aluno."),
        "danger",
      );
    } finally {
      elements.gradeSubmit.disabled = false;
      elements.gradeSubmit.textContent = "Salvar nota final";
    }
  });

  elements.cohortForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const code = elements.cohortCode.value.trim();
    const title = elements.cohortTitle.value.trim();
    const accessStartsAt = elements.cohortStart.value;
    const accessEndsAt = elements.cohortEnd.value;
    const requiredMessage = buildRequiredMessage([
      [elements.cohortCode, "codigo da turma"],
      [elements.cohortTitle, "titulo da turma"],
    ]);
    if (requiredMessage) {
      setCohortStatus(requiredMessage, "warning");
      showToast(requiredMessage, "warning");
      return;
    }

    elements.cohortSubmit.disabled = true;
    elements.cohortSubmit.textContent = "Salvando...";

    try {
      const cohort = await fetchJSON("/api/admin/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          title,
          accessStartsAt,
          accessEndsAt,
        }),
      });

      state.selectedCohortCode = cohort.code;
      resetPagination("cohorts");
      resetPagination("students");
      resetCohortForm();
      setCohortStatus(`Turma ${cohort.title} salva com sucesso.`, "success");
      await loadOverview({ preserveSelection: false });
    } catch (error) {
      setCohortStatus(
        normalizeErrorMessage(error, "Nao foi possivel salvar os dados da turma."),
        "danger",
      );
    } finally {
      elements.cohortSubmit.disabled = false;
      elements.cohortSubmit.textContent = "Salvar turma";
    }
  });

  elements.cohortManageList.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-cohort-edit]");
    if (editButton) {
      const cohort = (state.overview?.cohorts || []).find(
        (item) => item.code === editButton.dataset.cohortEdit,
      );
      if (cohort) {
        const result = await openCohortEditModal(cohort);
        if (result?.code) {
          state.selectedCohortCode = result.code;
          resetPagination("cohorts");
          resetPagination("students");
          setCohortStatus(`Turma ${result.title} atualizada com sucesso.`, "success");
          showToast("Turma atualizada com sucesso.", "success");
          await loadOverview({ preserveSelection: false });
        }
      }
      return;
    }

    const deleteButton = event.target.closest("[data-cohort-delete]");
    if (!deleteButton) {
      return;
    }

    const code = deleteButton.dataset.cohortDelete;
    const cohort = (state.overview?.cohorts || []).find((item) => item.code === code);
    if (!cohort) {
      return;
    }

    const confirmed = await openConfirmModal({
      title: `Excluir ${cohort.title}?`,
      copy: "Se a turma ainda tiver alunos matriculados, a exclusão será bloqueada. Use esta ação apenas quando a turma estiver encerrada.",
      confirmLabel: "Excluir turma",
      danger: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      await fetchJSON("/api/admin/cohorts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (state.selectedCohortCode === code) {
        state.selectedCohortCode = "";
      }
      resetPagination("cohorts");
      resetPagination("students");
      resetCohortForm();
      setCohortStatus(`Turma ${cohort.title} excluida com sucesso.`, "success");
      showToast("Turma excluida com sucesso.", "success");
      await loadOverview({ preserveSelection: false });
    } catch (error) {
      const message = normalizeErrorMessage(error, "Nao foi possivel excluir a turma agora.");
      setCohortStatus(message, "danger");
      showToast(message, "danger");
    }
  });

  elements.studentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      name: elements.studentName.value.trim(),
      email: elements.studentEmail.value.trim(),
      cohortCode: elements.studentCohort.value.trim(),
      password: elements.studentPassword.value,
    };

    const requiredMessage = buildRequiredMessage([
      [elements.studentName, "nome do aluno"],
      [elements.studentEmail, "e-mail do aluno"],
      [elements.studentCohort, "codigo da turma"],
      [elements.studentPassword, "senha inicial"],
    ]);
    if (requiredMessage) {
      setStudentStatus(requiredMessage, "warning");
      showToast(requiredMessage, "warning");
      return;
    }

    elements.studentSubmit.disabled = true;
    elements.studentSubmit.textContent = "Salvando...";

    try {
      const result = await fetchJSON("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
        }),
      });

      resetPagination("students");
      resetStudentForm();
      setStudentStatus(
        `Aluno ${result.student.name} salvo na turma ${result.cohort.code.toUpperCase()}.`,
        "success",
      );
      showToast("Aluno cadastrado com sucesso.", "success");

      if (!state.selectedCohortCode || state.selectedCohortCode === result.cohort.code) {
        await loadOverview({ preserveSelection: false });
      }
    } catch (error) {
      const message = normalizeErrorMessage(error, "Nao foi possivel salvar os dados do aluno.");
      setStudentStatus(message, "danger");
      showToast(message, "danger");
    } finally {
      elements.studentSubmit.disabled = false;
      elements.studentSubmit.textContent = "Salvar aluno";
    }
  });
};

const initialize = async () => {
  try {
    state.course = await fetchJSON("/api/course");
    state.routeKey = getRouteKeyFromPath(window.location.pathname);
    const auth = await fetchJSON("/api/auth/status");

    state.adminSetupRequired = Boolean(auth.adminSetupRequired);
    if (auth.authenticated && auth.role === "admin") {
      enterAdminMode(auth.admin);
      await loadOverview({ preserveSelection: false });
      setAdminRoute(state.routeKey, { replace: true });
    } else if (auth.authenticated && auth.role === "student") {
      setLoginStatus(
        "Uma sessao de aluno foi detectada. Encerre-a e autentique-se como admin para abrir o painel.",
        "warning",
      );
      syncAdminVisibility();
      setAdminRoute(state.routeKey, { replace: true });
    } else if (state.adminSetupRequired) {
      elements.gateCopy.textContent =
        "Nenhum admin foi configurado ainda. Defina agora o primeiro usuario e senha do instrutor.";
      setBootstrapStatus(
        "Defina o primeiro usuario admin para liberar o painel e cadastrar as turmas.",
        "warning",
      );
      syncAdminVisibility();
      setAdminRoute(state.routeKey, { replace: true });
    } else {
      setLoginStatus("Use o usuario e a senha do instrutor para abrir o painel.", "muted");
      syncAdminVisibility();
      setAdminRoute(state.routeKey, { replace: true });
    }

    attachEventListeners();
  } catch (error) {
    const message = normalizeErrorMessage(
      error,
      "Nao foi possivel carregar o painel administrativo agora.",
    );
    setStatus(message, "danger");
    setLoginStatus(message, "danger");
  }
};

initialize();
