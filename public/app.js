const STORAGE_KEY = "kubeclass-web-lab-state-v2";
const DEFAULT_EDITOR_CALLOUT =
  "Este template vem com pequenos erros intencionais. O objetivo do aluno e identificar, corrigir e so entao enviar para validacao.";

const TERMINAL_GUIDES = {
  "lab-1": {
    runtimeTaskIndexes: [0],
    intro:
      "Neste runtime o namespace do aluno ja foi provisionado pela plataforma. Use o terminal para operar dentro desse escopo e use o manifesto abaixo para treinar a modelagem declarativa do exercicio.",
    steps: [
      {
        title: "Confirmar o escopo do lab",
        command: "kubectl get pods",
        note: "Confere se voce ja caiu no namespace isolado do aluno e quais recursos existem no inicio.",
      },
      {
        title: "Subir o primeiro pod",
        command: "kubectl run nginx-lab --image=nginx:stable --restart=Never",
        note: "Cria o Pod simples do encontro diretamente no namespace atual do lab.",
        taskIndexes: [1],
      },
      {
        title: "Acompanhar a inicializacao",
        command: "kubectl get pods -w",
        note: "Observe o Pod ate ficar Running. Use Ctrl+C para encerrar o watch ou avance para o proximo passo guiado que a plataforma interrompe o acompanhamento automaticamente.",
        longRunning: true,
        taskIndexes: [1],
      },
      {
        title: "Inspecionar eventos e condicoes",
        command: "kubectl describe pod nginx-lab",
        note: "Leia imagem, eventos e condicoes do Pod antes de seguir.",
        taskIndexes: [2],
      },
    ],
  },
  "lab-2": {
    intro:
      "Este encontro ja foca em rollout, replicas e Service. O terminal deve ser o caminho principal para subir e validar o workload antes de consolidar o YAML no editor.",
    steps: [
      {
        title: "Criar o deployment replicado",
        command: "kubectl create deployment api-demo --image=nginx:stable --replicas=3",
        note: "Cria o workload base com tres replicas no namespace atual.",
        taskIndexes: [0],
      },
      {
        title: "Expor a aplicacao internamente",
        command: "kubectl expose deployment api-demo --name=api-demo-svc --port=80 --target-port=80",
        note: "Gera o Service interno que aponta para o Deployment.",
        taskIndexes: [1],
      },
      {
        title: "Acompanhar o rollout",
        command: "kubectl rollout status deploy/api-demo",
        note: "Verifica se o rollout das replicas terminou sem erro.",
        taskIndexes: [2],
      },
      {
        title: "Revisar recursos publicados",
        command: "kubectl get deploy,svc,pods",
        note: "Confirme replicas, Service e Pods antes de escrever a entrega declarativa.",
        taskIndexes: [2],
      },
    ],
  },
  "lab-3": {
    intro:
      "Neste modulo voce continua usando o terminal como trilha de operacao. O Ingress e um bom exemplo de recurso que pode nascer via apply pontual no shell e depois ser consolidado no manifesto final.",
    steps: [
      {
        title: "Criar o frontend base",
        command: "kubectl create deployment webapp --image=nginx:stable --replicas=2",
        note: "Sobe a aplicacao web com duas replicas para comecar o fluxo de entrega HTTP.",
      },
      {
        title: "Expor o frontend com Service",
        command: "kubectl expose deployment webapp --name=webapp-service --port=80 --target-port=80",
        note: "Cria o backend do trafego interno que sera usado pelo Ingress.",
        taskIndexes: [0],
      },
      {
        title: "Aplicar a regra de Ingress",
        command: `cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: webapp-ingress
spec:
  rules:
    - host: kubeclass.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: webapp-service
                port:
                  number: 80
EOF`,
        note: "Publica a rota HTTP do exercicio direto do terminal para testar rapidamente.",
        taskIndexes: [1],
      },
      {
        title: "Conferir Service e Ingress",
        command: "kubectl get ingress,svc,pods",
        note: "Valide o ponto unico de entrada e os backends do frontend.",
        taskIndexes: [2],
      },
    ],
  },
  "lab-4": {
    intro:
      "Aqui o terminal passa a ser um posto de operacao. Primeiro voce injeta configuracao e segredo, depois aplica o Deployment com probes e limites.",
    steps: [
      {
        title: "Criar o ConfigMap",
        command: "kubectl create configmap app-config --from-literal=APP_MODE=dev",
        note: "Desacopla configuracao da imagem do container.",
        taskIndexes: [0],
      },
      {
        title: "Criar o Secret",
        command:
          "kubectl create secret generic app-secret --from-literal=API_KEY=trocar-antes-de-produzir",
        note: "Materializa o segredo usado pela API do encontro.",
        taskIndexes: [0],
      },
      {
        title: "Aplicar o deployment operacional",
        command: `cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: config-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: config-api
  template:
    metadata:
      labels:
        app: config-api
    spec:
      containers:
        - name: api
          image: nginx:stable
          ports:
            - containerPort: 80
          env:
            - name: APP_MODE
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: APP_MODE
            - name: API_KEY
              valueFrom:
                secretKeyRef:
                  name: app-secret
                  key: API_KEY
          readinessProbe:
            httpGet:
              path: /
              port: 80
          livenessProbe:
            httpGet:
              path: /
              port: 80
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "250m"
              memory: "256Mi"
EOF`,
        note: "Entrega o workload com probes e recursos minimos dentro do namespace do aluno.",
        taskIndexes: [1, 2],
      },
      {
        title: "Inspecionar a configuracao final",
        command: "kubectl describe deploy config-api",
        note: "Revise env vars, probes e limites diretamente no resultado do cluster.",
        taskIndexes: [2],
      },
    ],
  },
  "lab-5": {
    intro:
      "No modulo stateful, o terminal vira o painel principal para subir objetos encadeados: headless Service, StatefulSet com PVC e Job de bootstrap.",
    steps: [
      {
        title: "Publicar o headless Service",
        command: `cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: redis-headless
spec:
  clusterIP: None
  selector:
    app: redis-cache
  ports:
    - port: 6379
      targetPort: 6379
EOF`,
        note: "Entrega a descoberta estavel para o StatefulSet.",
        taskIndexes: [1],
      },
      {
        title: "Aplicar o StatefulSet",
        command: `cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cache
spec:
  serviceName: redis-headless
  replicas: 1
  selector:
    matchLabels:
      app: redis-cache
  template:
    metadata:
      labels:
        app: redis-cache
    spec:
      containers:
        - name: redis
          image: redis:7
          ports:
            - containerPort: 6379
          volumeMounts:
            - name: data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi
EOF`,
        note: "Cria o componente stateful com volume persistente do encontro.",
        taskIndexes: [0],
      },
      {
        title: "Executar o Job de bootstrap",
        command: `cat <<'EOF' | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: seed-cache
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: seed
          image: busybox:1.36
          command: ["sh", "-c", "echo cache preparado"]
EOF`,
        note: "Dispara a tarefa pontual que fecha o setup do ambiente.",
        taskIndexes: [2],
      },
      {
        title: "Inspecionar camada persistente",
        command: "kubectl get statefulset,pvc,job,pods",
        note: "Confira PVC, identidade estavel e Job de preparacao.",
        taskIndexes: [2],
      },
    ],
  },
  "challenge-final": {
    intro:
      "No desafio final o editor vira o lugar da modelagem declarativa, mas o terminal continua sendo o painel de leitura operacional para rollout, debugging e verificacao da entrega.",
    steps: [
      {
        title: "Revisar panorama geral do namespace",
        command: "kubectl get deploy,svc,ingress,hpa,pods",
        note: "Use este checkpoint depois de cada iteracao relevante do desafio.",
      },
      {
        title: "Inspecionar a API do desafio",
        command: "kubectl describe deploy orders-api",
        note: "Valide probes, env vars, limits e eventos do backend.",
      },
      {
        title: "Acompanhar estabilidade do frontend",
        command: "kubectl rollout status deploy/storefront",
        note: "Monitore o rollout do frontend antes da submissao final.",
      },
      {
        title: "Ler os eventos mais recentes",
        command: "kubectl get events --sort-by=.metadata.creationTimestamp",
        note: "Feche o desafio olhando os eventos e removendo ruido operacional.",
      },
    ],
  },
};

const DEFAULT_WORKFLOW = [
  {
    title: "Operar primeiro no terminal",
    note: "Abra o runtime do aluno, execute o roteiro guiado e use o cluster como ambiente principal da pratica.",
  },
  {
    title: "Consolidar no manifesto",
    note: "Depois de validar o entendimento operacional, registre a versao declarativa no editor YAML.",
  },
  {
    title: "Fechar com validacao e evidencia",
    note: "Use a validacao automatica para gerar checkpoint e salvar a submissao no servidor.",
  },
];

const CHALLENGE_WORKFLOW = [
  {
    title: "Modelar a stack no editor",
    note: "No desafio final o editor passa a ser o documento principal da entrega declarativa.",
  },
  {
    title: "Usar o terminal para inspecao e debug",
    note: "O terminal confirma rollout, eventos, probes, HPA e comportamento operacional da stack.",
  },
  {
    title: "Validar a rubric antes de submeter",
    note: "Feche o ciclo com a rubrica e a validacao automatica para nao deixar criterio aberto.",
  },
];

const GUIDE_STREAM_PATTERN = /\s-w(?:\s|$)|\blogs\s+-f\b/;

const state = {
  course: null,
  activeSessionId: null,
  drafts: {},
  completedTasks: {},
  validations: {},
  terminalLogs: {},
  workspaceUpdatedAt: {},
  studentId: null,
  student: null,
  cohort: null,
  submissionCount: 0,
  validatedLabs: 0,
  lastSyncedAt: null,
  routeKey: "overview",
  accessProfile: {
    email: "",
    cohortCode: "",
  },
  accessStatus: {
    message:
      "Use e-mail, senha e codigo da turma para autenticar sua sessao de laboratorio.",
    tone: "muted",
  },
  editorStatus: {
    message:
      "Rascunhos ficam salvos no navegador ate a primeira conexao do aluno.",
    tone: "muted",
  },
  runtime: {
    session: null,
    socket: null,
    term: null,
    fitAddon: null,
    connected: false,
    activeStreamingCommand: null,
    status: {
      message:
        "Conecte um aluno para provisionar namespace, toolbox pod e terminal do lab.",
      tone: "muted",
    },
  },
};

const elements = {
  gateScreen: document.querySelector("#gate-screen"),
  appShell: document.querySelector("#app-shell"),
  appAlerts: document.querySelector("#app-alerts"),
  gateDescription: document.querySelector("#gate-description"),
  gateCourseFormat: document.querySelector("#gate-course-format"),
  gateCourseModel: document.querySelector("#gate-course-model"),
  heroDescription: document.querySelector("#hero-description"),
  courseFormat: document.querySelector("#course-format"),
  courseModel: document.querySelector("#course-model"),
  studentNav: document.querySelector("#student-nav"),
  studentRouteEyebrow: document.querySelector("#student-route-eyebrow"),
  studentRouteTitle: document.querySelector("#student-route-title"),
  studentRouteCopy: document.querySelector("#student-route-copy"),
  progressLabel: document.querySelector("#progress-label"),
  progressFill: document.querySelector("#progress-fill"),
  capabilityStrip: document.querySelector("#capability-strip"),
  dashboardStrip: document.querySelector("#dashboard-strip"),
  connectionPill: document.querySelector("#connection-pill"),
  learnerName: document.querySelector("#learner-name"),
  learnerMeta: document.querySelector("#learner-meta"),
  sessionCohortBadge: document.querySelector("#session-cohort-badge"),
  logoutButton: document.querySelector("#logout-button"),
  accessForm: document.querySelector("#access-form"),
  accessEmail: document.querySelector("#access-email"),
  accessPassword: document.querySelector("#access-password"),
  accessCohort: document.querySelector("#access-cohort"),
  accessSubmitButton: document.querySelector("#access-submit-button"),
  accessStatus: document.querySelector("#access-status"),
  timeline: document.querySelector("#timeline"),
  sessionOrder: document.querySelector("#session-order"),
  sessionTitle: document.querySelector("#session-title"),
  sessionDuration: document.querySelector("#session-duration"),
  studentSessionHeader: document.querySelector("#student-session-header"),
  studentOverviewGrid: document.querySelector("#student-overview-grid"),
  studentPracticeStudio: document.querySelector("#student-practice-studio"),
  studentTheoryGrid: document.querySelector("#student-theory-grid"),
  studentLabCard: document.querySelector("#student-lab-card"),
  studentWorkspaceStack: document.querySelector("#student-workspace-stack"),
  challengeBrief: document.querySelector("#challenge-brief"),
  challengeBriefCopy: document.querySelector("#challenge-brief-copy"),
  challengeOpenButton: document.querySelector("#challenge-open-button"),
  sessionFocus: document.querySelector("#session-focus"),
  sessionDeliverables: document.querySelector("#session-deliverables"),
  theoryTopics: document.querySelector("#theory-topics"),
  practiceTasks: document.querySelector("#practice-tasks"),
  labTitle: document.querySelector("#lab-title"),
  labScenario: document.querySelector("#lab-scenario"),
  labObjectives: document.querySelector("#lab-objectives"),
  labHints: document.querySelector("#lab-hints"),
  challengeRubric: document.querySelector("#challenge-rubric"),
  editor: document.querySelector("#solution-editor"),
  editorStatus: document.querySelector("#editor-status"),
  editorCallout: document.querySelector("#editor-callout"),
  validationSummary: document.querySelector("#validation-summary"),
  validationResults: document.querySelector("#validation-results"),
  commandList: document.querySelector("#command-list"),
  terminalLog: document.querySelector("#terminal-log"),
  openRuntimeButton: document.querySelector("#open-runtime-button"),
  clearTerminalButton: document.querySelector("#clear-terminal-button"),
  runtimeStatus: document.querySelector("#runtime-status"),
  runtimeMeta: document.querySelector("#runtime-meta"),
  runtimeContext: document.querySelector("#runtime-context"),
  terminalModeLabel: document.querySelector("#terminal-mode-label"),
  runbookIntro: document.querySelector("#runbook-intro"),
  terminalShell: document.querySelector("#terminal-shell"),
  loadTemplateButton: document.querySelector("#load-template-button"),
  saveWorkspaceButton: document.querySelector("#save-workspace-button"),
  validateButton: document.querySelector("#validate-button"),
  resetButton: document.querySelector("#reset-button"),
  workflowSteps: document.querySelector("#workflow-steps"),
};

const STUDENT_ROUTE_CONFIG = {
  overview: {
    path: "/app/overview",
    eyebrow: "Visão geral",
    title: "Mapa do encontro e preparação teórica",
    copy: "Abra uma visão limpa da sessão atual, com foco pedagógico, entregáveis e checklist da aula.",
  },
  practice: {
    path: "/app/practice",
    eyebrow: "Prática guiada",
    title: "Terminal real e roteiro operacional",
    copy: "Use o cluster do aluno como ambiente principal da prática e siga o roteiro guiado passo a passo.",
  },
  workspace: {
    path: "/app/workspace",
    eyebrow: "Workspace",
    title: "Entrega declarativa e validação",
    copy: "Consolide o aprendizado no manifesto YAML, valide critérios e registre a evidência da aula.",
  },
  challenge: {
    path: "/app/challenge",
    eyebrow: "Desafio final",
    title: "Entrega avaliável da disciplina",
    copy: "Acompanhe o briefing do desafio, a rubrica de avaliação e abra rapidamente o encontro final da trilha.",
  },
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

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

const normalizeStudentPath = (pathname) => {
  if (!pathname || pathname === "/") {
    return "/app/overview";
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
};

const getStudentRouteKeyFromPath = (pathname) => {
  const normalizedPath = normalizeStudentPath(pathname);
  const entry = Object.entries(STUDENT_ROUTE_CONFIG).find(([, config]) => config.path === normalizedPath);
  return entry?.[0] || "overview";
};

const describeStudentSession = (student, cohort) => {
  if (!student?.name || !cohort?.title) {
    return null;
  }

  return `${student.name} em ${cohort.title}`;
};

const syncShellVisibility = () => {
  const isAuthenticated = Boolean(state.student?.id);
  elements.gateScreen.hidden = isAuthenticated;
  elements.appShell.hidden = !isAuthenticated;
  document.body.classList.toggle("gate-active", !isAuthenticated);
  document.body.classList.toggle("app-ready", isAuthenticated);
};

const TOAST_ICONS = {
  info: "ℹ️",
  success: "✅",
  warning: "⚠️",
  danger: "🚨",
};

const showToast = (message, tone = "info") => {
  const toast = document.createElement("article");
  toast.className = `toast toast-${tone}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <div class="toast-body">
      <strong>${TOAST_ICONS[tone] || "ℹ️"} ${FEEDBACK_TITLES[tone] || "Aviso"}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;

  elements.appAlerts.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 240);
  }, 4200);
};

const findMeetingByLabId = (labId) =>
  state.course?.meetings.find((meeting) => meeting.lab.id === labId) || null;

const getActiveSession = () =>
  state.course.meetings.find((meeting) => meeting.id === state.activeSessionId) ||
  state.course.meetings[0];

const getActiveLab = () => getActiveSession().lab;

const getActiveRuntimeSession = () => {
  const currentSession = state.runtime.session;
  const lab = getActiveLab();
  return currentSession && currentSession.labId === lab.id ? currentSession : null;
};

const getTerminalGuide = () => {
  const lab = getActiveLab();
  const guide = TERMINAL_GUIDES[lab.id];

  if (guide) {
    return guide;
  }

  return {
    intro:
      "Use o terminal para executar e inspecionar o lab no namespace do aluno. Quando terminar, consolide o resultado no manifesto declarativo.",
    steps: lab.commands.map((item, index) => ({
      title: `Passo ${index + 1}`,
      command: item.command,
      note: item.note,
    })),
  };
};

const getWorkflowGuide = () =>
  getActiveSession().id === "encontro-6" ? CHALLENGE_WORKFLOW : DEFAULT_WORKFLOW;

const getTaskKey = (sessionId, taskIndex) => `${sessionId}:${taskIndex}`;

const markTaskIndexesForSession = (sessionId, taskIndexes = []) => {
  taskIndexes.forEach((taskIndex) => {
    if (Number.isInteger(taskIndex) && taskIndex >= 0) {
      state.completedTasks[getTaskKey(sessionId, taskIndex)] = true;
    }
  });
};

const getCompletedTaskIndexes = (session) =>
  session.practiceTasks
    .map((_, index) => index)
    .filter((taskIndex) => Boolean(state.completedTasks[getTaskKey(session.id, taskIndex)]));

const isSessionPracticeComplete = (meeting) =>
  getCompletedTaskIndexes(meeting).length >= meeting.practiceTasks.length;

const resetLearningState = () => {
  state.drafts = {};
  state.completedTasks = {};
  state.validations = {};
  state.terminalLogs = {};
  state.workspaceUpdatedAt = {};
};

const clearCompletedTasksForSession = (sessionId) => {
  Object.keys(state.completedTasks).forEach((taskKey) => {
    if (taskKey.startsWith(`${sessionId}:`)) {
      delete state.completedTasks[taskKey];
    }
  });
};

const persistState = () => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      activeSessionId: state.activeSessionId,
      drafts: state.drafts,
      completedTasks: state.completedTasks,
      validations: state.validations,
      terminalLogs: state.terminalLogs,
      workspaceUpdatedAt: state.workspaceUpdatedAt,
      submissionCount: state.submissionCount,
      validatedLabs: state.validatedLabs,
      lastSyncedAt: state.lastSyncedAt,
      accessProfile: state.accessProfile,
    }),
  );
};

const loadPersistedState = () => {
  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY);

    if (!rawState) {
      return;
    }

    const persisted = JSON.parse(rawState);
    state.activeSessionId = persisted.activeSessionId || null;
    state.drafts = persisted.drafts || {};
    state.completedTasks = persisted.completedTasks || {};
    state.validations = persisted.validations || {};
    state.terminalLogs = persisted.terminalLogs || {};
    state.workspaceUpdatedAt = persisted.workspaceUpdatedAt || {};
    state.submissionCount = persisted.submissionCount || 0;
    state.validatedLabs = persisted.validatedLabs || 0;
    state.lastSyncedAt = persisted.lastSyncedAt || null;
    state.accessProfile = {
      email: persisted.accessProfile?.email || "",
      cohortCode: persisted.accessProfile?.cohortCode || "",
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
};

const setAccessStatus = (message, tone = "muted") => {
  state.accessStatus = { message, tone };
  renderFeedback(elements.accessStatus, message, tone);
};

const setEditorStatus = (message, tone = "muted") => {
  state.editorStatus = { message, tone };
  renderFeedback(elements.editorStatus, message, tone);
};

const setRuntimeStatus = (message, tone = "muted") => {
  state.runtime.status = { message, tone };
  renderFeedback(elements.runtimeStatus, message, tone);
};

const formatTimestamp = (value) => {
  if (!value) {
    return "aguardando primeira sincronizacao";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "aguardando primeira sincronizacao";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const formatClockTime = () =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

const calculateProgress = () => {
  const totalTasks = state.course.meetings.reduce(
    (sum, meeting) => sum + meeting.practiceTasks.length + 1,
    0,
  );

  const completedTasks = Object.values(state.completedTasks).filter(Boolean).length;
  const completedValidations = Object.values(state.validations).filter(
    (result) => result?.allPassed,
  ).length;
  const completed = completedTasks + completedValidations;
  const percentage = totalTasks === 0 ? 0 : Math.round((completed / totalTasks) * 100);

  return { totalTasks, completed, percentage };
};

const getSessionStatus = (meeting) => {
  const validation = state.validations[meeting.lab.id];
  const draft = (state.drafts[meeting.lab.id] || "").trim();
  const practiceComplete = isSessionPracticeComplete(meeting);

  if (validation?.allPassed && practiceComplete) {
    return { label: "Concluido", tone: "success" };
  }

  if (validation?.allPassed) {
    return { label: "Validado", tone: "success" };
  }

  if (draft && draft !== meeting.lab.starter.trim()) {
    return { label: "Rascunho", tone: "draft" };
  }

  return { label: "Planejado", tone: "neutral" };
};

const renderCapabilities = () => {
  elements.capabilityStrip.innerHTML = state.course.capabilities
    .map(
      (capability) => `
        <article class="capability-card">
          <p>${escapeHtml(capability)}</p>
        </article>
      `,
    )
    .join("");
};

const renderDashboardStrip = () => {
  const localValidated = Object.values(state.validations).filter(
    (result) => result?.allPassed,
  ).length;
  const cards = [
    {
      label: "Aluno",
      value: state.student?.name || "Modo local",
      note: state.student?.email || "Sem sessao persistente ativa",
    },
    {
      label: "Turma",
      value: state.cohort?.code ? state.cohort.code.toUpperCase() : "Nao vinculada",
      note: state.cohort?.title || "Identifique a turma para liberar trilha rastreavel",
    },
    {
      label: "Submissoes",
      value: String(state.submissionCount),
      note: "Cada validacao persistida gera evidencia avaliavel",
    },
    {
      label: "Labs validados",
      value: String(state.student?.id ? state.validatedLabs : localValidated),
      note: "Checklist aprovado por laboratorio",
    },
    {
      label: "Ultima sincronizacao",
      value: formatTimestamp(state.lastSyncedAt),
      note: "Base local + servidor do curso",
    },
  ];

  elements.dashboardStrip.innerHTML = cards
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

const renderTimeline = () => {
  elements.timeline.innerHTML = `
    <div class="timeline-list">
      ${state.course.meetings
        .map((meeting) => {
          const isActive = meeting.id === state.activeSessionId;
          const status = getSessionStatus(meeting);

          return `
            <button class="timeline-item ${isActive ? "active" : ""}" data-session-id="${meeting.id}" type="button">
              <div class="timeline-meta">
                <span class="timeline-order">${meeting.order}</span>
                <span class="timeline-status ${status.tone}">${escapeHtml(status.label)}</span>
              </div>
              <p class="timeline-title">${escapeHtml(meeting.title)}</p>
              <p class="timeline-duration">${escapeHtml(meeting.duration)}</p>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
};

const renderListCard = (container, eyebrow, title, description, items) => {
  container.innerHTML = `
    <p class="eyebrow">${escapeHtml(eyebrow)}</p>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(description)}</p>
    <ul>
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
};

const renderPracticeTasks = (session) => {
  const tasks = session.practiceTasks
    .map((task, index) => {
      const checked = Boolean(state.completedTasks[getTaskKey(session.id, index)]);

      return `
        <label class="task-item">
          <input type="checkbox" data-task-index="${index}" ${checked ? "checked" : ""} />
          <span>${escapeHtml(task)}</span>
        </label>
      `;
    })
    .join("");

  elements.practiceTasks.innerHTML = `
    <p class="eyebrow">Pratica da aula</p>
    <h3>Checklist de execucao</h3>
    <p>As tarefas abaixo ajudam a misturar teoria e pratica na ordem do encontro.</p>
    <div class="task-list">
      ${tasks}
    </div>
  `;
};

const currentEditorImage = () => {
  const source = elements.editor?.value || state.drafts[getActiveLab().id] || "";
  const match = source.match(/^\s*image:\s*([^\s]+)\s*$/m);
  return match?.[1] || "";
};

const describeValidationCheck = (item) => {
  if (item.label !== "Imagem nginx utilizada" || item.passed) {
    return item.details;
  }

  const image = currentEditorImage();
  if (!image) {
    return "Nenhuma imagem foi detectada no container principal. Use `image: nginx:stable` ou outra variante iniciando com `nginx`.";
  }

  return `Imagem atual detectada: \`${image}\`. Para este encontro a validacao aceita imagens iniciando com \`nginx\`, como \`nginx\`, \`nginx:stable\` ou \`nginx:latest\`. Se aparecer \`ngnix\`, e typo e precisa corrigir.`;
};

const renderValidation = (validation) => {
  if (!validation) {
    elements.validationSummary.className = "validation-summary";
    elements.validationSummary.textContent = "Nenhuma validacao executada ainda.";
    elements.validationResults.innerHTML =
      '<p class="empty-state">Envie o manifesto para ver os criterios atendidos.</p>';
    return;
  }

  elements.validationSummary.className = `validation-summary ${validation.allPassed ? "pass" : "fail"}`;
  elements.validationSummary.innerHTML = `
    <strong>${validation.score}% de aderencia</strong><br />
    ${validation.passedChecks}/${validation.totalChecks} criterios atendidos.
  `;

  elements.validationResults.innerHTML = `
    <div class="validation-list">
      ${validation.checks
        .map(
          (item) => `
            <article class="validation-item ${item.passed ? "pass" : "fail"}">
              <strong>${item.passed ? "OK" : "Pendente"}: ${escapeHtml(item.label)}</strong>
              <p>${escapeHtml(describeValidationCheck(item))}</p>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
};

const renderCommands = () => {
  const lab = getActiveLab();
  const guide = getTerminalGuide();
  const activeRuntimeSession = getActiveRuntimeSession();
  const log =
    state.terminalLogs[lab.id] ||
    "Nenhum passo registrado ainda. Use o roteiro ao lado para guiar a execucao do laboratorio.\n";

  elements.runbookIntro.textContent = guide.intro;

  elements.commandList.innerHTML = guide.steps
    .map(
      (item, index) => `
        <article class="command-step">
          <div class="command-step-header">
            <span class="command-step-index">Passo ${index + 1}</span>
            <button
              class="ghost-button button-compact"
              data-command-index="${index}"
              type="button"
            >
              ${activeRuntimeSession && state.runtime.connected ? "Enviar ao terminal" : "Registrar passo"}
            </button>
          </div>
          <h4>${escapeHtml(item.title)}</h4>
          <pre><code>${escapeHtml(item.command)}</code></pre>
          <p>${escapeHtml(item.note)}</p>
        </article>
      `,
    )
    .join("");

  elements.terminalLog.textContent = log;
};

const renderWorkflowGuide = () => {
  elements.workflowSteps.innerHTML = getWorkflowGuide()
    .map(
      (item, index) => `
        <article class="workflow-step">
          <span class="workflow-index">0${index + 1}</span>
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.note)}</p>
          </div>
        </article>
      `,
    )
    .join("");
};

const renderStudentNavigation = () => {
  if (!elements.studentNav) {
    return;
  }

  const links = Array.from(elements.studentNav.querySelectorAll("[data-app-route]"));
  links.forEach((link) => {
    link.classList.toggle("active", link.dataset.appRoute === state.routeKey);
  });
};

const renderStudentRoute = () => {
  const route = STUDENT_ROUTE_CONFIG[state.routeKey] || STUDENT_ROUTE_CONFIG.overview;
  elements.studentRouteEyebrow.textContent = route.eyebrow;
  elements.studentRouteTitle.textContent = route.title;
  elements.studentRouteCopy.textContent = route.copy;
  document.title = `KubeClass Web Lab · ${route.title}`;

  const cards = Array.from(document.querySelectorAll("[data-app-card]"));
  cards.forEach((card) => {
    const routes = (card.dataset.appCard || "").split(/\s+/).filter(Boolean);
    card.hidden = !routes.includes(state.routeKey);
  });
};

const setStudentRoute = (routeKey, { replace = false } = {}) => {
  const nextRoute = STUDENT_ROUTE_CONFIG[routeKey] ? routeKey : "overview";
  state.routeKey = nextRoute;

  const nextPath = STUDENT_ROUTE_CONFIG[nextRoute].path;
  if (normalizeStudentPath(window.location.pathname) !== nextPath) {
    const method = replace ? "replaceState" : "pushState";
    window.history[method]({}, "", nextPath);
  }

  renderStudentNavigation();
  renderStudentRoute();
};

const renderRuntimePanel = () => {
  const lab = getActiveLab();
  const activeSession = getActiveRuntimeSession();

  elements.openRuntimeButton.disabled = !state.student?.id;
  elements.openRuntimeButton.textContent =
    state.runtime.connected && activeSession ? "Reconectar terminal" : "Conectar terminal";

  if (!state.student?.id) {
    setRuntimeStatus(
      "Conecte um aluno para provisionar namespace, toolbox pod e terminal do lab.",
      "muted",
    );
    elements.runtimeMeta.innerHTML = `
      <article class="runtime-chip">
        <strong>Modo atual</strong>
        <span>Sem sessao persistente</span>
      </article>
    `;
    elements.runtimeContext.textContent =
      "O terminal usa um namespace isolado por aluno. Conecte a sessao academica para liberar a pratica real no cluster.";
    elements.terminalModeLabel.textContent = "Aguardando sessao";
    return;
  }

  if (!activeSession) {
    elements.runtimeMeta.innerHTML = `
      <article class="runtime-chip">
        <strong>Aluno</strong>
        <span>${escapeHtml(state.student.name)}</span>
      </article>
      <article class="runtime-chip">
        <strong>Lab ativo</strong>
        <span>${escapeHtml(lab.id)}</span>
      </article>
    `;
    elements.runtimeContext.textContent =
      "Abra o terminal para provisionar o namespace do aluno. O manifesto abaixo continua sendo o documento declarativo da entrega.";
    elements.terminalModeLabel.textContent = "Pronto para conectar";
    return;
  }

  elements.runtimeMeta.innerHTML = `
    <article class="runtime-chip">
      <strong>Namespace</strong>
      <span>${escapeHtml(activeSession.namespace)}</span>
    </article>
    <article class="runtime-chip">
      <strong>Toolbox pod</strong>
      <span>${escapeHtml(activeSession.podName)}</span>
    </article>
    <article class="runtime-chip">
      <strong>Shell</strong>
      <span>${escapeHtml(activeSession.shell)}</span>
    </article>
  `;
  elements.runtimeContext.textContent =
    "Este shell ja esta apontado para o namespace isolado do aluno. Use o terminal para operar o lab e o editor para registrar a entrega declarativa.";
  elements.terminalModeLabel.textContent = state.runtime.connected
    ? "Terminal conectado"
    : "Sessao provisionada";
};

const renderHeader = () => {
  const progress = calculateProgress();
  const isConnected = Boolean(state.student?.id);
  const formatText = `${state.course.format.totalMeetings} encontros de ${state.course.format.durationPerMeeting}`;

  elements.heroDescription.textContent = state.course.description;
  elements.gateDescription.textContent = state.course.description;
  elements.courseFormat.textContent = formatText;
  elements.gateCourseFormat.textContent = formatText;
  elements.courseModel.textContent = state.course.format.model;
  elements.gateCourseModel.textContent = state.course.format.model;
  elements.progressLabel.textContent = `${progress.percentage}%`;
  elements.progressFill.style.width = `${progress.percentage}%`;

  elements.connectionPill.textContent = isConnected ? "Sessao persistente" : "Modo local";
  elements.connectionPill.className = `mode-pill ${isConnected ? "connected" : "local"}`;

  elements.learnerName.textContent = isConnected
    ? state.student.name
    : "Nenhum aluno conectado";
  elements.learnerMeta.textContent = isConnected
    ? `${state.student.email} • ${state.cohort.title}`
    : "Identifique um aluno e uma turma para registrar rascunhos, progresso e submissões no servidor.";
  elements.sessionCohortBadge.textContent = isConnected
    ? `${state.cohort.code.toUpperCase()} • ${state.cohort.title}`
    : "-";

  elements.accessSubmitButton.textContent = isConnected ? "Sessao ativa" : "Entrar no ambiente";
  elements.accessEmail.value = state.accessProfile.email;
  elements.accessCohort.value = state.accessProfile.cohortCode;

  setAccessStatus(state.accessStatus.message, state.accessStatus.tone);
  setEditorStatus(state.editorStatus.message, state.editorStatus.tone);
  setRuntimeStatus(state.runtime.status.message, state.runtime.status.tone);
};

const renderSessionDetails = () => {
  const session = getActiveSession();
  const lab = session.lab;
  const validation = state.validations[lab.id];
  const hasDraft = Boolean((state.drafts[lab.id] || "").trim());
  const updatedAt = state.workspaceUpdatedAt[lab.id];

  elements.sessionOrder.textContent = `Encontro ${session.order}`;
  elements.sessionTitle.textContent = session.title;
  elements.sessionDuration.textContent = session.duration;

  renderListCard(
    elements.sessionFocus,
    "Foco do encontro",
    "Objetivo pedagogico",
    session.focus,
    session.deliverables,
  );

  renderListCard(
    elements.sessionDeliverables,
    "Entrega esperada",
    "O que o aluno precisa sair sabendo",
    "Cada encontro termina com artefatos concretos para consolidar a pratica.",
    session.deliverables,
  );

  renderListCard(
    elements.theoryTopics,
    "Bloco teorico",
    "2h de teoria orientada",
    "Conceitos em ordem cronologica para preparar a parte pratica.",
    session.theoryTopics,
  );

  renderPracticeTasks(session);

  elements.labTitle.textContent = lab.title;
  elements.labScenario.textContent = lab.scenario;

  renderListCard(
    elements.labObjectives,
    "Objetivos do lab",
    "O que deve ser validado",
    "A validacao automatica confere estes pontos.",
    lab.objectives,
  );

  renderListCard(
    elements.labHints,
    "Dicas",
    "Como orientar o aluno sem entregar a resposta",
    "Use estas pistas quando a turma travar na pratica.",
    lab.hints,
  );

  elements.challengeBriefCopy.textContent = state.course.challenge.scenario;

  if (session.id === "encontro-6" || state.routeKey === "challenge") {
    elements.challengeRubric.classList.add("visible");
    elements.challengeRubric.innerHTML = `
      <p class="eyebrow">Rubrica do desafio</p>
      <h3>Distribuicao da nota final</h3>
      <p>${escapeHtml(state.course.challenge.scenario)}</p>
      <div class="rubric-grid">
        ${state.course.challenge.rubric
          .map(
            (item) => `
              <article class="rubric-item">
                <span class="eyebrow">Peso</span>
                <strong>${item.weight}%</strong>
                <p>${escapeHtml(item.label)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  } else {
    elements.challengeRubric.classList.remove("visible");
    elements.challengeRubric.innerHTML = "";
  }

  elements.editor.value = state.drafts[lab.id] || lab.starter;
  elements.editorCallout.textContent = `${DEFAULT_EDITOR_CALLOUT} Estrutura esperada: ${lab.title}.`;
  renderValidation(validation);
  renderCommands();
  renderRuntimePanel();
  renderWorkflowGuide();

  if (validation?.allPassed && isSessionPracticeComplete(session)) {
    setEditorStatus(
      "Encontro concluido: pratica guiada registrada e manifesto validado com sucesso.",
      "success",
    );
  } else if (updatedAt) {
    setEditorStatus(`Workspace sincronizado em ${formatTimestamp(updatedAt)}.`, "success");
  } else if (validation && !validation.allPassed) {
    setEditorStatus(
      "A entrega ainda tem pendencias. Corrija os erros do template e rode a validacao novamente.",
      "warning",
    );
  } else if (!hasDraft || (state.drafts[lab.id] || lab.starter) === lab.starter) {
    setEditorStatus(
      "Template carregado com pequenos erros intencionais para a turma corrigir.",
      "warning",
    );
  }
};

const render = () => {
  renderHeader();
  syncShellVisibility();
  renderStudentNavigation();
  renderStudentRoute();
  renderDashboardStrip();
  renderCapabilities();
  renderTimeline();
  renderSessionDetails();
  persistState();
};

const markWorkspaceDirty = (message) => {
  setEditorStatus(message, "muted");
  persistState();
};

const setActiveSession = (sessionId) => {
  const nextSession = state.course.meetings.find((meeting) => meeting.id === sessionId);
  if (nextSession && state.runtime.session && state.runtime.session.labId !== nextSession.lab.id) {
    disconnectRuntimeTerminal("Terminal encerrado ao trocar de modulo.");
  }
  state.activeSessionId = sessionId;
  render();
};

const handleTaskToggle = (taskIndex, checked) => {
  const session = getActiveSession();
  state.completedTasks[getTaskKey(session.id, Number(taskIndex))] = checked;
  renderHeader();
  renderDashboardStrip();
  renderTimeline();
  markWorkspaceDirty("Checklist alterado. Salve ou valide para sincronizar no servidor.");
};

const appendTerminalJournal = (heading, command, note) => {
  const lab = getActiveLab();
  const previousLog = state.terminalLogs[lab.id] || "";
  const nextLog = `${previousLog}[${formatClockTime()}] ${heading}\n$ ${command}\n# ${note}\n\n`;

  state.terminalLogs[lab.id] = nextLog;
  elements.terminalLog.textContent = nextLog;
};

const isStreamingGuideStep = (step) =>
  Boolean(step?.longRunning) || GUIDE_STREAM_PATTERN.test(step?.command || "");

const sendRuntimeInput = (data) => {
  if (!state.runtime.socket || state.runtime.socket.readyState !== WebSocket.OPEN) {
    throw new Error("Abra o terminal real antes de enviar passos do roteiro.");
  }

  state.runtime.socket.send(JSON.stringify({ type: "input", data }));
};

const sendCommandToRuntime = (command, options = {}) => {
  const payload = command.endsWith("\n") ? command : `${command}\n`;
  sendRuntimeInput(payload);
  state.runtime.activeStreamingCommand = options.streaming ? command : null;
  state.runtime.term.focus();
};

const interruptRuntimeStreamingCommand = async () => {
  if (!state.runtime.activeStreamingCommand) {
    return;
  }

  sendRuntimeInput("\u0003");
  state.runtime.activeStreamingCommand = null;
  await delay(180);
};

const handleCommandAction = async (commandIndex) => {
  const guide = getTerminalGuide();
  const selected = guide.steps[Number(commandIndex)];

  if (!selected) {
    return;
  }

  const activeRuntimeSession = getActiveRuntimeSession();

  if (activeRuntimeSession && state.runtime.connected) {
    try {
      const willInterruptPrevious = Boolean(state.runtime.activeStreamingCommand);

      if (willInterruptPrevious) {
        await interruptRuntimeStreamingCommand();
      }

      sendCommandToRuntime(selected.command, { streaming: isStreamingGuideStep(selected) });
      markTaskIndexesForSession(getActiveSession().id, selected.taskIndexes || []);
      appendTerminalJournal("Passo enviado ao terminal", selected.command, selected.note);
      setRuntimeStatus(
        willInterruptPrevious
          ? `Comando anterior interrompido. Passo enviado: ${selected.title}.`
          : `Passo enviado: ${selected.title}.`,
        "success",
      );
      elements.terminalModeLabel.textContent = isStreamingGuideStep(selected)
        ? "Acompanhando no terminal"
        : "Executando no terminal";
      if (willInterruptPrevious) {
        showToast("O comando anterior foi interrompido para executar o proximo passo guiado.", "info");
      }
      renderPracticeTasks(getActiveSession());
      renderTimeline();
      renderHeader();
      renderDashboardStrip();
      markWorkspaceDirty("Roteiro de terminal atualizado no diario do lab.");
    } catch (error) {
      setRuntimeStatus(
        normalizeErrorMessage(error, "Nao foi possivel enviar o passo guiado ao terminal."),
        "danger",
      );
    }
    return;
  }

  appendTerminalJournal("Passo preparado", selected.command, selected.note);
  setRuntimeStatus(
    "O passo foi registrado no diario do lab. Abra o terminal real para executar o roteiro.",
    "muted",
  );
  markWorkspaceDirty("Passo registrado localmente. Abra o terminal para executar no cluster.");
};

const clearTerminalView = () => {
  if (state.runtime.term) {
    state.runtime.term.clear();
    state.runtime.term.focus();
  }

  setRuntimeStatus(state.runtime.status.message, state.runtime.status.tone);
};

const parseJSONResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Falha ao processar requisicao.");
  }

  return payload;
};

const fetchJSON = async (url, options) => {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
  });
  return parseJSONResponse(response);
};

const syncStateFromDashboard = (dashboard) => {
  if (state.studentId && dashboard.student?.id && dashboard.student.id !== state.studentId) {
    resetLearningState();
    disconnectRuntimeTerminal("Terminal encerrado porque a sessao do aluno mudou.");
  }

  state.studentId = dashboard.student?.id || null;
  state.student = dashboard.student || null;
  state.cohort = dashboard.cohort || null;
  state.submissionCount = dashboard.submissionCount || 0;
  state.validatedLabs = dashboard.validatedLabs || 0;
  state.lastSyncedAt = new Date().toISOString();
  state.accessProfile = {
    email: dashboard.student?.email || "",
    cohortCode: dashboard.cohort?.code || "",
  };

  Object.values(dashboard.workspaces || {}).forEach((workspace) => {
    const meeting = findMeetingByLabId(workspace.labId);

    if (meeting) {
      clearCompletedTasksForSession(workspace.sessionId || meeting.id);
    }

    state.drafts[workspace.labId] = workspace.solution || "";
    state.terminalLogs[workspace.labId] = workspace.terminalLog || "";
    state.workspaceUpdatedAt[workspace.labId] = workspace.updatedAt || null;

    if (workspace.validation) {
      if (typeof workspace.validation === "string") {
        try {
          state.validations[workspace.labId] = JSON.parse(workspace.validation);
        } catch {
          state.validations[workspace.labId] = null;
        }
      } else {
        state.validations[workspace.labId] = workspace.validation;
      }
    } else {
      state.validations[workspace.labId] = null;
    }

    if (meeting) {
      (workspace.completedTaskIndexes || []).forEach((taskIndex) => {
        state.completedTasks[getTaskKey(workspace.sessionId || meeting.id, taskIndex)] =
          true;
      });
    }
  });

  persistState();
};

const ensureTerminalInstance = () => {
  if (state.runtime.term) {
    return state.runtime.term;
  }

  if (!window.Terminal || !window.FitAddon) {
    throw new Error("xterm.js nao foi carregado no navegador.");
  }

  const term = new window.Terminal({
    cursorBlink: true,
    convertEol: true,
    fontFamily: "IBM Plex Mono, Cascadia Code, monospace",
    fontSize: 14,
    lineHeight: 1.25,
    scrollback: 4000,
    theme: {
      background: "#050e1a",
      foreground: "#e6f5ff",
      cursor: "#ffb454",
      selectionBackground: "rgba(68, 168, 255, 0.22)",
    },
  });
  const fitAddon = new window.FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(elements.terminalShell);
  fitAddon.fit();
  term.focus();
  term.writeln("KubeClass runtime pronto. Conecte o terminal e use o roteiro de execucao ao lado.");

  term.onData((data) => {
    if (!state.runtime.socket || state.runtime.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (data === "\u0003") {
      state.runtime.activeStreamingCommand = null;
    }

    state.runtime.socket.send(JSON.stringify({ type: "input", data }));
  });

  term.onResize(({ cols, rows }) => {
    if (!state.runtime.socket || state.runtime.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    state.runtime.socket.send(JSON.stringify({ type: "resize", cols, rows }));
  });

  window.addEventListener("resize", () => {
    if (!state.runtime.fitAddon) {
      return;
    }

    state.runtime.fitAddon.fit();
  });

  elements.terminalShell.addEventListener("click", () => {
    if (state.runtime.term) {
      state.runtime.term.focus();
    }
  });

  state.runtime.term = term;
  state.runtime.fitAddon = fitAddon;
  return term;
};

const disconnectRuntimeTerminal = (message) => {
  if (state.runtime.socket) {
    state.runtime.socket.close();
    state.runtime.socket = null;
  }

  state.runtime.connected = false;
  state.runtime.session = null;
  state.runtime.activeStreamingCommand = null;
  elements.terminalModeLabel.textContent = "Sem sessao ativa";
  if (message) {
    setRuntimeStatus(message, "muted");
  }
};

const clearStudentSession = (message, tone = "muted", preserveAccessProfile = false) => {
  disconnectRuntimeTerminal("Terminal encerrado porque a sessao do aluno foi finalizada.");
  resetLearningState();
  state.studentId = null;
  state.student = null;
  state.cohort = null;
  state.submissionCount = 0;
  state.validatedLabs = 0;
  state.lastSyncedAt = null;
  if (!preserveAccessProfile) {
    state.accessProfile = {
      email: "",
      cohortCode: "",
    };
  }
  setAccessStatus(message, tone);
  setEditorStatus(
    "Entre com e-mail, senha e codigo da turma para liberar o editor e o terminal do laboratorio.",
    "muted",
  );
  setRuntimeStatus(
    "Valide a sessao academica para provisionar namespace, toolbox pod e shell do laboratorio.",
    "muted",
  );
  render();
};

const terminalWebSocketURL = (labId) => {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const params = new URLSearchParams({ labId });
  return `${protocol}://${window.location.host}/api/terminal/ws?${params.toString()}`;
};

const openRuntimeTerminal = async () => {
  if (!state.student?.id) {
    throw new Error("Conecte um aluno antes de abrir o terminal real.");
  }

  const lab = getActiveLab();
  setRuntimeStatus("Provisionando namespace e toolbox pod do lab...", "muted");

  const session = await fetchJSON("/api/runtime/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      labId: lab.id,
    }),
  });

  if (!session.enabled) {
    throw new Error(session.note || "Runtime real indisponivel.");
  }

  state.runtime.session = session;
  const term = ensureTerminalInstance();
  disconnectRuntimeTerminal();
  state.runtime.session = session;
  state.runtime.activeStreamingCommand = null;
  term.reset();
  term.focus();
  term.writeln(`KubeClass runtime conectado ao namespace ${session.namespace}`);
  term.writeln("O kubectl ja usa o namespace do aluno. Execute o roteiro ao lado e use exit apenas para encerrar a shell.");

  const socket = new WebSocket(terminalWebSocketURL(lab.id));
  state.runtime.socket = socket;

  socket.addEventListener("open", () => {
    state.runtime.connected = true;
    markTaskIndexesForSession(getActiveSession().id, getTerminalGuide().runtimeTaskIndexes || []);
    setRuntimeStatus(session.note, "success");
    showToast(`Terminal conectado ao namespace ${session.namespace}.`, "success");
    elements.terminalModeLabel.textContent = "Terminal conectado";
    renderRuntimePanel();
    renderCommands();
    renderPracticeTasks(getActiveSession());
    renderTimeline();
    renderHeader();
    renderDashboardStrip();
    state.runtime.term.focus();

    if (state.runtime.fitAddon) {
      state.runtime.fitAddon.fit();
      socket.send(
        JSON.stringify({
          type: "resize",
          cols: state.runtime.term.cols,
          rows: state.runtime.term.rows,
        }),
      );
    }
  });

  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "output" || message.type === "status") {
        state.runtime.term.write(message.data);
        if (typeof message.data === "string" && /(?:^|\r?\n)[^\r\n]*[$#] $/m.test(message.data)) {
          state.runtime.activeStreamingCommand = null;
        }
      }
    } catch {
      state.runtime.term.write(event.data);
    }
  });

  socket.addEventListener("close", () => {
    state.runtime.connected = false;
    state.runtime.activeStreamingCommand = null;
    setRuntimeStatus("Conexao do terminal encerrada. Voce pode abrir novamente a sessao do lab.", "muted");
    elements.terminalModeLabel.textContent = "Sessao provisionada";
    renderRuntimePanel();
    renderCommands();
  });

  socket.addEventListener("error", () => {
    state.runtime.connected = false;
    state.runtime.activeStreamingCommand = null;
    setRuntimeStatus("Falha no WebSocket do terminal real.", "danger");
    showToast("Falha ao conectar o terminal real do laboratorio.", "danger");
    elements.terminalModeLabel.textContent = "Falha de conexao";
    renderRuntimePanel();
    renderCommands();
  });
};

const refreshDashboard = async () => {
  if (!state.student?.id) {
    return;
  }

  const dashboard = await fetchJSON("/api/dashboard");
  syncStateFromDashboard(dashboard);
  return dashboard;
};

const saveCurrentWorkspace = async () => {
  const session = getActiveSession();
  const lab = session.lab;
  const solution = elements.editor.value;

  state.drafts[lab.id] = solution;
  persistState();

  if (!state.student?.id) {
    setEditorStatus(
      "Rascunho salvo apenas no navegador. Entre com a turma para persistir no servidor.",
      "muted",
    );
    showToast("Rascunho salvo apenas localmente.", "info");
    return;
  }

  const dashboard = await fetchJSON("/api/workspaces/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      labId: lab.id,
      sessionId: session.id,
      solution,
      terminalLog: state.terminalLogs[lab.id] || "",
      validation: state.validations[lab.id] || null,
      completedTaskIndexes: getCompletedTaskIndexes(session),
    }),
  });

  syncStateFromDashboard(dashboard);
  setEditorStatus(
    `Workspace sincronizado com a turma ${state.cohort.code.toUpperCase()}.`,
    "success",
  );
  showToast("Rascunho salvo no servidor da turma.", "success");
  render();
};

const validateCurrentSolution = async () => {
  const session = getActiveSession();
  const lab = session.lab;
  const solution = elements.editor.value;

  state.drafts[lab.id] = solution;

  const result = await fetchJSON("/api/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      labId: lab.validationId,
      solution,
      sessionId: session.id,
      terminalLog: state.terminalLogs[lab.id] || "",
      completedTaskIndexes: getCompletedTaskIndexes(session),
    }),
  });

  state.validations[lab.id] = result;
  renderValidation(result);
  renderTimeline();
  renderHeader();
  renderDashboardStrip();
  persistState();

  if (result.persisted && state.student?.id) {
    await refreshDashboard();
    render();
    setEditorStatus("Validacao registrada e submissao salva no servidor.", "success");
    setAccessStatus(
      `Sessao ativa para ${state.student.name} em ${state.cohort.title}.`,
      "success",
    );
    showToast(
      result.allPassed
        ? "Entrega validada e registrada com todos os criterios atendidos."
        : "Entrega registrada, mas ainda existem criterios pendentes.",
      result.allPassed ? "success" : "warning",
    );
    return;
  }

  setEditorStatus("Validacao concluida localmente. Conecte o aluno para registrar a entrega.", "muted");
  showToast(
    result.allPassed
      ? "Validacao concluida localmente com todos os criterios atendidos."
      : "Validacao concluida localmente com pendencias para corrigir.",
    result.allPassed ? "success" : "warning",
  );
};

const attachEventListeners = () => {
  elements.accessForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    state.accessProfile = {
      email: elements.accessEmail.value.trim(),
      cohortCode: elements.accessCohort.value.trim(),
    };

    const requiredMessage = buildRequiredMessage([
      [elements.accessEmail, "e-mail"],
      [elements.accessPassword, "senha"],
      [elements.accessCohort, "codigo da turma"],
    ]);

    if (requiredMessage) {
      setAccessStatus(requiredMessage, "warning");
      showToast(requiredMessage, "warning");
      return;
    }

    elements.accessSubmitButton.disabled = true;
    setAccessStatus("Validando credenciais da turma...", "muted");

    try {
      const dashboard = await fetchJSON("/api/auth/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: state.accessProfile.email,
          password: elements.accessPassword.value,
          cohortCode: state.accessProfile.cohortCode,
        }),
      });

      syncStateFromDashboard(dashboard);
      const sessionLabel = describeStudentSession(dashboard.student, dashboard.cohort);
      if (!sessionLabel) {
        throw new Error(
          "A autenticacao foi concluida, mas os dados do aluno ou da turma nao chegaram completos. Tente entrar novamente.",
        );
      }
      elements.accessPassword.value = "";
      setAccessStatus(`Sessao ativa para ${sessionLabel}.`, "success");
      setEditorStatus(
        "Workspace conectado. Use salvar ou validar para registrar evidencias da aula.",
        "success",
      );
      showToast(
        `Entrada liberada para ${dashboard.student.name} na turma ${dashboard.cohort.code.toUpperCase()}.`,
        "success",
      );
      render();
      setStudentRoute(state.routeKey, { replace: true });
    } catch (error) {
      const message = normalizeErrorMessage(
        error,
        "Nao foi possivel autenticar sua sessao de laboratorio. Revise e-mail, senha e codigo da turma.",
      );
      setAccessStatus(message, "danger");
      showToast(message, "danger");
    } finally {
      elements.accessSubmitButton.disabled = false;
    }
  });

  [elements.accessEmail, elements.accessCohort].forEach((input) => {
    input.addEventListener("input", () => {
      state.accessProfile = {
        email: elements.accessEmail.value,
        cohortCode: elements.accessCohort.value,
      };
      persistState();
    });
  });

  elements.studentNav?.addEventListener("click", (event) => {
    const link = event.target.closest("[data-app-route]");
    if (!link) {
      return;
    }

    event.preventDefault();
    setStudentRoute(link.dataset.appRoute);
  });

  window.addEventListener("popstate", () => {
    setStudentRoute(getStudentRouteKeyFromPath(window.location.pathname), { replace: true });
  });

  elements.timeline.addEventListener("click", (event) => {
    const button = event.target.closest("[data-session-id]");

    if (!button) {
      return;
    }

    setActiveSession(button.dataset.sessionId);
  });

  elements.practiceTasks.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.dataset.taskIndex) {
      handleTaskToggle(event.target.dataset.taskIndex, event.target.checked);
    }
  });

  elements.editor.addEventListener("input", () => {
    const lab = getActiveLab();
    state.drafts[lab.id] = elements.editor.value;
    markWorkspaceDirty("Edicao local em andamento. Salve ou valide para sincronizar.");
  });

  elements.commandList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-command-index]");

    if (!button) {
      return;
    }

    handleCommandAction(button.dataset.commandIndex);
  });

  elements.loadTemplateButton.addEventListener("click", () => {
    const lab = getActiveLab();
    state.drafts[lab.id] = lab.starter;
    elements.editor.value = lab.starter;
    markWorkspaceDirty("Template recarregado para o laboratorio atual.");
  });

  elements.resetButton.addEventListener("click", () => {
    const lab = getActiveLab();
    const restoredValue = state.drafts[lab.id] || lab.starter;
    elements.editor.value = restoredValue;
    setEditorStatus("Rascunho restaurado no editor.", "muted");
  });

  elements.saveWorkspaceButton.addEventListener("click", async () => {
    elements.saveWorkspaceButton.disabled = true;
    elements.saveWorkspaceButton.textContent = "Salvando...";

    try {
      await saveCurrentWorkspace();
    } catch (error) {
      const message = normalizeErrorMessage(error, "Nao foi possivel salvar o rascunho agora.");
      setEditorStatus(message, "danger");
      showToast(message, "danger");
    } finally {
      elements.saveWorkspaceButton.disabled = false;
      elements.saveWorkspaceButton.textContent = "Salvar rascunho";
    }
  });

  elements.validateButton.addEventListener("click", async () => {
    elements.validateButton.disabled = true;
    elements.validateButton.textContent = "Validando...";

    try {
      await validateCurrentSolution();
    } catch (error) {
      const message = normalizeErrorMessage(error, "Nao foi possivel validar a entrega agora.");
      setEditorStatus(message, "danger");
      showToast(message, "danger");
    } finally {
      elements.validateButton.disabled = false;
      elements.validateButton.textContent = "Validar entrega";
    }
  });

  elements.openRuntimeButton.addEventListener("click", async () => {
    elements.openRuntimeButton.disabled = true;
    elements.openRuntimeButton.textContent = "Abrindo...";

    try {
      await openRuntimeTerminal();
    } catch (error) {
      const message = normalizeErrorMessage(
        error,
        "Nao foi possivel abrir o terminal real do laboratorio agora.",
      );
      setRuntimeStatus(message, "danger");
      showToast(message, "danger");
      renderRuntimePanel();
    } finally {
      elements.openRuntimeButton.disabled = !state.student?.id;
      elements.openRuntimeButton.textContent =
        state.runtime.connected ? "Reconectar terminal" : "Conectar terminal";
    }
  });

  elements.clearTerminalButton.addEventListener("click", () => {
    clearTerminalView();
  });

  elements.challengeOpenButton.addEventListener("click", () => {
    setActiveSession("encontro-6");
    setStudentRoute("challenge");
    showToast("Encontro final aberto para revisão do desafio.", "info");
  });

  elements.logoutButton.addEventListener("click", async () => {
    try {
      await fetchJSON("/api/auth/logout", { method: "POST" });
    } catch {
      // A limpeza local ainda precisa ocorrer se o cookie remoto falhar.
    }

    clearStudentSession(
      "Sessao encerrada. Informe e-mail, senha e codigo da turma para liberar um novo ambiente.",
      "muted",
    );
    showToast("Sessao do aluno encerrada.", "info");
  });
};

const initialize = async () => {
  loadPersistedState();
  state.routeKey = getStudentRouteKeyFromPath(window.location.pathname);

  try {
    state.course = await fetchJSON("/api/course");
  } catch (error) {
    elements.heroDescription.textContent = normalizeErrorMessage(
      error,
      "Nao foi possivel carregar o curso agora.",
    );
    setAccessStatus("Nao foi possivel carregar o curso.", "danger");
    return;
  }

  state.activeSessionId = state.activeSessionId || state.course.meetings[0].id;

  try {
    const auth = await fetchJSON("/api/auth/status");

    if (auth.authenticated && auth.role === "student") {
      await refreshDashboard();
      const sessionLabel = describeStudentSession(state.student, state.cohort);
      if (!sessionLabel) {
        throw new Error(
          "A plataforma encontrou uma sessao de aluno, mas os dados dela nao foram restaurados corretamente.",
        );
      }
      setAccessStatus(`Sessao restaurada para ${sessionLabel}.`, "success");
      setEditorStatus("Dados do aluno recarregados do servidor.", "success");
      showToast(`Sessao restaurada para ${state.student.name}.`, "success");
      setStudentRoute(state.routeKey, { replace: true });
    } else if (auth.authenticated && auth.role === "admin") {
      clearStudentSession(
        "Sessao administrativa detectada. Saia do painel admin para entrar como aluno.",
        "warning",
        true,
      );
    } else if (auth.adminSetupRequired) {
      clearStudentSession(
        "O instrutor ainda nao configurou o primeiro acesso administrativo nem cadastrou alunos.",
        "warning",
        true,
      );
    } else {
      clearStudentSession(
        "Entre com e-mail, senha e codigo da turma cadastrados pelo instrutor.",
        "muted",
        true,
      );
    }
  } catch (error) {
    const message = normalizeErrorMessage(
      error,
      "Nao foi possivel validar a sessao atual. Tente atualizar a pagina ou entrar novamente.",
    );
    clearStudentSession(
      message,
      "danger",
      true,
    );
  }

  render();
  if (state.student?.id) {
    setStudentRoute(state.routeKey, { replace: true });
  }
  attachEventListeners();
};

initialize();
