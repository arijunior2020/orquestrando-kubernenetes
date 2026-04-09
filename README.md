# KubeClass Web Lab

Base inicial da plataforma web da sua disciplina de Orquestracao de Kubernetes, agora com backend em Go e preparada para evoluir para o modelo hospedado com cluster real.

## O que existe agora

- trilha cronologica com 6 encontros;
- 5 encontros com `2h teoria + 2h pratica`;
- encontro final com `4h` de desafio;
- frontend web com editor, progresso e validacao;
- backend em Go para servir a SPA e a API;
- persistencia local com SQLite para alunos, turmas, workspaces e submissões;
- terminal web real com `xterm.js`, `WebSocket`, namespace e toolbox pod por aluno;
- conteudo dos labs desacoplado em JSON;
- validacao de manifests orientada por regras;
- Dockerfile para empacotar a plataforma.
- imagem do toolbox com `kubectl`, `kubeconform`, `nano` e `vim` para os labs.
- estrutura inicial do piloto `EC2 + k3s`.

## Estrutura principal

- [cmd/kubeclass-web/main.go](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/cmd/kubeclass-web/main.go): ponto de entrada do servidor Go.
- [internal/httpapi/server.go](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/internal/httpapi/server.go): rotas HTTP, API e entrega dos arquivos estaticos.
- [internal/store/sqlite.go](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/internal/store/sqlite.go): persistencia local com SQLite para sessao academica e entregas.
- [internal/labruntime/service.go](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/internal/labruntime/service.go): provisionamento do runtime real do lab no cluster e streaming do terminal.
- [internal/content/service.go](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/internal/content/service.go): carregamento do conteudo pedagogico.
- [internal/validation/service.go](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/internal/validation/service.go): validacao dos manifests.
- [content/course.json](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/content/course.json): definicao da disciplina, encontros e desafio final.
- [content/validators.json](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/content/validators.json): regras declarativas de validacao.
- [public/app.js](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/public/app.js): interface atual da plataforma.
- [docs/hosted-architecture.md](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/docs/hosted-architecture.md): arquitetura alvo para rodar no seu servidor com cluster.
- [docs/pilot-ec2-k3s.md](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/docs/pilot-ec2-k3s.md): arquitetura e operacao do piloto de baixo custo.
- [docs/backlog-pilot.md](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/docs/backlog-pilot.md): backlog tecnico por sprint.
- [infra/terraform/aws-ec2-k3s/main.tf](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/infra/terraform/aws-ec2-k3s/main.tf): provisionamento inicial da VM do piloto.
- [deploy/k8s/platform/kustomization.yaml](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/deploy/k8s/platform/kustomization.yaml): base de deploy da plataforma no cluster.
- [deploy/k8s/platform/pvc.yaml](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/deploy/k8s/platform/pvc.yaml): volume persistente para o arquivo do SQLite no k3s.

## Como rodar localmente

```bash
go run ./cmd/kubeclass-web
```

Abra `http://127.0.0.1:3000`.

## Como testar

```bash
env GOCACHE=/tmp/go-build-cache go test ./...
```

## Comandos uteis

```bash
make run
make test
make build
make docker-build
make terraform-fmt
```

## Como empacotar

```bash
docker build -t kubeclass-web-lab .
docker run -p 3000:3000 kubeclass-web-lab
```

O banco local fica em `/app/data/kubeclass.db` no container.

Quando o runtime real estiver habilitado, o pod `toolbox` pode reutilizar a mesma imagem da plataforma, desde que a tag configurada em `TOOLBOX_IMAGE` exista no cluster.

## O que a API expõe agora

- `GET /api/course`: trilha completa da disciplina;
- `POST /api/session/upsert`: cria ou atualiza a sessao do aluno em uma turma;
- `GET /api/dashboard?studentId=...`: retorna progresso, rascunhos e submissões;
- `POST /api/workspaces/save`: salva rascunho, terminal e checklist do lab;
- `POST /api/validate`: valida o manifesto e, se houver aluno conectado, registra submissão.
- `POST /api/runtime/open`: garante namespace, service account, rolebinding e toolbox do aluno.
- `GET /api/terminal/ws`: abre o terminal WebSocket ligado ao pod toolbox.

## Modelo hospedado recomendado

O desenho correto para sua operacao e:

1. frontend web;
2. backend Go;
3. cluster Kubernetes da disciplina;
4. namespace por aluno;
5. terminal web mediado pelo backend;
6. validacao estatica + validacao real no cluster.

Os detalhes estao em [docs/hosted-architecture.md](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/docs/hosted-architecture.md).

## Estrutura do piloto economico

Para a primeira turma, a estrutura escolhida e:

1. `1 EC2` publica;
2. `k3s` no proprio host;
3. `Traefik` padrao do k3s;
4. plataforma Go no namespace `platform`;
5. instancia ligada so nas aulas e nos testes.

Detalhes em [docs/pilot-ec2-k3s.md](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/docs/pilot-ec2-k3s.md).

## Proximo passo tecnico

O proximo passo mais importante nao e mexer no layout. E integrar o backend Go ao cluster:

1. autenticacao e usuarios;
2. persistencia em banco;
3. criacao de namespace por aluno;
4. Pod toolbox com `kubectl`;
5. terminal via WebSocket;
6. painel do instrutor e nota final.

## Ordem imediata de implantacao

1. ajustar `terraform.tfvars` do piloto;
2. provisionar a EC2 com Terraform;
3. buildar a imagem e publicar em um registry;
4. ajustar o host em [deploy/k8s/platform/ingress.yaml](/media/arimateia-junior/Dados/projetos/orquestrando-kubernenetes/deploy/k8s/platform/ingress.yaml);
5. aplicar os manifests em `deploy/k8s/platform/`, incluindo PVC, ServiceAccount e RBAC do runtime;
6. validar `healthz`, `api/course`, `api/session/upsert` e `api/validate`.
