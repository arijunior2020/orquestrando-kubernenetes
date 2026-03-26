package validation

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"regexp"
	"strings"

	utilyaml "k8s.io/apimachinery/pkg/util/yaml"
)

type Rule struct {
	Label   string `json:"label"`
	Pattern string `json:"pattern"`
	Details string `json:"details"`
}

type compiledRule struct {
	label   string
	details string
	regex   *regexp.Regexp
}

type CheckResult struct {
	Label   string `json:"label"`
	Passed  bool   `json:"passed"`
	Details string `json:"details"`
}

type Result struct {
	LabID        string        `json:"labId"`
	Checks       []CheckResult `json:"checks"`
	PassedChecks int           `json:"passedChecks"`
	TotalChecks  int           `json:"totalChecks"`
	Score        int           `json:"score"`
	AllPassed    bool          `json:"allPassed"`
}

type manifest map[string]any
type semanticValidator func([]manifest) map[string]bool

type Service struct {
	rules    map[string][]compiledRule
	semantic map[string]semanticValidator
}

func NewService(path string) (*Service, error) {
	payload, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("falha ao ler arquivo de validadores: %w", err)
	}

	var raw map[string][]Rule
	if err := json.Unmarshal(payload, &raw); err != nil {
		return nil, fmt.Errorf("falha ao decodificar validadores: %w", err)
	}

	out := make(map[string][]compiledRule, len(raw))
	for labID, rules := range raw {
		out[labID] = make([]compiledRule, 0, len(rules))
		for _, rule := range rules {
			expression, err := regexp.Compile(rule.Pattern)
			if err != nil {
				return nil, fmt.Errorf("regex invalida no lab %s: %w", labID, err)
			}

			out[labID] = append(out[labID], compiledRule{
				label:   rule.Label,
				details: rule.Details,
				regex:   expression,
			})
		}
	}

	return &Service{
		rules:    out,
		semantic: defaultSemanticValidators(),
	}, nil
}

func (s *Service) Validate(labID, solution string) (Result, error) {
	if strings.TrimSpace(labID) == "" {
		return Result{}, fmt.Errorf("labId obrigatorio")
	}

	rules, found := s.rules[labID]
	if !found {
		return Result{}, fmt.Errorf("lab desconhecido: %s", labID)
	}

	normalized := strings.ReplaceAll(solution, "\r", "")
	useSemantic := false
	semanticResults := map[string]bool{}

	if validator, found := s.semantic[labID]; found {
		useSemantic = true
		manifests, err := parseManifests(normalized)
		if err != nil {
			semanticResults = failedSemanticResults(rules)
		} else {
			semanticResults = validator(manifests)
		}
	}

	checks := make([]CheckResult, 0, len(rules))
	passedChecks := 0

	for _, rule := range rules {
		passed := rule.regex.MatchString(normalized)
		if useSemantic {
			passed = semanticResults[rule.label]
		}

		if passed {
			passedChecks++
		}

		checks = append(checks, CheckResult{
			Label:   rule.label,
			Passed:  passed,
			Details: rule.details,
		})
	}

	totalChecks := len(checks)
	score := 0
	if totalChecks > 0 {
		score = int(math.Round((float64(passedChecks) / float64(totalChecks)) * 100))
	}

	return Result{
		LabID:        labID,
		Checks:       checks,
		PassedChecks: passedChecks,
		TotalChecks:  totalChecks,
		Score:        score,
		AllPassed:    passedChecks == totalChecks,
	}, nil
}

func parseManifests(solution string) ([]manifest, error) {
	decoder := utilyaml.NewYAMLOrJSONDecoder(bytes.NewBufferString(solution), 4096)
	manifests := make([]manifest, 0, 8)

	for {
		raw := map[string]any{}
		err := decoder.Decode(&raw)
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if len(raw) == 0 {
			continue
		}

		manifests = append(manifests, manifest(raw))
	}

	return manifests, nil
}

func failedSemanticResults(rules []compiledRule) map[string]bool {
	results := make(map[string]bool, len(rules))
	for _, rule := range rules {
		results[rule.label] = false
	}
	return results
}

func defaultSemanticValidators() map[string]semanticValidator {
	return map[string]semanticValidator{
		"lab-1":           validateLab1,
		"lab-2":           validateLab2,
		"lab-3":           validateLab3,
		"lab-4":           validateLab4,
		"lab-5":           validateLab5,
		"challenge-final": validateChallengeFinal,
	}
}

func validateLab1(manifests []manifest) map[string]bool {
	namespace := findManifest(manifests, "Namespace", "team-dev")
	pod := findManifest(manifests, "Pod", "nginx-lab")

	return map[string]bool{
		"APIs v1 nos manifests":     manifestUsesAPIVersion(namespace, "v1") && manifestUsesAPIVersion(pod, "v1"),
		"Namespace team-dev criado": namespace != nil,
		"Pod nginx-lab criado":      pod != nil,
		"Pod no namespace correto":  pod != nil && metadataString(pod, "namespace") == "team-dev",
		"Imagem nginx utilizada":    strings.HasPrefix(firstContainerImage(pod), "nginx"),
	}
}

func validateLab2(manifests []manifest) map[string]bool {
	namespace := findManifest(manifests, "Namespace", "apps")
	deployment := findManifest(manifests, "Deployment", "api-demo")
	service := findManifest(manifests, "Service", "api-demo-svc")

	return map[string]bool{
		"APIs corretas do Deployment e Service": manifestUsesAPIVersion(namespace, "v1") &&
			manifestUsesAPIVersion(deployment, "apps/v1") &&
			manifestUsesAPIVersion(service, "v1"),
		"Deployment api-demo criado":     deployment != nil,
		"Deployment com 3 replicas":      deployment != nil && nestedInt(specMap(deployment), "replicas") == 3,
		"Service api-demo-svc criado":    service != nil,
		"Service seleciona app api-demo": selectorValue(service, "app") == "api-demo",
		"Porta 80 exposta":               serviceHasPort(service, 80, 80),
	}
}

func validateLab3(manifests []manifest) map[string]bool {
	namespace := findManifest(manifests, "Namespace", "web")
	deployment := findManifest(manifests, "Deployment", "webapp")
	service := findManifest(manifests, "Service", "webapp-service")
	ingress := findManifest(manifests, "Ingress", "webapp-ingress")

	return map[string]bool{
		"APIs corretas de Service e Ingress": manifestUsesAPIVersion(namespace, "v1") &&
			manifestUsesAPIVersion(deployment, "apps/v1") &&
			manifestUsesAPIVersion(service, "v1") &&
			manifestUsesAPIVersion(ingress, "networking.k8s.io/v1"),
		"Service webapp-service criado":      service != nil,
		"Ingress webapp-ingress criado":      ingress != nil,
		"Host kubeclass.local configurado":   ingressHasHost(ingress, "kubeclass.local"),
		"Ingress aponta para webapp-service": ingressUsesService(ingress, "webapp-service"),
	}
}

func validateLab4(manifests []manifest) map[string]bool {
	namespace := findManifest(manifests, "Namespace", "config")
	configMap := findManifest(manifests, "ConfigMap", "app-config")
	secret := findManifest(manifests, "Secret", "app-secret")
	deployment := findManifest(manifests, "Deployment", "config-api")
	container := firstContainer(deployment)

	return map[string]bool{
		"APIs corretas dos manifests": manifestUsesAPIVersion(namespace, "v1") &&
			manifestUsesAPIVersion(configMap, "v1") &&
			manifestUsesAPIVersion(secret, "v1") &&
			manifestUsesAPIVersion(deployment, "apps/v1"),
		"ConfigMap app-config criado":             configMap != nil,
		"Secret app-secret criado":                secret != nil,
		"Deployment config-api criado":            deployment != nil,
		"ConfigMap consumido via configMapKeyRef": containerEnvRef(container, "configMapKeyRef", "app-config"),
		"Secret consumido via secretKeyRef":       containerEnvRef(container, "secretKeyRef", "app-secret"),
		"Readiness probe declarada":               hasMapKey(container, "readinessProbe"),
		"Liveness probe declarada":                hasMapKey(container, "livenessProbe"),
		"Requests e limits definidos":             containerHasRequestsAndLimits(container),
	}
}

func validateLab5(manifests []manifest) map[string]bool {
	namespace := findManifest(manifests, "Namespace", "data")
	service := findManifest(manifests, "Service", "redis-headless")
	statefulset := findManifest(manifests, "StatefulSet", "redis-cache")
	job := findManifest(manifests, "Job", "seed-cache")

	return map[string]bool{
		"APIs corretas do StatefulSet e Job": manifestUsesAPIVersion(namespace, "v1") &&
			manifestUsesAPIVersion(service, "v1") &&
			manifestUsesAPIVersion(statefulset, "apps/v1") &&
			manifestUsesAPIVersion(job, "batch/v1"),
		"Service redis-headless criado":         service != nil,
		"Headless service configurado":          strings.EqualFold(nestedString(specMap(service), "clusterIP"), "None"),
		"StatefulSet redis-cache criado":        statefulset != nil,
		"StatefulSet usa o serviceName correto": nestedString(specMap(statefulset), "serviceName") == "redis-headless",
		"Persistencia com volumeClaimTemplates": len(nestedSlice(specMap(statefulset), "volumeClaimTemplates")) > 0,
		"Job seed-cache criado":                 job != nil,
	}
}

func validateChallengeFinal(manifests []manifest) map[string]bool {
	namespace := findManifest(manifests, "Namespace", "delivery-final")
	storefront := findManifest(manifests, "Deployment", "storefront")
	storefrontService := findManifest(manifests, "Service", "storefront-svc")
	ordersAPI := findManifest(manifests, "Deployment", "orders-api")
	ordersService := findManifest(manifests, "Service", "orders-api-svc")
	configMap := findManifest(manifests, "ConfigMap", "orders-config")
	secret := findManifest(manifests, "Secret", "orders-secret")
	ingress := findManifest(manifests, "Ingress", "delivery-ingress")
	hpa := findManifest(manifests, "HorizontalPodAutoscaler", "orders-api-hpa")

	return map[string]bool{
		"APIs corretas dos manifests entregues": manifestUsesAPIVersion(namespace, "v1") &&
			manifestUsesAPIVersion(storefront, "apps/v1") &&
			manifestUsesAPIVersion(storefrontService, "v1") &&
			manifestUsesAPIVersion(ordersAPI, "apps/v1") &&
			manifestUsesAPIVersion(ordersService, "v1") &&
			manifestUsesAPIVersion(configMap, "v1") &&
			manifestUsesAPIVersion(secret, "v1") &&
			manifestUsesAPIVersion(ingress, "networking.k8s.io/v1") &&
			manifestUsesAPIVersion(hpa, "autoscaling/v2"),
		"Namespace delivery-final criado":                  namespace != nil,
		"Deployment storefront com 2 replicas":             storefront != nil && nestedInt(specMap(storefront), "replicas") == 2,
		"Service storefront-svc criado":                    storefrontService != nil,
		"Deployment orders-api com 2 replicas":             ordersAPI != nil && nestedInt(specMap(ordersAPI), "replicas") == 2,
		"Service orders-api-svc criado":                    ordersService != nil,
		"ConfigMap orders-config criado":                   configMap != nil,
		"Secret orders-secret criado":                      secret != nil,
		"Ingress delivery-ingress com host delivery.local": ingress != nil && ingressHasHost(ingress, "delivery.local"),
		"Probes declaradas na API":                         hasMapKey(firstContainer(ordersAPI), "readinessProbe") && hasMapKey(firstContainer(ordersAPI), "livenessProbe"),
		"Requests e limits presentes":                      containerHasRequestsAndLimits(firstContainer(storefront)) && containerHasRequestsAndLimits(firstContainer(ordersAPI)),
		"HPA orders-api-hpa criado":                        hpa != nil,
	}
}

func findManifest(manifests []manifest, kind, name string) manifest {
	for _, item := range manifests {
		if strings.EqualFold(rootString(item, "kind"), kind) && metadataString(item, "name") == name {
			return item
		}
	}

	return nil
}

func manifestUsesAPIVersion(item manifest, expected string) bool {
	return item != nil && strings.EqualFold(rootString(item, "apiVersion"), expected)
}

func metadataString(item manifest, key string) string {
	return nestedString(map[string]any(item), "metadata", key)
}

func specMap(item manifest) map[string]any {
	return nestedMap(map[string]any(item), "spec")
}

func podSpec(item manifest) map[string]any {
	if item == nil {
		return nil
	}

	kind := rootString(item, "kind")
	if kind == "Pod" {
		return specMap(item)
	}

	spec := specMap(item)
	if templateSpec := nestedMap(spec, "template", "spec"); len(templateSpec) > 0 {
		return templateSpec
	}

	return spec
}

func firstContainer(item manifest) map[string]any {
	containers := nestedSlice(podSpec(item), "containers")
	if len(containers) == 0 {
		return nil
	}

	return toMap(containers[0])
}

func firstContainerImage(item manifest) string {
	return nestedString(firstContainer(item), "image")
}

func selectorValue(item manifest, key string) string {
	return nestedString(specMap(item), "selector", key)
}

func serviceHasPort(item manifest, port, targetPort int) bool {
	ports := nestedSlice(specMap(item), "ports")
	for _, raw := range ports {
		portSpec := toMap(raw)
		if toInt(portSpec["port"]) == port && toInt(portSpec["targetPort"]) == targetPort {
			return true
		}
	}

	return false
}

func ingressHasHost(item manifest, host string) bool {
	rules := nestedSlice(specMap(item), "rules")
	for _, raw := range rules {
		if nestedString(toMap(raw), "host") == host {
			return true
		}
	}

	return false
}

func ingressUsesService(item manifest, serviceName string) bool {
	rules := nestedSlice(specMap(item), "rules")
	for _, rawRule := range rules {
		rule := toMap(rawRule)
		paths := nestedSlice(rule, "http", "paths")
		for _, rawPath := range paths {
			path := toMap(rawPath)
			if nestedString(path, "backend", "service", "name") == serviceName {
				return true
			}
		}
	}

	return false
}

func containerEnvRef(container map[string]any, refType, refName string) bool {
	envList := nestedSlice(container, "env")
	for _, raw := range envList {
		envVar := toMap(raw)
		if nestedString(envVar, "valueFrom", refType, "name") == refName {
			return true
		}
	}

	return false
}

func containerHasRequestsAndLimits(container map[string]any) bool {
	requests := nestedMap(container, "resources", "requests")
	limits := nestedMap(container, "resources", "limits")
	return len(requests) > 0 && len(limits) > 0
}

func hasMapKey(container map[string]any, key string) bool {
	value, found := container[key]
	if !found {
		return false
	}

	switch typed := value.(type) {
	case map[string]any:
		return len(typed) > 0
	case manifest:
		return len(typed) > 0
	default:
		return value != nil
	}
}

func rootString(item manifest, key string) string {
	return strings.TrimSpace(toString(item[key]))
}

func nestedString(data map[string]any, keys ...string) string {
	if len(keys) == 0 {
		return ""
	}

	current := data
	for index, key := range keys {
		value, found := current[key]
		if !found {
			return ""
		}

		if index == len(keys)-1 {
			return strings.TrimSpace(toString(value))
		}

		current = toMap(value)
		if len(current) == 0 {
			return ""
		}
	}

	return ""
}

func nestedInt(data map[string]any, keys ...string) int {
	if len(keys) == 0 {
		return 0
	}

	current := data
	for index, key := range keys {
		value, found := current[key]
		if !found {
			return 0
		}

		if index == len(keys)-1 {
			return toInt(value)
		}

		current = toMap(value)
		if len(current) == 0 {
			return 0
		}
	}

	return 0
}

func nestedMap(data map[string]any, keys ...string) map[string]any {
	current := data
	for _, key := range keys {
		value, found := current[key]
		if !found {
			return map[string]any{}
		}

		current = toMap(value)
		if len(current) == 0 {
			return map[string]any{}
		}
	}

	return current
}

func nestedSlice(data map[string]any, keys ...string) []any {
	if len(keys) == 0 {
		return nil
	}

	current := data
	for index, key := range keys {
		value, found := current[key]
		if !found {
			return nil
		}

		if index == len(keys)-1 {
			switch typed := value.(type) {
			case []any:
				return typed
			default:
				return nil
			}
		}

		current = toMap(value)
		if len(current) == 0 {
			return nil
		}
	}

	return nil
}

func toMap(value any) map[string]any {
	switch typed := value.(type) {
	case map[string]any:
		return typed
	case manifest:
		return map[string]any(typed)
	default:
		return map[string]any{}
	}
}

func toInt(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case float32:
		return int(typed)
	default:
		return 0
	}
}

func toString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	case int:
		return fmt.Sprintf("%d", typed)
	case int64:
		return fmt.Sprintf("%d", typed)
	case float64:
		if math.Mod(typed, 1) == 0 {
			return fmt.Sprintf("%.0f", typed)
		}
		return fmt.Sprintf("%v", typed)
	default:
		return fmt.Sprintf("%v", value)
	}
}
