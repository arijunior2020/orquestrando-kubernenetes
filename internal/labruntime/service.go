package labruntime

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
)

const (
	defaultNamespacePrefix = "kubeclass"
	defaultToolboxImage    = "bitnami/kubectl:latest"
	defaultToolboxShell    = "/bin/sh"
	toolboxPodName         = "toolbox"
	toolboxServiceAccount  = "student-toolbox"
	toolboxRoleBinding     = "student-toolbox-edit"
)

type Service struct {
	enabled         bool
	disabledReason  string
	clientset       *kubernetes.Clientset
	restConfig      *rest.Config
	namespacePrefix string
	toolboxImage    string
	toolboxShell    string
}

type Session struct {
	Enabled   bool   `json:"enabled"`
	LabID     string `json:"labId"`
	Namespace string `json:"namespace"`
	PodName   string `json:"podName"`
	Shell     string `json:"shell"`
	Note      string `json:"note"`
}

type wsMessage struct {
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
	Cols uint16 `json:"cols,omitempty"`
	Rows uint16 `json:"rows,omitempty"`
}

type terminalSizeQueue struct {
	ch chan remotecommand.TerminalSize
}

func (q *terminalSizeQueue) Next() *remotecommand.TerminalSize {
	size, ok := <-q.ch
	if !ok {
		return nil
	}

	return &size
}

type websocketWriter struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (w *websocketWriter) Write(payload []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	message := wsMessage{
		Type: "output",
		Data: string(payload),
	}
	if err := w.conn.WriteJSON(message); err != nil {
		return 0, err
	}

	return len(payload), nil
}

func NewServiceFromEnv() (*Service, error) {
	if isFalsey(os.Getenv("LAB_RUNTIME_ENABLED")) {
		return &Service{
			enabled:        false,
			disabledReason: "runtime desabilitado por configuracao",
		}, nil
	}

	restConfig, err := rest.InClusterConfig()
	if err != nil {
		restConfig, err = buildConfigFromKubeconfig()
		if err != nil {
			return &Service{
				enabled:        false,
				disabledReason: "cluster kubernetes indisponivel para runtime real",
			}, nil
		}
	}

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("falha ao criar clientset kubernetes: %w", err)
	}

	return &Service{
		enabled:         true,
		clientset:       clientset,
		restConfig:      restConfig,
		namespacePrefix: valueOrDefault(os.Getenv("LAB_NAMESPACE_PREFIX"), defaultNamespacePrefix),
		toolboxImage:    valueOrDefault(os.Getenv("TOOLBOX_IMAGE"), defaultToolboxImage),
		toolboxShell:    valueOrDefault(os.Getenv("TOOLBOX_SHELL"), defaultToolboxShell),
	}, nil
}

func (s *Service) Enabled() bool {
	return s != nil && s.enabled
}

func (s *Service) DisabledReason() string {
	if s == nil {
		return "runtime nao inicializado"
	}

	return s.disabledReason
}

func (s *Service) EnsureLab(ctx context.Context, studentID int64, cohortCode, labID string) (Session, error) {
	if !s.Enabled() {
		return Session{}, fmt.Errorf("runtime real indisponivel: %s", s.DisabledReason())
	}

	if studentID <= 0 {
		return Session{}, fmt.Errorf("studentId invalido")
	}

	if strings.TrimSpace(labID) == "" {
		return Session{}, fmt.Errorf("labId obrigatorio")
	}

	namespace := s.namespaceNameFor(studentID, labID)
	labels := map[string]string{
		"app.kubernetes.io/managed-by": "kubeclass-web",
		"kubeclass.io/student-id":      fmt.Sprintf("%d", studentID),
		"kubeclass.io/lab-id":          sanitizeDNSLabel(labID),
	}
	if trimmed := strings.TrimSpace(cohortCode); trimmed != "" {
		labels["kubeclass.io/cohort"] = sanitizeDNSLabel(trimmed)
	}

	if err := s.ensureNamespace(ctx, namespace, labels); err != nil {
		return Session{}, err
	}

	if err := s.ensureServiceAccount(ctx, namespace); err != nil {
		return Session{}, err
	}

	if err := s.ensureRoleBinding(ctx, namespace); err != nil {
		return Session{}, err
	}

	if err := s.ensureToolboxPod(ctx, namespace, labID); err != nil {
		return Session{}, err
	}

	if err := s.waitForToolboxReady(ctx, namespace); err != nil {
		return Session{}, err
	}

	return Session{
		Enabled:   true,
		LabID:     labID,
		Namespace: namespace,
		PodName:   toolboxPodName,
		Shell:     s.toolboxShell,
		Note:      "Namespace isolado pronto. O terminal usa a service account do proprio lab e o kubectl ja aponta para esse namespace.",
	}, nil
}

func (s *Service) ServeTerminal(response http.ResponseWriter, request *http.Request, session Session) error {
	if !s.Enabled() {
		return fmt.Errorf("runtime real indisponivel")
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	conn, err := upgrader.Upgrade(response, request, nil)
	if err != nil {
		return fmt.Errorf("falha ao abrir websocket: %w", err)
	}
	defer conn.Close()

	stdinReader, stdinWriter := io.Pipe()
	defer stdinReader.Close()

	sizes := &terminalSizeQueue{ch: make(chan remotecommand.TerminalSize, 8)}
	sizes.ch <- remotecommand.TerminalSize{Width: 120, Height: 36}

	writer := &websocketWriter{conn: conn}
	if err := conn.WriteJSON(wsMessage{
		Type: "status",
		Data: fmt.Sprintf("Conectado ao namespace %s.\r\n", session.Namespace),
	}); err != nil {
		return fmt.Errorf("falha ao enviar status inicial: %w", err)
	}

	ctx, cancel := context.WithCancel(request.Context())
	defer cancel()

	readErrCh := make(chan error, 1)
	go func() {
		defer close(readErrCh)
		defer stdinWriter.Close()
		for {
			var message wsMessage
			if err := conn.ReadJSON(&message); err != nil {
				readErrCh <- err
				cancel()
				return
			}

			switch message.Type {
			case "input":
				if _, err := io.WriteString(stdinWriter, message.Data); err != nil {
					readErrCh <- err
					cancel()
					return
				}
			case "resize":
				if message.Cols > 0 && message.Rows > 0 {
					select {
					case sizes.ch <- remotecommand.TerminalSize{Width: message.Cols, Height: message.Rows}:
					default:
					}
				}
			}
		}
	}()

	execRequest := s.clientset.CoreV1().RESTClient().
		Post().
		Resource("pods").
		Name(session.PodName).
		Namespace(session.Namespace).
		SubResource("exec")

	execRequest.VersionedParams(&corev1.PodExecOptions{
		Container: "toolbox",
		Command:   []string{session.Shell, "-i"},
		Stdin:     true,
		Stdout:    true,
		Stderr:    true,
		TTY:       true,
	}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(s.restConfig, http.MethodPost, execRequest.URL())
	if err != nil {
		return fmt.Errorf("falha ao criar executor do terminal: %w", err)
	}

	streamErrCh := make(chan error, 1)
	go func() {
		streamErrCh <- executor.StreamWithContext(ctx, remotecommand.StreamOptions{
			Stdin:             stdinReader,
			Stdout:            writer,
			Stderr:            writer,
			Tty:               true,
			TerminalSizeQueue: sizes,
		})
	}()

	defer func() {
		if err := s.resetToolboxPod(request.Context(), session.Namespace); err != nil {
			log.Printf("falha ao resetar toolbox pod apos fechamento do terminal: %v", err)
		}
	}()

	select {
	case err := <-readErrCh:
		if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
			return nil
		}
		return nil
	case err := <-streamErrCh:
		if err == nil || ctx.Err() != nil {
			return nil
		}
		return fmt.Errorf("falha no streaming do terminal: %w", err)
	case <-ctx.Done():
		return nil
	}
}

func (s *Service) ensureNamespace(ctx context.Context, namespace string, labels map[string]string) error {
	client := s.clientset.CoreV1().Namespaces()
	current, err := client.Get(ctx, namespace, metav1.GetOptions{})
	if err == nil {
		if current.Labels == nil {
			current.Labels = map[string]string{}
		}
		for key, value := range labels {
			current.Labels[key] = value
		}
		if _, err := client.Update(ctx, current, metav1.UpdateOptions{}); err != nil {
			return fmt.Errorf("falha ao atualizar namespace %s: %w", namespace, err)
		}
		return nil
	}
	if !apierrors.IsNotFound(err) {
		return fmt.Errorf("falha ao consultar namespace %s: %w", namespace, err)
	}

	_, err = client.Create(ctx, &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name:   namespace,
			Labels: labels,
		},
	}, metav1.CreateOptions{})
	if err != nil && !apierrors.IsAlreadyExists(err) {
		return fmt.Errorf("falha ao criar namespace %s: %w", namespace, err)
	}

	return nil
}

func (s *Service) ensureServiceAccount(ctx context.Context, namespace string) error {
	client := s.clientset.CoreV1().ServiceAccounts(namespace)
	_, err := client.Get(ctx, toolboxServiceAccount, metav1.GetOptions{})
	if err == nil {
		return nil
	}
	if !apierrors.IsNotFound(err) {
		return fmt.Errorf("falha ao consultar service account do toolbox: %w", err)
	}

	_, err = client.Create(ctx, &corev1.ServiceAccount{
		ObjectMeta: metav1.ObjectMeta{
			Name: toolboxServiceAccount,
		},
	}, metav1.CreateOptions{})
	if err != nil && !apierrors.IsAlreadyExists(err) {
		return fmt.Errorf("falha ao criar service account do toolbox: %w", err)
	}

	return nil
}

func (s *Service) ensureRoleBinding(ctx context.Context, namespace string) error {
	client := s.clientset.RbacV1().RoleBindings(namespace)
	_, err := client.Get(ctx, toolboxRoleBinding, metav1.GetOptions{})
	if err == nil {
		return nil
	}
	if !apierrors.IsNotFound(err) {
		return fmt.Errorf("falha ao consultar rolebinding do toolbox: %w", err)
	}

	_, err = client.Create(ctx, &rbacv1.RoleBinding{
		ObjectMeta: metav1.ObjectMeta{
			Name: toolboxRoleBinding,
		},
		Subjects: []rbacv1.Subject{
			{
				Kind:      "ServiceAccount",
				Name:      toolboxServiceAccount,
				Namespace: namespace,
			},
		},
		RoleRef: rbacv1.RoleRef{
			APIGroup: "rbac.authorization.k8s.io",
			Kind:     "ClusterRole",
			Name:     "edit",
		},
	}, metav1.CreateOptions{})
	if err != nil && !apierrors.IsAlreadyExists(err) {
		return fmt.Errorf("falha ao criar rolebinding do toolbox: %w", err)
	}

	return nil
}

func (s *Service) ensureToolboxPod(ctx context.Context, namespace, labID string) error {
	client := s.clientset.CoreV1().Pods(namespace)
	pod, err := client.Get(ctx, toolboxPodName, metav1.GetOptions{})
	if err == nil {
		if pod.DeletionTimestamp != nil || pod.Status.Phase == corev1.PodFailed || pod.Status.Phase == corev1.PodSucceeded {
			if deleteErr := client.Delete(ctx, toolboxPodName, metav1.DeleteOptions{}); deleteErr != nil && !apierrors.IsNotFound(deleteErr) {
				return fmt.Errorf("falha ao reciclar toolbox pod: %w", deleteErr)
			}
		} else {
			return nil
		}
	}
	if err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("falha ao consultar toolbox pod: %w", err)
	}

	_, err = client.Create(ctx, &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name: toolboxPodName,
			Labels: map[string]string{
				"app.kubernetes.io/name":    "kubeclass-toolbox",
				"app.kubernetes.io/part-of": "kubeclass-web",
				"kubeclass.io/lab-id":       sanitizeDNSLabel(labID),
			},
		},
		Spec: corev1.PodSpec{
			ServiceAccountName: toolboxServiceAccount,
			RestartPolicy:      corev1.RestartPolicyAlways,
			Volumes: []corev1.Volume{
				{
					Name: "workspace",
					VolumeSource: corev1.VolumeSource{
						EmptyDir: &corev1.EmptyDirVolumeSource{},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:            "toolbox",
					Image:           s.toolboxImage,
					ImagePullPolicy: corev1.PullIfNotPresent,
					Command: []string{
						s.toolboxShell,
						"-c",
						"trap 'exit 0' TERM INT; echo 'toolbox pronto'; while true; do sleep 3600; done",
					},
					WorkingDir: "/workspace",
					Env: []corev1.EnvVar{
						{
							Name:  "LAB_NAMESPACE",
							Value: namespace,
						},
						{
							Name:  "LAB_ID",
							Value: labID,
						},
					},
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      "workspace",
							MountPath: "/workspace",
						},
					},
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceCPU:    mustParseQuantity("50m"),
							corev1.ResourceMemory: mustParseQuantity("64Mi"),
						},
						Limits: corev1.ResourceList{
							corev1.ResourceCPU:    mustParseQuantity("250m"),
							corev1.ResourceMemory: mustParseQuantity("256Mi"),
						},
					},
				},
			},
		},
	}, metav1.CreateOptions{})
	if err != nil && !apierrors.IsAlreadyExists(err) {
		return fmt.Errorf("falha ao criar toolbox pod: %w", err)
	}

	return nil
}

func (s *Service) resetToolboxPod(ctx context.Context, namespace string) error {
	if !s.Enabled() {
		return fmt.Errorf("runtime nao habilitado")
	}

	pods := s.clientset.CoreV1().Pods(namespace)
	if err := pods.Delete(ctx, toolboxPodName, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("falha ao deletar toolbox pod: %w", err)
	}

	return nil
}

func (s *Service) waitForToolboxReady(ctx context.Context, namespace string) error {
	deadline := time.Now().Add(90 * time.Second)
	for {
		if time.Now().After(deadline) {
			return fmt.Errorf("timeout aguardando toolbox pod pronto")
		}

		pod, err := s.clientset.CoreV1().Pods(namespace).Get(ctx, toolboxPodName, metav1.GetOptions{})
		if err == nil && pod.Status.Phase == corev1.PodRunning && isPodReady(pod) {
			return nil
		}

		select {
		case <-ctx.Done():
			return fmt.Errorf("operacao cancelada enquanto aguardava toolbox pronto")
		case <-time.After(1 * time.Second):
		}
	}
}

func (s *Service) namespaceNameFor(studentID int64, labID string) string {
	base := fmt.Sprintf("%s-s%d-%s", s.namespacePrefix, studentID, sanitizeDNSLabel(labID))
	if len(base) <= 63 {
		return base
	}

	return base[:63]
}

func (s *Service) StartNamespaceGC(ctx context.Context, interval, maxAge time.Duration) {
	if !s.Enabled() || interval <= 0 || maxAge <= 0 {
		return
	}

	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.collectStaleNamespaces(ctx, maxAge)
			}
		}
	}()
}

func (s *Service) collectStaleNamespaces(ctx context.Context, maxAge time.Duration) {
	if !s.Enabled() {
		return
	}

	namespaces, err := s.clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/managed-by=kubeclass-web",
	})
	if err != nil {
		log.Printf("[labruntime] falha ao listar namespaces para GC: %v", err)
		return
	}

	for _, ns := range namespaces.Items {
		age := time.Since(ns.CreationTimestamp.Time)
		if age < maxAge {
			continue
		}

		// Skip user-managed default-like namespaces.
		if ns.Name == "default" || ns.Name == "kube-system" || ns.Name == "kube-public" {
			continue
		}

		if err := s.purgeNamespace(ctx, ns.Name); err != nil {
			log.Printf("[labruntime] falha ao remover namespace %s: %v", ns.Name, err)
			continue
		}

		log.Printf("[labruntime] namespace %s com %s removido por GC", ns.Name, age)
	}
}

func (s *Service) purgeNamespace(ctx context.Context, namespace string) error {
	if namespace == "" {
		return nil
	}

	return s.clientset.CoreV1().Namespaces().Delete(ctx, namespace, metav1.DeleteOptions{})
}

func buildConfigFromKubeconfig() (*rest.Config, error) {
	candidates := []string{}
	if fromEnv := strings.TrimSpace(os.Getenv("KUBECONFIG")); fromEnv != "" {
		candidates = append(candidates, fromEnv)
	}
	if homeDir, err := os.UserHomeDir(); err == nil {
		candidates = append(candidates, filepath.Join(homeDir, ".kube", "config"))
	}

	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return clientcmd.BuildConfigFromFlags("", candidate)
		}
	}

	return nil, fmt.Errorf("kubeconfig nao encontrado")
}

func isFalsey(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "0", "false", "off", "no":
		return true
	default:
		return false
	}
}

func valueOrDefault(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}

	return value
}

var invalidDNSChars = regexp.MustCompile(`[^a-z0-9-]+`)

func sanitizeDNSLabel(value string) string {
	slug := strings.ToLower(strings.TrimSpace(value))
	slug = strings.ReplaceAll(slug, "_", "-")
	slug = invalidDNSChars.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		return "lab"
	}

	return slug
}

func isPodReady(pod *corev1.Pod) bool {
	for _, condition := range pod.Status.Conditions {
		if condition.Type == corev1.PodReady && condition.Status == corev1.ConditionTrue {
			return true
		}
	}

	return false
}

func mustParseQuantity(value string) resource.Quantity {
	return resource.MustParse(value)
}
