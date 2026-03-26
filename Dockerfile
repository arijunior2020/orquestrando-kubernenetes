FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache build-base

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o /out/kubeclass-web ./cmd/kubeclass-web

FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates

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
