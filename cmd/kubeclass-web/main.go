package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/content"
	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/httpapi"
	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/labruntime"
	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/store"
	"github.com/arimateia-junior/orquestrando-kubernenetes/internal/validation"
)

func main() {
	rootDir := "."
	if envRoot := os.Getenv("APP_ROOT"); envRoot != "" {
		rootDir = envRoot
	}

	contentDir := resolvePath(rootDir, "content", os.Getenv("CONTENT_DIR"))
	staticDir := resolvePath(rootDir, "public", os.Getenv("STATIC_DIR"))
	dbPath := resolvePath(rootDir, filepath.Join("data", "kubeclass.db"), os.Getenv("DB_PATH"))
	address := resolveAddress(os.Getenv("HOST"), os.Getenv("PORT"))

	courseService, err := content.NewCourseService(filepath.Join(contentDir, "course.json"))
	if err != nil {
		log.Fatalf("erro ao carregar course.json: %v", err)
	}

	validationService, err := validation.NewService(filepath.Join(contentDir, "validators.json"))
	if err != nil {
		log.Fatalf("erro ao carregar validators.json: %v", err)
	}

	sqliteStore, err := store.NewSQLiteStore(dbPath)
	if err != nil {
		log.Fatalf("erro ao abrir sqlite: %v", err)
	}

	runtimeService, err := labruntime.NewServiceFromEnv()
	if err != nil {
		log.Fatalf("erro ao inicializar runtime kubernetes: %v", err)
	}

	server, err := httpapi.NewServer(staticDir, courseService, validationService, sqliteStore, runtimeService)
	if err != nil {
		log.Fatalf("erro ao configurar servidor HTTP: %v", err)
	}

	cleanupCtx, cleanupCancel := context.WithCancel(context.Background())
	defer cleanupCancel()
	go sqliteStore.StartSessionCleanup(cleanupCtx, 30*time.Minute)

	if runtimeService.Enabled() {
		namespaceGCInterval := parseDurationOrDefault(os.Getenv("LAB_NAMESPACE_GC_INTERVAL"), 30*time.Minute)
		namespaceMaxAge := parseDurationOrDefault(os.Getenv("LAB_NAMESPACE_MAX_AGE"), 6*time.Hour)
		go runtimeService.StartNamespaceGC(cleanupCtx, namespaceGCInterval, namespaceMaxAge)
	}

	log.Printf("KubeClass Web Lab rodando em http://%s", address)
	if err := http.ListenAndServe(address, server.Handler()); err != nil {
		log.Fatalf("erro ao iniciar servidor: %v", err)
	}
}

func resolvePath(rootDir, defaultChild, fromEnv string) string {
	if fromEnv != "" {
		return fromEnv
	}

	return filepath.Join(rootDir, defaultChild)
}

func resolveAddress(host, port string) string {
	if host == "" {
		host = "127.0.0.1"
	}

	if port == "" {
		port = "3000"
	}

	return host + ":" + port
}

func parseDurationOrDefault(value string, fallback time.Duration) time.Duration {
	if strings.TrimSpace(value) == "" {
		return fallback
	}

	duration, err := time.ParseDuration(value)
	if err != nil {
		log.Printf("valor de duracao invalido: %q, usando padrao %s", value, fallback)
		return fallback
	}

	return duration
}
