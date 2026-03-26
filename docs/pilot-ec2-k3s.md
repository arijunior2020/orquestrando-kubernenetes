# Piloto EC2 + k3s

Este documento fixa a arquitetura do piloto que cabe no teto de custo definido para a primeira turma. O objetivo nao e alta disponibilidade nem multiambiente sofisticado. O objetivo e ter um ambiente web funcional, barato e previsivel para validar o modelo da disciplina.

## Objetivo do piloto

- publicar a plataforma web em uma VM EC2;
- rodar um cluster `k3s` no mesmo host;
- permitir deploy da aplicacao Go no cluster;
- manter o custo sob controle ligando a instancia apenas nas aulas e nos testes;
- preparar a base para evoluir depois para sessao por aluno, toolbox pod e terminal WebSocket.

## Arquitetura escolhida

Fluxo:

1. o aluno acessa a plataforma via navegador;
2. o DNS aponta para a VM EC2 do piloto;
3. a VM executa `k3s` com `Traefik` e `local-path` storage;
4. a aplicacao `kubeclass-web` roda no namespace `platform`;
5. os labs futuros rodarao em namespaces separados.

## Topologia inicial

- `1 EC2` publica;
- `Ubuntu 24.04`;
- `k3s server` no proprio host;
- `Traefik` padrao do k3s;
- aplicacao Go em container no cluster;
- `SQLite` ou persistencia simples no inicio;
- backup e banco gerenciado ficam para fase seguinte.

## Tamanho operacional recomendado

Para o piloto:

- aulas 1 a 5:
  `m5a.2xlarge` e um bom ponto de partida;
- desafio final:
  subir a maquina para `m5a.4xlarge`.

Observacao:

- isso funciona se os labs forem leves e com quotas agressivas;
- se todos os 40 alunos passarem a subir multiplos pods pesados ao mesmo tempo, o piloto deixa de ser barato e pede outra arquitetura.

## Regras de custo

Para manter o custo baixo:

- nao usar `EKS` no piloto;
- nao usar `NAT Gateway`;
- nao usar `ALB` no piloto;
- nao deixar a EC2 ligada 24/7;
- evitar `Elastic IP` fixo o mes todo se quiser economizar;
- manter o disco `gp3` enxuto;
- manter observabilidade no minimo necessario.

## Regras de seguranca

- liberar `22` apenas para seus CIDRs administrativos;
- expor apenas `80` e `443` para a internet;
- nao expor `6443` do Kubernetes para a internet por padrao;
- manter IMDSv2 habilitado;
- usar usuario sem privilegios para operacao cotidiana;
- isolar o namespace `platform` desde o inicio.

## Estrutura do repositorio para o piloto

- `infra/terraform/aws-ec2-k3s/`: provisionamento da VM e bootstrap do k3s.
- `deploy/k8s/platform/`: manifests base da plataforma no cluster.
- `docs/backlog-pilot.md`: backlog tecnico do piloto.
- `docs/hosted-architecture.md`: alvo de longo prazo.

## Ordem de execucao

1. provisionar a EC2 com Terraform;
2. bootstrap do k3s por `user_data`;
3. build da imagem da aplicacao;
4. publicar a imagem em um registry;
5. aplicar os manifests do namespace `platform`;
6. validar `healthz`, `course` e `validate`;
7. instrumentar logs e monitorar uso de CPU e memoria durante a aula.

## O que fica para a fase seguinte

- login;
- banco persistente de verdade;
- sessao por aluno;
- namespace por aluno;
- toolbox pod;
- terminal via WebSocket;
- correcao real no cluster;
- painel do instrutor.
