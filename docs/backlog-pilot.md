# Backlog do Piloto

## Sprint 1

- provisionar EC2 com Terraform;
- instalar k3s automaticamente via `user_data`;
- subir a plataforma Go em container;
- publicar por `Ingress` com TLS;
- validar subida e desligamento da VM.

## Sprint 2

- persistir progresso no servidor;
- definir modelo de turma e aluno;
- adicionar pagina de login simples;
- salvar rascunhos e resultados fora do navegador.

## Sprint 3

- criar namespace por aluno;
- gerar quotas por namespace;
- criar toolbox pod;
- preparar canal WebSocket para terminal.

## Sprint 4

- validacao real no cluster;
- cleanup automatico por timeout;
- painel do instrutor;
- nota e rubrica do desafio final.

## Criterios de saida do piloto

- 40 alunos acessam a plataforma na aula sem queda;
- o servidor pode ser ligado e desligado sob demanda;
- a publicacao no k3s e repetivel;
- o custo mensal fica no teto definido;
- o repositorio fica pronto para evoluir para multiusuario real.
