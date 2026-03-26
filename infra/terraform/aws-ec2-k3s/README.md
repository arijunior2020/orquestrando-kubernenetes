# Terraform do Piloto AWS

Este modulo sobe a VM do piloto com:

- VPC simples;
- subnet publica;
- security group;
- IAM role para SSM;
- bootstrap automatico do `k3s`;
- opcional de atualizacao de DNS no Route53.

## Antes de rodar

1. Crie um `Key pair` no console da AWS em `EC2 -> Key Pairs`.
2. Descubra seu IP publico atual.
3. Copie `terraform.tfvars.example` para `terraform.tfvars`.
4. Preencha pelo menos:
   - `ssh_key_name`
   - `allowed_ssh_cidrs`

## Primeiro uso

```bash
cd infra/terraform/aws-ec2-k3s
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Verificacoes depois do apply

1. Anote o `public_ip` ou `app_url`.
2. Conecte por SSH:

```bash
ssh ubuntu@SEU_IP
```

3. Verifique o cluster:

```bash
sudo k3s kubectl get nodes
sudo k3s kubectl get pods -A
```

## Primeira configuracao recomendada

- mantenha `domain_name` vazio na primeira subida;
- nao exponha `6443`;
- use `m5a.2xlarge` no primeiro teste;
- troque para `m5a.4xlarge` apenas quando precisar.

## Quando desligar

Se quiser parar custo de compute, pare ou destrua a VM conforme sua estrategia.

Se quiser destruir toda a infra:

```bash
terraform destroy
```
