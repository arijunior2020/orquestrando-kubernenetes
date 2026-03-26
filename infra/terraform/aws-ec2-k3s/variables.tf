variable "aws_region" {
  description = "Regiao AWS do piloto."
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefixo de nomes dos recursos."
  type        = string
  default     = "kubeclass"
}

variable "instance_type" {
  description = "Tipo da instancia EC2."
  type        = string
  default     = "m5a.2xlarge"
}

variable "root_volume_size_gb" {
  description = "Tamanho do volume raiz em GB."
  type        = number
  default     = 100
}

variable "ssh_key_name" {
  description = "Nome do par de chaves ja existente na AWS."
  type        = string
}

variable "allowed_ssh_cidrs" {
  description = "CIDRs autorizados para SSH."
  type        = list(string)
  default     = []
}

variable "allowed_k8s_api_cidrs" {
  description = "CIDRs autorizados para API do Kubernetes. Deixe vazio para nao expor."
  type        = list(string)
  default     = []
}

variable "domain_name" {
  description = "Dominio principal da plataforma. Opcional."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Hosted zone do Route53. Opcional."
  type        = string
  default     = ""
}

variable "route53_record_name" {
  description = "Subdominio da plataforma dentro da hosted zone."
  type        = string
  default     = "lab"
}

variable "tags" {
  description = "Tags extras."
  type        = map(string)
  default     = {}
}
