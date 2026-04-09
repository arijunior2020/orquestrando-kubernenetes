FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache build-base

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o /out/kubeclass-web ./cmd/kubeclass-web

FROM alpine:3.20

ARG KUBECONFORM_VERSION=v0.7.0

WORKDIR /app

RUN apk add --no-cache \
    bash \
    ca-certificates \
    curl \
    jq \
    kubectl \
    nano \
    vim \
  && arch="$(apk --print-arch)" \
  && case "$arch" in \
      x86_64) kubeconform_arch="amd64" ;; \
      aarch64) kubeconform_arch="arm64" ;; \
      *) echo "unsupported architecture for kubeconform: $arch" >&2; exit 1 ;; \
    esac \
  && curl -fsSL "https://github.com/yannh/kubeconform/releases/download/${KUBECONFORM_VERSION}/kubeconform-linux-${kubeconform_arch}.tar.gz" -o /tmp/kubeconform.tar.gz \
  && tar -xzf /tmp/kubeconform.tar.gz -C /usr/local/bin kubeconform \
  && chmod +x /usr/local/bin/kubeconform \
  && rm -f /tmp/kubeconform.tar.gz

COPY --from=builder /out/kubeclass-web /usr/local/bin/kubeclass-web
COPY public ./public
COPY content ./content

RUN mkdir -p /app/data

ENV HOST=0.0.0.0
ENV PORT=3000
ENV STATIC_DIR=/app/public
ENV CONTENT_DIR=/app/content
ENV DB_PATH=/app/data/kubeclass.db

EXPOSE 3000

CMD ["kubeclass-web"]
