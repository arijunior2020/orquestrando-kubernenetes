# Arquitetura Hospedada

Este projeto deve ser tratado como uma plataforma web hospedada no seu servidor, conectada a um cluster Kubernetes ja existente. A experiencia desejada deixa de ser "cada aluno roda localmente" e passa a ser "cada aluno entra no navegador, recebe um ambiente isolado e pratica no cluster real da disciplina".

## Objetivo

Entregar um ambiente de laboratorio web para turmas de Kubernetes com:

- acesso por navegador;
- progresso por aluno;
- editor e terminal web;
- validacao automatica;
- isolamento seguro entre alunos;
- desafio final com correcao orientada por rubrica.

## Arquitetura recomendada

### 1. Frontend web

Aplicacao SPA servida pelo backend.

Responsabilidades:

- autenticacao do aluno;
- exibicao da trilha dos 6 encontros;
- editor YAML;
- terminal web;
- submissao para validacao;
- visualizacao de progresso, nota e feedback.

### 2. Backend da plataforma

API central para coordenar sessao, acesso ao cluster e avaliacao.

Responsabilidades:

- login e sessao;
- provisionamento do laboratorio do aluno;
- criacao e limpeza de namespaces;
- abertura de terminal remoto via WebSocket;
- aplicacao e validacao de manifests;
- persistencia de progresso e entregas;
- painel do instrutor.

### 3. Cluster Kubernetes da disciplina

O cluster ja hospedado vira o ambiente real de execucao dos laboratorios.

Modelo recomendado:

- um namespace por aluno e por laboratorio ou por modulo;
- quotas e limit ranges por namespace;
- service account por sessao ou por aluno;
- RBAC restrito ao proprio namespace;
- network policies para impedir trafego lateral entre alunos;
- cleanup automatico ao fim da aula ou da avaliacao.

### 4. Runner de terminal

Nao exponha `kubectl` diretamente na maquina do servidor para o navegador.

Modelo mais seguro:

- backend cria um Pod toolbox no namespace do aluno;
- frontend conecta em WebSocket no backend;
- backend faz bridge da sessao para `exec` no Pod toolbox;
- o aluno usa `kubectl` dentro desse Pod, limitado pelo RBAC do proprio namespace.

Imagem sugerida do toolbox:

- `kubectl`
- `k9s` opcional
- `helm` opcional
- `bash` ou `sh`
- utilitarios basicos (`curl`, `jq`, `yq`)

### 5. Motor de validacao

Deve haver dois niveis de avaliacao:

- validacao estatica do YAML:
  confere nomes, kinds, probes, services, ingress, hpa e convencoes do lab;
- validacao real no cluster:
  aplica os manifests no namespace do aluno e checa estado com `kubectl get`, `kubectl wait`, `kubectl describe` e asserts automatizados.

## Fluxo por aluno

1. O aluno faz login na plataforma.
2. O backend identifica a turma e o encontro ativo.
3. O backend cria ou reutiliza um namespace isolado, por exemplo `turma1-aluno12-lab3`.
4. O backend cria o Pod toolbox e associa um ServiceAccount restrito.
5. O aluno usa editor e terminal no navegador.
6. Ao validar, o backend executa checks estaticos e checks reais no cluster.
7. O resultado fica salvo para instrutor e aluno.
8. Ao final da aula ou por timeout, o ambiente e limpo.

## Modelo de isolamento

O melhor equilibrio para sua disciplina e:

- um cluster compartilhado da turma;
- um namespace por aluno;
- quotas por namespace;
- RBAC e network policy por namespace.

Evite, no inicio:

- um cluster inteiro por aluno;
- acesso direto do navegador ao API Server;
- credenciais administrativas compartilhadas;
- uso do namespace `default`.

## Componentes minimos de infraestrutura

- `frontend` e `backend` da plataforma;
- banco para persistencia:
  PostgreSQL e suficiente;
- Redis opcional para sessao, fila ou WebSocket scaling;
- Ingress Controller;
- cert-manager se quiser TLS automatico;
- storage class para volumes temporarios se algum lab precisar persistencia;
- observabilidade basica da propria plataforma.

## Dados que precisam ser persistidos

- usuario;
- turma;
- encontro atual;
- estado do laboratorio;
- rascunho YAML;
- tentativas de validacao;
- nota do desafio final;
- evidencias e timestamps.

## Modelo de avaliacao final

No desafio final, a correcao nao deve depender so do YAML escrito.

A avaliacao ideal combina:

- aderencia estrutural do manifesto;
- aplicacao bem sucedida no namespace do aluno;
- health dos recursos;
- evidencias de operacao;
- rubrica preenchida pelo instrutor.

## Roadmap tecnico recomendado

### Fase 1

Transformar o MVP atual em plataforma hospedada:

- autenticacao;
- banco de dados;
- progresso salvo no servidor;
- turmas e alunos;
- painel do instrutor.

### Fase 2

Adicionar ambiente real no cluster:

- namespaces efemeros;
- toolbox Pod;
- terminal web com WebSocket;
- validacao no cluster.

### Fase 3

Fechar a operacao academica:

- agenda por encontro;
- liberacao de labs por data;
- desafio final com nota;
- relatorios por aluno e por turma.

## Decisoes recomendadas

- Multiusuario: sim.
- Namespace por aluno: sim.
- Cluster por aluno: nao, exceto se houver necessidade extrema de isolamento.
- Validacao estatica + real: sim.
- Terminal web mediado pelo backend: sim.
- Autenticacao antes de liberar terminal: obrigatorio.

## Proximo passo de implementacao

O proximo passo mais correto neste repositorio e substituir a ideia de "rascunho apenas no navegador" por uma arquitetura com backend persistente e sessao real de laboratorio. Depois disso, entramos na integracao com o cluster hospedado.
