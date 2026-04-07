const STORAGE_KEY = "kubeclass-web-lab-state-v2";
const DEFAULT_EDITOR_CALLOUT =
  "Este template vem com pequenos erros intencionais. O objetivo do aluno e identificar, corrigir e so entao enviar para validacao.";

const TERMINAL_GUIDES = {
  "lab-1": {
    intro:
      "A Unidade I nao roda no cluster da plataforma. Execute os passos abaixo no seu computador com WSL, Docker, Kind e kubectl, e use o editor apenas para consolidar o manifesto final do Pod.",
    steps: [
      {
        title: "Validar o ambiente Linux",
        command: "uname -a",
        note: "Confirma que o shell aberto no computador do aluno esta em ambiente Linux/WSL.",
        taskIndexes: [0],
        runMode: "local",
      },
      {
        title: "Conferir Docker no WSL",
        command: "docker --version\ndocker ps",
        note: "Valida se o Docker Desktop esta integrado ao WSL e respondendo corretamente.",
        taskIndexes: [0],
        runMode: "local",
      },
      {
        title: "Instalar e verificar o Kind",
        command: "curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64\nchmod +x ./kind\nsudo mv ./kind /usr/local/bin/kind\nkind --version",
        note: "Segue o fluxo da pratica para instalar o Kind no computador do aluno.",
        taskIndexes: [0],
        runMode: "local",
      },
      {
        title: "Instalar e verificar o kubectl",
        command:
          "curl -LO \"https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl\"\nchmod +x kubectl\nsudo mv kubectl /usr/local/bin/\nkubectl version --client",
        note: "Instala o cliente kubectl usado em toda a trilha pratica.",
        taskIndexes: [0],
        runMode: "local",
      },
      {
        title: "Criar o cluster local",
        command: "kind create cluster --name dev-cluster",
        note: "Provisiona o cluster Kind usado nesta unidade introdutoria.",
        taskIndexes: [1],
        runMode: "local",
      },
      {
        title: "Inspecionar nodes e pods do sistema",
        command: "kubectl get nodes\nkubectl get pods -A",
        note: "Confere o node Ready e os componentes nativos do Kubernetes no cluster local.",
        taskIndexes: [1, 2],
        runMode: "local",
      },
      {
        title: "Criar e inspecionar o primeiro Pod",
        command: "kubectl run nginx --image=nginx\nkubectl get pods\nkubectl describe pod nginx\nkubectl logs nginx",
        note: "Executa o fluxo imperativo da pratica antes de consolidar o YAML.",
        taskIndexes: [3],
        runMode: "local",
      },
      {
        title: "Aplicar o manifesto final do Pod",
        command: "cat > nginx.yaml <<'EOF'\napiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx-yaml\nspec:\n  containers:\n    - name: nginx\n      image: nginx\n      ports:\n        - containerPort: 80\nEOF\nkubectl apply -f nginx.yaml",
        note: "Fecha a pratica com o manifesto declarativo que tambem sera consolidado no editor da plataforma.",
        taskIndexes: [4],
        runMode: "local",
      },
      {
        title: "Limpar o ambiente local",
        command: "kubectl delete pod nginx\nkubectl delete -f nginx.yaml\nkind delete cluster --name dev-cluster",
        note: "Etapa opcional de limpeza ao final da atividade no computador do aluno.",
        runMode: "local",
      },
    ],
  },
  "lab-2": {
    runtimeTaskIndexes: [0],
    intro:
      "A Unidade II usa o terminal real como trilha principal para subir o workload gerenciado, expor a aplicacao e revisar probes antes de consolidar o manifesto final.",
    steps: [
      {
        title: "Aplicar o Deployment base",
        command: "cat <<'EOF' | kubectl apply -f -\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app-web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: nginx\n          image: nginx:latest\n          ports:\n            - containerPort: 80\nEOF",
        note: "Cria a aplicacao gerenciada por Deployment com 3 replicas.",
        taskIndexes: [1],
      },
      {
        title: "Criar o Service interno",
        command: "cat <<'EOF' | kubectl apply -f -\napiVersion: v1\nkind: Service\nmetadata:\n  name: web-service\nspec:\n  type: ClusterIP\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 80\nEOF",
        note: "Entrega a conectividade interna entre os Pods da aplicacao.",
        taskIndexes: [1],
      },
      {
        title: "Publicar o NodePort da pratica",
        command: "cat <<'EOF' | kubectl apply -f -\napiVersion: v1\nkind: Service\nmetadata:\n  name: web-nodeport\nspec:\n  type: NodePort\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 80\n      nodePort: 30080\nEOF",
        note: "Exponha a aplicacao com NodePort 30080 para o contexto de laboratorio.",
        taskIndexes: [2],
      },
      {
        title: "Atualizar o Deployment com probes",
        command: "cat <<'EOF' | kubectl apply -f -\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app-web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: nginx\n          image: nginx:latest\n          ports:\n            - containerPort: 80\n          readinessProbe:\n            httpGet:\n              path: /\n              port: 80\n            initialDelaySeconds: 5\n            periodSeconds: 10\n          livenessProbe:\n            httpGet:\n              path: /\n              port: 80\n            initialDelaySeconds: 5\n            periodSeconds: 10\nEOF",
        note: "Adiciona readiness e liveness ao container principal do workload.",
        taskIndexes: [3],
      },
      {
        title: "Inspecionar rollout e recursos",
        command: "kubectl rollout status deployment/app-web\nkubectl get deployments,pods,svc",
        note: "Revisa o estado final antes de consolidar o YAML no editor.",
        taskIndexes: [4],
      },
    ],
  },
  "lab-3": {
    runtimeTaskIndexes: [0],
    intro:
      "No runtime da Unidade III o namespace do aluno ja existe. Use-o como equivalente operacional do namespace `laboratorio` e foque em configuracao externa, organizacao e service discovery.",
    steps: [
      {
        title: "Criar o ConfigMap da aplicacao",
        command:
          "kubectl create configmap app-config --from-literal=APP_MODE=producao --from-literal=APP_PORT=80 --from-literal=APP_COLOR=blue",
        note: "Externaliza as configuracoes do workload sem alterar a imagem.",
        taskIndexes: [1],
      },
      {
        title: "Criar o Secret com credenciais",
        command:
          "kubectl create secret generic app-secret --from-literal=APP_USER=admin --from-literal=APP_PASSWORD=123456",
        note: "Armazena os dados sensiveis da aplicacao em recurso dedicado.",
        taskIndexes: [1],
      },
      {
        title: "Aplicar o Deployment organizado",
        command: "cat <<'EOF' | kubectl apply -f -\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app-nginx\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: nginx\n  template:\n    metadata:\n      labels:\n        app: nginx\n        env: laboratorio\n      annotations:\n        owner: \"time-devops\"\n        version: \"1.0\"\n    spec:\n      containers:\n        - name: nginx\n          image: nginx:latest\n          ports:\n            - containerPort: 80\n          env:\n            - name: APP_MODE\n              valueFrom:\n                configMapKeyRef:\n                  name: app-config\n                  key: APP_MODE\n            - name: APP_USER\n              valueFrom:\n                secretKeyRef:\n                  name: app-secret\n                  key: APP_USER\nEOF",
        note: "Entrega o workload com labels, annotations e consumo de ConfigMap e Secret.",
        taskIndexes: [2, 3],
      },
      {
        title: "Expor a aplicacao internamente",
        command: "kubectl expose deployment app-nginx --name=nginx-service --port=80 --target-port=80 --type=ClusterIP",
        note: "Cria o Service interno que fecha a descoberta da aplicacao dentro do namespace do aluno.",
        taskIndexes: [4],
      },
      {
        title: "Inspecionar metadados e recursos",
        command: "kubectl get pods --show-labels\nkubectl describe deployment app-nginx\nkubectl get svc",
        note: "Revisa labels, annotations, env vars e a exposicao final do workload.",
        taskIndexes: [4],
      },
    ],
  },
  "lab-4": {
    intro:
      "A Unidade IV mistura modelagem declarativa e operacao real. No runtime do aluno foque em PVC, StatefulSet, Job e CronJob; o PV entra como referencia declarativa porque depende de privilegios de cluster.",
    steps: [
      {
        title: "Registrar o PV da unidade",
        command: "cat <<'EOF' | kubectl apply -f -\napiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: pv-dados\nspec:\n  capacity:\n    storage: 5Gi\n  accessModes:\n    - ReadWriteOnce\n  hostPath:\n    path: /mnt/dados\nEOF",
        note: "Use este manifesto como referencia declarativa da unidade. No runtime do aluno, prefira registra-lo no diario e no editor.",
        taskIndexes: [0],
        runMode: "journal",
      },
      {
        title: "Aplicar o PVC namespaced",
        command: "cat <<'EOF' | kubectl apply -f -\napiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: pvc-dados\nspec:\n  accessModes:\n    - ReadWriteOnce\n  resources:\n    requests:\n      storage: 5Gi\nEOF",
        note: "Cria o claim da unidade dentro do namespace isolado do aluno.",
        taskIndexes: [0],
      },
      {
        title: "Aplicar o StatefulSet do banco",
        command: "cat <<'EOF' | kubectl apply -f -\napiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: banco\nspec:\n  serviceName: banco\n  replicas: 1\n  selector:\n    matchLabels:\n      app: banco\n  template:\n    metadata:\n      labels:\n        app: banco\n    spec:\n      containers:\n        - name: mysql\n          image: mysql:5.7\n          env:\n            - name: MYSQL_ROOT_PASSWORD\n              value: \"123456\"\n          volumeMounts:\n            - name: dados\n              mountPath: /var/lib/mysql\n  volumeClaimTemplates:\n    - metadata:\n        name: dados\n      spec:\n        accessModes: [\"ReadWriteOnce\"]\n        resources:\n          requests:\n            storage: 5Gi\nEOF",
        note: "Entrega o componente stateful principal com persistencia declarativa.",
        taskIndexes: [1],
      },
      {
        title: "Executar o Job de processamento",
        command: "cat <<'EOF' | kubectl apply -f -\napiVersion: batch/v1\nkind: Job\nmetadata:\n  name: job-processamento\nspec:\n  template:\n    spec:\n      restartPolicy: Never\n      containers:\n        - name: processador\n          image: python:3.11\n          command: [\"python\", \"-c\", \"print('Processando dados...')\"]\nEOF",
        note: "Dispara o processamento pontual tratado na pratica da unidade.",
        taskIndexes: [2],
      },
      {
        title: "Agendar o CronJob de backup",
        command: "cat <<'EOF' | kubectl apply -f -\napiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: cron-backup\nspec:\n  schedule: \"*/1 * * * *\"\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          restartPolicy: OnFailure\n          containers:\n            - name: backup\n              image: alpine\n              command: [\"sh\", \"-c\", \"echo Backup executado\"]\nEOF",
        note: "Fecha a automacao agendada prevista para a camada stateful.",
        taskIndexes: [3],
      },
      {
        title: "Inspecionar a camada persistente",
        command: "kubectl get pvc,statefulset,pods,jobs,cronjobs",
        note: "Revisa persistencia, workloads batch e recursos gerados no namespace do aluno.",
        taskIndexes: [4],
      },
    ],
  },
  "lab-5": {
    intro:
      "A Unidade V combina operacao real no runtime com registro guiado de etapas mais avancadas. Deployment, Service, HPA, rolling update e rollback podem ser praticados no cluster; o fluxo de Helm pode ser registrado quando o runtime nao tiver Helm instalado.",
    steps: [
      {
        title: "Aplicar o Deployment base",
        command: "cat <<'EOF' | kubectl apply -f -\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: webapp\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: webapp\n  template:\n    metadata:\n      labels:\n        app: webapp\n    spec:\n      containers:\n        - name: nginx\n          image: nginx:latest\n          ports:\n            - containerPort: 80\nEOF",
        note: "Cria a aplicacao inicial com 2 replicas para a etapa de operacao.",
        taskIndexes: [0],
      },
      {
        title: "Expor a aplicacao internamente",
        command: "kubectl expose deployment webapp --name=webapp --port=80 --target-port=80 --type=ClusterIP",
        note: "Entrega o Service interno usado pelo autoscaler e pelos testes da unidade.",
        taskIndexes: [0],
      },
      {
        title: "Aplicar o HPA da unidade",
        command: "cat <<'EOF' | kubectl apply -f -\napiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: webapp\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: webapp\n  minReplicas: 2\n  maxReplicas: 10\n  metrics:\n    - type: Resource\n      resource:\n        name: cpu\n        target:\n          type: Utilization\n          averageUtilization: 50\nEOF",
        note: "Configura o autoscaling da unidade com alvo de CPU em 50%.",
        taskIndexes: [1],
      },
      {
        title: "Executar o rolling update",
        command: "kubectl set image deployment/webapp nginx=nginx:1.25\nkubectl rollout status deployment/webapp",
        note: "Atualiza a imagem do Deployment e acompanha o rollout controlado.",
        taskIndexes: [2],
      },
      {
        title: "Executar rollback e revisar historico",
        command: "kubectl rollout undo deployment/webapp\nkubectl rollout history deployment/webapp",
        note: "Volta a versao anterior e consulta o historico de revisoes do Deployment.",
        taskIndexes: [3],
      },
      {
        title: "Registrar o fluxo equivalente com Helm",
        command: "helm version\nhelm repo add bitnami https://charts.bitnami.com/bitnami\nhelm repo update\nhelm install meu-nginx bitnami/nginx\nhelm upgrade meu-nginx bitnami/nginx --set replicaCount=3\nhelm rollback meu-nginx 1",
        note: "Use este bloco como roteiro de referencia para a parte da unidade ligada a empacotamento, upgrade e rollback com Helm.",
        taskIndexes: [4],
        runMode: "journal",
      },
    ],
  },
};

const WORKFLOW_GUIDES = {
  "lab-1": [
    {
      title: "Executar localmente no computador do aluno",
      note: "Use WSL, Docker, Kind e kubectl fora da plataforma para montar o cluster da unidade.",
    },
    {
      title: "Registrar o percurso no diario do lab",
      note: "Marque os passos locais concluidos e mantenha o roteiro como checklist da pratica.",
    },
    {
      title: "Consolidar apenas o manifesto final",
      note: "Use o editor para revisar o Pod `nginx-yaml`, que representa a parte declarativa da atividade.",
    },
  ],
  "lab-2": [
    {
      title: "Subir a aplicacao pelo terminal real",
      note: "Use o runtime para criar Deployment, Services e revisar rollout no cluster do aluno.",
    },
    {
      title: "Reescrever a solucao em YAML",
      note: "Depois de operar a aplicacao, consolide o manifesto com NodePort e probes no editor.",
    },
    {
      title: "Fechar com validacao declarativa",
      note: "Garanta que a entrega final reflita o estado esperado da unidade, nao apenas o experimento momentaneo no shell.",
    },
  ],
  "lab-3": [
    {
      title: "Usar o namespace do runtime como laboratorio",
      note: "No shell do aluno, trate o namespace provisionado como equivalente operacional do namespace `laboratorio`.",
    },
    {
      title: "Materializar configuracao e metadados",
      note: "ConfigMap, Secret, labels, annotations e Service devem aparecer tanto no terminal quanto no manifesto final.",
    },
    {
      title: "Consolidar a organizacao declarativa",
      note: "O YAML final precisa fechar nomes, referencias e metadados coerentes com a unidade.",
    },
  ],
  "lab-4": [
    {
      title: "Separar o que e cluster-scope do que e namespaced",
      note: "Modele PV no manifesto e execute no runtime principalmente PVC, StatefulSet, Job e CronJob.",
    },
    {
      title: "Usar o terminal para operacao stateful",
      note: "O runtime serve para observar a camada stateful e os workloads batch dentro do namespace do aluno.",
    },
    {
      title: "Fechar o desenho completo no editor",
      note: "A validacao final considera o conjunto completo da unidade, incluindo recursos que nao dependem apenas do shell do aluno.",
    },
  ],
  "lab-5": [
    {
      title: "Operar escalabilidade e rollout no runtime",
      note: "Deployment, Service, HPA, rolling update e rollback devem ser praticados no terminal do aluno.",
    },
    {
      title: "Registrar a extensao com Helm",
      note: "Use o diario para guardar o fluxo de install, upgrade e rollback com Helm quando o runtime nao tiver a ferramenta.",
    },
    {
      title: "Consolidar o alvo declarativo da unidade",
      note: "A entrega final valida Deployment, Service e HPA coerentes com o comportamento esperado da aplicacao.",
    },
  ],
};

const DEFAULT_WORKFLOW = [
  {
    title: "Executar o roteiro da unidade",
    note: "Siga os passos guiados usando runtime real, execucao local ou registro manual conforme a proposta da pratica.",
  },
  {
    title: "Consolidar no manifesto",
    note: "Registre no editor a versao declarativa final que representa a entrega da unidade.",
  },
  {
    title: "Fechar com validacao e evidencia",
    note: "Use a validacao automatica e o diario do lab para fixar evidencias da pratica.",
  },
];

const GUIDE_STREAM_PATTERN = /\s-w(?:\s|$)|\blogs\s+-f\b/;
const TERMINAL_PROMPT_PATTERN = /(?:^|\r?\n)[^\r\n]*[$#] $/m;
const TERMINAL_FAILURE_PATTERN =
  /\b(error:|forbidden|not found|unable to|failed\b|panic:|invalid\b|timeout\b)\b/i;
const MAX_SUBMISSIONS_PER_LAB = 3;
const MANUAL_PROGRESS_RULES = {};

const state = {
  course: null,
  activeSessionId: null,
  drafts: {},
  completedTasks: {},
  validations: {},
  labSubmissionCounts: {},
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
  accessLookup: {
    student: null,
    cohorts: [],
  },
  accessStatus: {
    message:
      "Use e-mail e senha para localizar suas turmas matriculadas ou abra a pagina de cadastro.",
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
    commandBuffer: "",
    pendingCommand: null,
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
  accessSubmitButton: document.querySelector("#access-submit-button"),
  accessStatus: document.querySelector("#access-status"),
  accessCohortPanel: document.querySelector("#access-cohort-panel"),
  accessCohortCopy: document.querySelector("#access-cohort-copy"),
  accessCohortList: document.querySelector("#access-cohort-list"),
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
  sessionFocus: document.querySelector("#session-focus"),
  sessionDeliverables: document.querySelector("#session-deliverables"),
  theoryTopics: document.querySelector("#theory-topics"),
  practiceTasks: document.querySelector("#practice-tasks"),
  labTitle: document.querySelector("#lab-title"),
  labScenario: document.querySelector("#lab-scenario"),
  labObjectives: document.querySelector("#lab-objectives"),
  labHints: document.querySelector("#lab-hints"),
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
  saveWorkspaceButton: document.querySelector("#save-workspace-button"),
  validateButton: document.querySelector("#validate-button"),
  resetButton: document.querySelector("#reset-button"),
  workflowSteps: document.querySelector("#workflow-steps"),
};

const STUDENT_ROUTE_CONFIG = {
  overview: {
    path: "/app/overview",
    eyebrow: "Visão geral",
    title: "Mapa da unidade e preparação teorica",
    copy: "Abra uma visao limpa da sessao atual, com foco pedagogico, entregaveis e checklist da unidade.",
  },
  practice: {
    path: "/app/practice",
    eyebrow: "Prática guiada",
    title: "Execucao guiada da unidade",
    copy: "Siga o roteiro da unidade usando runtime real, execucao local ou registro manual, conforme a proposta da pratica.",
  },
  workspace: {
    path: "/app/workspace",
    eyebrow: "Workspace",
    title: "Entrega declarativa e validacao",
    copy: "Consolide o aprendizado no manifesto YAML, valide criterios e registre a evidencia da unidade.",
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

const consumeAccessRedirectHint = () => {
  const currentURL = new URL(window.location.href);
  const registered = currentURL.searchParams.get("registered") === "1";
  const email = currentURL.searchParams.get("email")?.trim() || "";
  const cohortCode = currentURL.searchParams.get("cohortCode")?.trim() || "";
  const hasRegistrationHint =
    currentURL.searchParams.has("registered") ||
    currentURL.searchParams.has("email") ||
    currentURL.searchParams.has("cohortCode");

  if (email) {
    state.accessProfile.email = email;
  }

  if (cohortCode) {
    state.accessProfile.cohortCode = cohortCode;
  }

  if (hasRegistrationHint) {
    currentURL.search = "";
    window.history.replaceState({}, "", `${currentURL.pathname}${currentURL.hash}`);
  }

  return {
    registered,
    preserveAccessProfile: registered || Boolean(email || cohortCode),
  };
};

const describeStudentSession = (student, cohort) => {
  if (!student?.name || !cohort?.title) {
    return null;
  }

  return `${student.name} em ${cohort.title}`;
};

const resetAccessLookup = () => {
  state.accessLookup = {
    student: null,
    cohorts: [],
  };
};

const formatAccessDate = (value) => {
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

const getLabExecutionMode = (lab = getActiveLab()) => lab.executionMode || "cluster";

const getStepRunMode = (step, lab = getActiveLab()) =>
  step?.runMode || (getLabExecutionMode(lab) === "local" ? "local" : "runtime");

const shouldSendStepToRuntime = (step, lab = getActiveLab()) =>
  getStepRunMode(step, lab) === "runtime";

const getCommandActionLabel = (step, lab = getActiveLab()) => {
  const runMode = getStepRunMode(step, lab);
  if (runMode === "local") {
    return "Registrar execucao";
  }
  if (runMode === "journal") {
    return "Registrar passo";
  }

  return getActiveRuntimeSession() && state.runtime.connected
    ? "Enviar ao terminal"
    : "Registrar passo";
};

const getRuntimeButtonLabel = (lab = getActiveLab()) => {
  if (getLabExecutionMode(lab) === "local") {
    return "Pratica local";
  }

  return state.runtime.connected && getActiveRuntimeSession()
    ? "Reconectar terminal"
    : "Conectar terminal";
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

const getWorkflowGuide = () => WORKFLOW_GUIDES[getActiveLab().id] || DEFAULT_WORKFLOW;

const getTaskKey = (sessionId, taskIndex) => `${sessionId}:${taskIndex}`;

const markTaskIndexesForSession = (sessionId, taskIndexes = []) => {
  const newlyCompleted = [];
  taskIndexes.forEach((taskIndex) => {
    if (Number.isInteger(taskIndex) && taskIndex >= 0) {
      const taskKey = getTaskKey(sessionId, taskIndex);
      if (!state.completedTasks[taskKey]) {
        newlyCompleted.push(taskIndex);
      }
      state.completedTasks[taskKey] = true;
    }
  });

  return newlyCompleted;
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
  state.labSubmissionCounts = {};
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
      labSubmissionCounts: state.labSubmissionCounts,
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
    state.labSubmissionCounts = persisted.labSubmissionCounts || {};
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
  const totalMeetings = state.course.meetings.length;
  const localCompletedMeetings = state.course.meetings.filter((meeting) => {
    const validation = state.validations[meeting.lab.id];
    return Boolean(validation?.allPassed) && isSessionPracticeComplete(meeting);
  }).length;
  const completedMeetings = state.student?.id
    ? Math.min(Math.max(Number(state.validatedLabs) || 0, 0), totalMeetings)
    : localCompletedMeetings;
  const percentage = totalMeetings === 0 ? 0 : Math.round((completedMeetings / totalMeetings) * 100);

  return { totalMeetings, completedMeetings, percentage };
};

const getSessionStatus = (meeting) => {
  const validation = state.validations[meeting.lab.id];
  const draft = (state.drafts[meeting.lab.id] || "").trim();
  const practiceComplete = isSessionPracticeComplete(meeting);
  const completedPracticeTasks = getCompletedTaskIndexes(meeting).length;

  if (validation?.allPassed && practiceComplete) {
    return { label: "Concluido", tone: "success" };
  }

  if (validation?.allPassed) {
    return { label: "Validado", tone: "success" };
  }

  if (completedPracticeTasks > 0) {
    return { label: "Em progresso", tone: "info" };
  }

  if (draft && draft !== meeting.lab.starter.trim()) {
    return { label: "Rascunho", tone: "draft" };
  }

  return { label: "Planejado", tone: "neutral" };
};

const getLabSubmissionCount = (labId) => Number(state.labSubmissionCounts[labId] || 0);

const hasReachedSubmissionLimit = (labId) =>
  getLabSubmissionCount(labId) >= MAX_SUBMISSIONS_PER_LAB;

const buildSubmissionLimitMessage = (labId) => {
  const bestScore = state.validations[labId]?.score || 0;
  if (bestScore > 0) {
    return `Limite de ${MAX_SUBMISSIONS_PER_LAB} tentativas atingido. Melhor nota registrada: ${bestScore}%.`;
  }

  return `Limite de ${MAX_SUBMISSIONS_PER_LAB} tentativas atingido para este laboratorio.`;
};

const normalizeTrackedCommand = (command) =>
  String(command || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const normalizeTerminalOutput = (output) =>
  String(output || "")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "\n");

const matchesTrackedCommand = (command, pattern) => {
  if (pattern instanceof RegExp) {
    return pattern.test(command);
  }

  return normalizeTrackedCommand(pattern) === command;
};

const resolveTaskIndexesForExecutedCommand = (labId, command) => {
  const normalizedCommand = normalizeTrackedCommand(command);
  if (!normalizedCommand) {
    return [];
  }

  const matchedTaskIndexes = new Set();

  (MANUAL_PROGRESS_RULES[labId] || []).forEach((rule) => {
    if (rule.patterns.some((pattern) => matchesTrackedCommand(normalizedCommand, pattern))) {
      (rule.taskIndexes || []).forEach((taskIndex) => matchedTaskIndexes.add(taskIndex));
    }
  });

  const guide = TERMINAL_GUIDES[labId];
  guide?.steps.forEach((step) => {
    if (!Array.isArray(step.taskIndexes) || step.taskIndexes.length === 0) {
      return;
    }

    if (matchesTrackedCommand(normalizedCommand, step.command)) {
      step.taskIndexes.forEach((taskIndex) => matchedTaskIndexes.add(taskIndex));
    }
  });

  return Array.from(matchedTaskIndexes).sort((left, right) => left - right);
};

const clearPendingRuntimeCommand = () => {
  state.runtime.pendingCommand = null;
};

const canTreatAlreadyExistsAsSuccess = (command) =>
  /^kubectl\s+(create|expose)\b/i.test(normalizeTrackedCommand(command));

const didTrackedCommandSucceed = (command, output) => {
  const normalizedOutput = normalizeTerminalOutput(output).trim();
  if (!normalizedOutput) {
    return false;
  }

  if (!TERMINAL_FAILURE_PATTERN.test(normalizedOutput)) {
    return true;
  }

  return /\balready exists\b/i.test(normalizedOutput) && canTreatAlreadyExistsAsSuccess(command);
};

const beginTrackingRuntimeCommand = (command) => {
  const runtimeSession = getActiveRuntimeSession();
  if (!runtimeSession) {
    clearPendingRuntimeCommand();
    return;
  }

  const normalizedCommand = String(command || "").trim();
  if (!normalizedCommand) {
    clearPendingRuntimeCommand();
    return;
  }

  state.runtime.pendingCommand = {
    command: normalizedCommand,
    labId: runtimeSession.labId,
    taskIndexes: resolveTaskIndexesForExecutedCommand(runtimeSession.labId, normalizedCommand),
    output: "",
  };
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
  const localValidated = state.course.meetings.filter(
    (meeting) => state.validations[meeting.lab.id]?.allPassed,
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
    <p>As tarefas abaixo ajudam a misturar teoria e pratica na ordem da unidade.</p>
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

  return `Imagem atual detectada: \`${image}\`. Para esta unidade a validacao aceita imagens iniciando com \`nginx\`, como \`nginx\`, \`nginx:stable\` ou \`nginx:latest\`. Se aparecer \`ngnix\`, e typo e precisa corrigir.`;
};

const renderValidation = (validation) => {
  const lab = getActiveLab();
  const submissionCount = getLabSubmissionCount(lab.id);
  const submissionNote = state.student?.id
    ? `${submissionCount}/${MAX_SUBMISSIONS_PER_LAB} tentativas registradas. A maior nota e mantida.`
    : "";

  if (!validation) {
    elements.validationSummary.className = "validation-summary";
    elements.validationSummary.innerHTML = submissionNote
      ? `Nenhuma validacao executada ainda.<br /><span>${escapeHtml(submissionNote)}</span>`
      : "Nenhuma validacao executada ainda.";
    elements.validationResults.innerHTML =
      '<p class="empty-state">Envie o manifesto para ver os criterios atendidos.</p>';
    return;
  }

  elements.validationSummary.className = `validation-summary ${validation.allPassed ? "pass" : "fail"}`;
  elements.validationSummary.innerHTML = `
    <strong>${validation.score}% de aderencia</strong><br />
    ${validation.passedChecks}/${validation.totalChecks} criterios atendidos.
    ${submissionNote ? `<br /><span>${escapeHtml(submissionNote)}</span>` : ""}
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

const syncValidateButtonState = (lab = getActiveLab()) => {
  elements.validateButton.textContent = hasReachedSubmissionLimit(lab.id)
    ? `Limite atingido (${getLabSubmissionCount(lab.id)}/${MAX_SUBMISSIONS_PER_LAB})`
    : "Validar entrega";
};

const renderCommands = () => {
  const lab = getActiveLab();
  const guide = getTerminalGuide();
  const defaultLogMessage =
    getLabExecutionMode(lab) === "local"
      ? "Nenhum passo registrado ainda. Use o roteiro ao lado para documentar a execucao local da unidade.\n"
      : "Nenhum passo registrado ainda. Use o roteiro ao lado para guiar a execucao do laboratorio.\n";
  const log =
    state.terminalLogs[lab.id] || defaultLogMessage;

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
              ${getCommandActionLabel(item, lab)}
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

  elements.openRuntimeButton.disabled =
    getLabExecutionMode(lab) === "local" || !state.student?.id;
  elements.openRuntimeButton.textContent = getRuntimeButtonLabel(lab);

  if (getLabExecutionMode(lab) === "local") {
    setRuntimeStatus(
      "Esta unidade e executada no computador do aluno. Use o roteiro ao lado como guia local e o editor para consolidar o manifesto final.",
      "info",
    );
    elements.runtimeMeta.innerHTML = `
      <article class="runtime-chip">
        <strong>Modo da pratica</strong>
        <span>Execucao local</span>
      </article>
      <article class="runtime-chip">
        <strong>Ambiente</strong>
        <span>WSL + Docker + Kind + kubectl</span>
      </article>
    `;
    elements.runtimeContext.textContent =
      "Nao ha shell provisionada para esta unidade na plataforma. Registre os passos locais no diario do lab e consolide o YAML final no editor.";
    elements.terminalModeLabel.textContent = "Execucao local";
    return;
  }

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

const renderAccessCohortPicker = () => {
  const cohorts = Array.isArray(state.accessLookup.cohorts) ? state.accessLookup.cohorts : [];
  const visible = !state.student?.id && cohorts.length > 0;

  elements.accessCohortPanel.hidden = !visible;
  if (!visible) {
    elements.accessCohortList.innerHTML = "";
    return;
  }

  const hasOpenCohort = cohorts.some((item) => item.accessOpen);
  elements.accessCohortCopy.textContent = hasOpenCohort
    ? "Credenciais validadas. Escolha uma turma aberta para iniciar a sessão acadêmica."
    : "Suas turmas foram encontradas, mas nenhuma está aberta no momento. Consulte as janelas abaixo.";

  elements.accessCohortList.innerHTML = cohorts
    .map((item) => {
      const tone = getCohortAccessTone(item.accessStatus);
      const startLabel = formatAccessDate(item.cohort.accessStartsAt);
      const endLabel = formatAccessDate(item.cohort.accessEndsAt);
      const isSelected = state.accessProfile.cohortCode === item.cohort.code;

      return `
        <article class="access-cohort-card ${item.accessOpen ? "open" : "locked"} ${isSelected ? "selected" : ""}">
          <div class="access-cohort-header">
            <div>
              <span class="hero-label">${escapeHtml(item.cohort.code.toUpperCase())}</span>
              <h3>${escapeHtml(item.cohort.title)}</h3>
            </div>
            <span class="timeline-status ${tone}">${escapeHtml(getCohortAccessLabel(item.accessStatus))}</span>
          </div>
          <div class="access-cohort-meta">
            <span>Início: ${escapeHtml(startLabel)}</span>
            <span>Fim: ${escapeHtml(endLabel)}</span>
          </div>
          <p>${escapeHtml(item.accessMessage)}</p>
          <button
            class="primary-button wide"
            data-cohort-enter="${escapeHtml(item.cohort.code)}"
            type="button"
            ${item.accessOpen ? "" : "disabled"}
          >
            ${item.accessOpen ? "Entrar nesta turma" : "Aguardando abertura"}
          </button>
        </article>
      `;
    })
    .join("");
};

const renderHeader = () => {
  const progress = calculateProgress();
  const isConnected = Boolean(state.student?.id);
  const itemLabelPlural = state.course.format.itemLabelPlural || "encontros";
  const formatText = `${state.course.format.totalMeetings} ${itemLabelPlural} de ${state.course.format.durationPerMeeting}`;

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

  elements.accessSubmitButton.textContent = isConnected ? "Sessao ativa" : "Ver turmas disponíveis";
  elements.accessEmail.value = state.accessProfile.email;

  setAccessStatus(state.accessStatus.message, state.accessStatus.tone);
  setEditorStatus(state.editorStatus.message, state.editorStatus.tone);
  setRuntimeStatus(state.runtime.status.message, state.runtime.status.tone);
  renderAccessCohortPicker();
};

const renderSessionDetails = () => {
  const session = getActiveSession();
  const lab = session.lab;
  const validation = state.validations[lab.id];
  const hasDraft = Boolean((state.drafts[lab.id] || "").trim());
  const updatedAt = state.workspaceUpdatedAt[lab.id];

  elements.sessionOrder.textContent = session.label || `Unidade ${session.order}`;
  elements.sessionTitle.textContent = session.title;
  elements.sessionDuration.textContent = session.duration;

  renderListCard(
    elements.sessionFocus,
    "Foco da unidade",
    "Objetivo pedagogico",
    session.focus,
    session.deliverables,
  );

  renderListCard(
    elements.sessionDeliverables,
    "Entrega esperada",
    "O que o aluno precisa sair sabendo",
    "Cada unidade termina com artefatos concretos para consolidar a pratica.",
    session.deliverables,
  );

  renderListCard(
    elements.theoryTopics,
    "Bloco teorico",
    "2h de teoria orientada",
    "Conceitos em ordem cronologica para preparar a parte pratica da unidade.",
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

  elements.editor.value = state.drafts[lab.id] || lab.starter;
  elements.editorCallout.textContent =
    getLabExecutionMode(lab) === "local"
      ? `Esta unidade roda fora da plataforma. Use o editor para consolidar o manifesto final esperado: ${lab.title}.`
      : `${DEFAULT_EDITOR_CALLOUT} Estrutura esperada: ${lab.title}.`;
  syncValidateButtonState(lab);
  renderValidation(validation);
  renderCommands();
  renderRuntimePanel();
  renderWorkflowGuide();

  if (validation?.allPassed && isSessionPracticeComplete(session)) {
    setEditorStatus(
      "Unidade concluida: pratica guiada registrada e manifesto validado com sucesso.",
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
    disconnectRuntimeTerminal("Terminal encerrado ao trocar de unidade.");
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
  beginTrackingRuntimeCommand(command);
  sendRuntimeInput(payload);
  state.runtime.activeStreamingCommand = options.streaming ? command : null;
  state.runtime.term.focus();
};

const interruptRuntimeStreamingCommand = async () => {
  if (!state.runtime.activeStreamingCommand) {
    return;
  }

  clearPendingRuntimeCommand();
  sendRuntimeInput("\u0003");
  state.runtime.activeStreamingCommand = null;
  await delay(180);
};

const finalizeTrackedRuntimeCommand = () => {
  const pendingCommand = state.runtime.pendingCommand;
  if (!pendingCommand) {
    return;
  }

  const meeting = findMeetingByLabId(pendingCommand.labId);
  if (!meeting) {
    clearPendingRuntimeCommand();
    return;
  }

  const taskIndexes = pendingCommand.taskIndexes || [];
  const succeeded = didTrackedCommandSucceed(pendingCommand.command, pendingCommand.output);
  clearPendingRuntimeCommand();

  if (!succeeded || taskIndexes.length === 0) {
    if (!succeeded && taskIndexes.length > 0) {
      setRuntimeStatus("Comando executado com erro. Checklist do laboratorio nao foi atualizado.", "warning");
    }
    return;
  }

  const newlyCompleted = markTaskIndexesForSession(meeting.id, taskIndexes);
  if (newlyCompleted.length === 0) {
    return;
  }

  renderPracticeTasks(meeting);
  renderTimeline();
  renderHeader();
  renderDashboardStrip();
  markWorkspaceDirty("Checklist atualizado automaticamente a partir do terminal.");
  setRuntimeStatus("Checklist do laboratorio atualizado automaticamente pelo comando executado.", "success");
};

const flushRuntimeCommandBuffer = () => {
  const command = state.runtime.commandBuffer.trim();
  state.runtime.commandBuffer = "";

  if (command) {
    beginTrackingRuntimeCommand(command);
  }
};

const trackRuntimeCommandInput = (data) => {
  if (!data || data.startsWith("\u001b")) {
    return;
  }

  for (const char of data) {
    if (char === "\r" || char === "\n") {
      flushRuntimeCommandBuffer();
      continue;
    }

    if (char === "\u0003" || char === "\u0015") {
      state.runtime.commandBuffer = "";
      clearPendingRuntimeCommand();
      continue;
    }

    if (char === "\u007f" || char === "\b") {
      state.runtime.commandBuffer = state.runtime.commandBuffer.slice(0, -1);
      continue;
    }

    if (/[\u0000-\u001f]/.test(char)) {
      continue;
    }

    state.runtime.commandBuffer += char === "\t" ? " " : char;
  }
};

const trackRuntimeCommandOutput = (data) => {
  if (!state.runtime.pendingCommand || typeof data !== "string") {
    return;
  }

  state.runtime.pendingCommand.output += data;
  if (TERMINAL_PROMPT_PATTERN.test(state.runtime.pendingCommand.output)) {
    finalizeTrackedRuntimeCommand();
  }
};

const registerGuideStepProgress = (selected, dirtyMessage) => {
  const session = getActiveSession();
  const newlyCompleted = markTaskIndexesForSession(session.id, selected.taskIndexes || []);

  if (newlyCompleted.length > 0) {
    renderPracticeTasks(session);
    renderTimeline();
    renderHeader();
    renderDashboardStrip();
  }

  markWorkspaceDirty(dirtyMessage);
};

const handleCommandAction = async (commandIndex) => {
  const guide = getTerminalGuide();
  const selected = guide.steps[Number(commandIndex)];
  const runMode = getStepRunMode(selected);

  if (!selected) {
    return;
  }

  const activeRuntimeSession = getActiveRuntimeSession();

  if (shouldSendStepToRuntime(selected) && activeRuntimeSession && state.runtime.connected) {
    try {
      const willInterruptPrevious = Boolean(state.runtime.activeStreamingCommand);

      if (willInterruptPrevious) {
        await interruptRuntimeStreamingCommand();
      }

      sendCommandToRuntime(selected.command, { streaming: isStreamingGuideStep(selected) });
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
      markWorkspaceDirty("Roteiro de terminal atualizado no diario do lab.");
    } catch (error) {
      setRuntimeStatus(
        normalizeErrorMessage(error, "Nao foi possivel enviar o passo guiado ao terminal."),
        "danger",
      );
    }
    return;
  }

  if (!shouldSendStepToRuntime(selected)) {
    appendTerminalJournal(
      runMode === "local" ? "Passo local registrado" : "Passo registrado",
      selected.command,
      selected.note,
    );
    setRuntimeStatus(
      runMode === "local"
        ? `Passo registrado para execucao local: ${selected.title}.`
        : `Passo registrado no diario da unidade: ${selected.title}.`,
      "success",
    );
    registerGuideStepProgress(
      selected,
      runMode === "local"
        ? "Passo local registrado no diario da unidade."
        : "Passo registrado no diario da unidade.",
    );
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
  state.validatedLabs = 0;
  state.lastSyncedAt = new Date().toISOString();
  state.accessProfile = {
    email: dashboard.student?.email || "",
    cohortCode: dashboard.cohort?.code || "",
  };
  resetAccessLookup();
  state.labSubmissionCounts = {};
  let validatedCurrentLabs = 0;

  Object.values(dashboard.workspaces || {}).forEach((workspace) => {
    const meeting = findMeetingByLabId(workspace.labId);

    if (meeting) {
      clearCompletedTasksForSession(workspace.sessionId || meeting.id);
    }

    state.drafts[workspace.labId] = workspace.solution || "";
    state.terminalLogs[workspace.labId] = workspace.terminalLog || "";
    state.workspaceUpdatedAt[workspace.labId] = workspace.updatedAt || null;
    state.labSubmissionCounts[workspace.labId] = workspace.submissionCount || 0;

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

      if (state.validations[workspace.labId]?.allPassed) {
        validatedCurrentLabs += 1;
      }
    }
  });

  state.validatedLabs = validatedCurrentLabs;
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

    trackRuntimeCommandInput(data);

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
  state.runtime.commandBuffer = "";
  clearPendingRuntimeCommand();
  elements.terminalModeLabel.textContent = "Sem sessao ativa";
  if (message) {
    setRuntimeStatus(message, "muted");
  }
};

const clearStudentSession = (message, tone = "muted", preserveAccessProfile = false) => {
  disconnectRuntimeTerminal("Terminal encerrado porque a sessao do aluno foi finalizada.");
  resetLearningState();
  resetAccessLookup();
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
    "Entre com e-mail, senha e selecione uma turma aberta para liberar o editor e o terminal do laboratorio.",
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
  if (getLabExecutionMode() === "local") {
    throw new Error("Esta unidade e executada localmente no computador do aluno e nao abre runtime na plataforma.");
  }

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
  state.runtime.commandBuffer = "";
  clearPendingRuntimeCommand();
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
        trackRuntimeCommandOutput(message.data);
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
    state.runtime.commandBuffer = "";
    clearPendingRuntimeCommand();
    setRuntimeStatus("Conexao do terminal encerrada. Voce pode abrir novamente a sessao do lab.", "muted");
    elements.terminalModeLabel.textContent = "Sessao provisionada";
    renderRuntimePanel();
    renderCommands();
  });

  socket.addEventListener("error", () => {
    state.runtime.connected = false;
    state.runtime.activeStreamingCommand = null;
    state.runtime.commandBuffer = "";
    clearPendingRuntimeCommand();
    setRuntimeStatus("Falha no WebSocket do terminal real.", "danger");
    showToast("Falha ao conectar o terminal real do laboratorio.", "danger");
    elements.terminalModeLabel.textContent = "Falha de conexao";
    renderRuntimePanel();
    renderCommands();
  });
};

const refreshDashboard = async () => {
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

  if (!state.student?.id) {
    throw new Error("Conecte um aluno antes de validar a entrega do laboratorio.");
  }

  if (hasReachedSubmissionLimit(lab.id)) {
    const message = buildSubmissionLimitMessage(lab.id);
    setEditorStatus(message, "warning");
    showToast(message, "warning");
    renderValidation(state.validations[lab.id] || null);
    return;
  }

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

const lookupStudentCohorts = async () => {
  state.accessProfile.email = elements.accessEmail.value.trim();

  const requiredMessage = buildRequiredMessage([
    [elements.accessEmail, "e-mail"],
    [elements.accessPassword, "senha"],
  ]);

  if (requiredMessage) {
    setAccessStatus(requiredMessage, "warning");
    showToast(requiredMessage, "warning");
    return;
  }

  resetAccessLookup();
  elements.accessSubmitButton.disabled = true;
  setAccessStatus("Validando credenciais e carregando suas turmas...", "muted");

  try {
    const lookup = await fetchJSON("/api/auth/student/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: state.accessProfile.email,
        password: elements.accessPassword.value,
      }),
    });

    state.accessLookup = {
      student: lookup.student || null,
      cohorts: Array.isArray(lookup.cohorts) ? lookup.cohorts : [],
    };
    persistState();
    render();

    const hasOpenCohort = state.accessLookup.cohorts.some((item) => item.accessOpen);
    setAccessStatus(
      hasOpenCohort
        ? "Credenciais validadas. Escolha abaixo a turma aberta para entrar."
        : "Credenciais validadas, mas nenhuma turma vinculada está aberta no momento.",
      hasOpenCohort ? "success" : "warning",
    );
    showToast(
      hasOpenCohort
        ? "Turmas carregadas. Escolha a turma que deseja abrir."
        : "Turmas carregadas, porém sem janela de acesso aberta.",
      hasOpenCohort ? "success" : "warning",
    );
  } catch (error) {
    const message = normalizeErrorMessage(
      error,
      "Nao foi possivel localizar suas turmas agora. Revise e-mail e senha.",
    );
    setAccessStatus(message, "danger");
    showToast(message, "danger");
    renderAccessCohortPicker();
  } finally {
    elements.accessSubmitButton.disabled = false;
  }
};

const enterStudentCohort = async (cohortCode) => {
  if (!cohortCode) {
    return;
  }

  state.accessProfile = {
    email: elements.accessEmail.value.trim(),
    cohortCode,
  };

  const requiredMessage = buildRequiredMessage([
    [elements.accessEmail, "e-mail"],
    [elements.accessPassword, "senha"],
  ]);

  if (requiredMessage) {
    setAccessStatus(requiredMessage, "warning");
    showToast(requiredMessage, "warning");
    return;
  }

  setAccessStatus("Abrindo a sessão da turma selecionada...", "muted");

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
      "Nao foi possivel abrir a turma selecionada agora.",
    );
    setAccessStatus(message, "danger");
    showToast(message, "danger");
  }
};

const attachEventListeners = () => {
  const on = (element, type, handler) => {
    if (!element) {
      console.warn(`listener ignorado: elemento ausente para evento ${type}`);
      return false;
    }

    element.addEventListener(type, handler);
    return true;
  };

  on(elements.accessForm, "submit", async (event) => {
    event.preventDefault();
    await lookupStudentCohorts();
  });

  elements.accessCohortList?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cohort-enter]");
    if (!button || button.disabled) {
      return;
    }

    await enterStudentCohort(button.dataset.cohortEnter);
  });

  elements.accessEmail?.addEventListener("input", () => {
    state.accessProfile.email = elements.accessEmail.value;
    if (state.accessLookup.cohorts.length > 0) {
      resetAccessLookup();
      state.accessProfile.cohortCode = "";
      setAccessStatus("Credenciais alteradas. Valide novamente para listar suas turmas.", "muted");
      render();
    }
    persistState();
  });

  elements.accessPassword?.addEventListener("input", () => {
    if (state.accessLookup.cohorts.length > 0) {
      resetAccessLookup();
      state.accessProfile.cohortCode = "";
      setAccessStatus("Senha alterada. Valide novamente para listar suas turmas.", "muted");
      render();
    }
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

  on(elements.timeline, "click", (event) => {
    const button = event.target.closest("[data-session-id]");

    if (!button) {
      return;
    }

    setActiveSession(button.dataset.sessionId);
  });

  on(elements.practiceTasks, "change", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.dataset.taskIndex) {
      handleTaskToggle(event.target.dataset.taskIndex, event.target.checked);
    }
  });

  on(elements.editor, "input", () => {
    const lab = getActiveLab();
    state.drafts[lab.id] = elements.editor.value;
    markWorkspaceDirty("Edicao local em andamento. Salve ou valide para sincronizar.");
  });

  on(elements.commandList, "click", (event) => {
    const button = event.target.closest("[data-command-index]");

    if (!button) {
      return;
    }

    handleCommandAction(button.dataset.commandIndex);
  });

  on(elements.resetButton, "click", () => {
    const lab = getActiveLab();
    const restoredValue = state.drafts[lab.id] || lab.starter;
    elements.editor.value = restoredValue;
    setEditorStatus("Rascunho restaurado no editor.", "muted");
  });

  on(elements.saveWorkspaceButton, "click", async () => {
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

  on(elements.validateButton, "click", async () => {
    elements.validateButton.disabled = true;
    elements.validateButton.textContent = "Validando...";

    try {
      await validateCurrentSolution();
    } catch (error) {
      const message = normalizeErrorMessage(error, "Nao foi possivel validar a entrega agora.");
      setEditorStatus(message, "danger");
      showToast(message, "danger");
      if (/limite de 3 tentativas/i.test(message) && state.student?.id) {
        try {
          await refreshDashboard();
          render();
        } catch {
          // Mantem a mensagem original quando a resincronizacao falha.
        }
      }
    } finally {
      elements.validateButton.disabled = false;
      syncValidateButtonState();
    }
  });

  on(elements.openRuntimeButton, "click", async () => {
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
      const lab = getActiveLab();
      elements.openRuntimeButton.disabled =
        getLabExecutionMode(lab) === "local" || !state.student?.id;
      elements.openRuntimeButton.textContent = getRuntimeButtonLabel(lab);
    }
  });

  on(elements.clearTerminalButton, "click", () => {
    clearTerminalView();
  });

  on(elements.logoutButton, "click", async () => {
    try {
      await fetchJSON("/api/auth/logout", { method: "POST" });
    } catch {
      // A limpeza local ainda precisa ocorrer se o cookie remoto falhar.
    }

    clearStudentSession(
      "Sessao encerrada. Informe e-mail, senha e escolha uma turma aberta para liberar um novo ambiente.",
      "muted",
    );
    showToast("Sessao do aluno encerrada.", "info");
  });
};

const initialize = async () => {
  loadPersistedState();
  state.routeKey = getStudentRouteKeyFromPath(window.location.pathname);
  const accessRedirectHint = consumeAccessRedirectHint();

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

  if (!state.course.meetings.some((meeting) => meeting.id === state.activeSessionId)) {
    state.activeSessionId = state.course.meetings[0].id;
  }

  try {
    const auth = await fetchJSON("/api/auth/status");

    if (auth.authenticated && auth.role === "student") {
      state.studentId = auth.student?.id || null;
      state.student = auth.student || null;
      state.cohort = auth.cohort || null;
      state.accessProfile = {
        email: auth.student?.email || "",
        cohortCode: auth.cohort?.code || "",
      };
      await refreshDashboard();
      const sessionLabel = describeStudentSession(
        state.student || auth.student,
        state.cohort || auth.cohort,
      );
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
        accessRedirectHint.registered
          ? "Cadastro concluido. Use a senha criada para listar suas turmas e entrar na que estiver aberta."
          : "Entre com e-mail e senha para listar suas turmas. Se ainda nao tiver acesso, abra a pagina de cadastro.",
        accessRedirectHint.registered ? "success" : "muted",
        accessRedirectHint.preserveAccessProfile,
      );
      if (accessRedirectHint.preserveAccessProfile) {
        persistState();
      }
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
