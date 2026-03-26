output "instance_id" {
  description = "ID da instancia do piloto."
  value       = aws_instance.pilot.id
}

output "public_ip" {
  description = "IP publico atual da instancia."
  value       = aws_instance.pilot.public_ip
}

output "public_dns" {
  description = "DNS publico atual da instancia."
  value       = aws_instance.pilot.public_dns
}

output "ssh_command" {
  description = "Comando sugerido para acesso SSH."
  value       = "ssh ubuntu@${aws_instance.pilot.public_ip}"
}

output "app_url" {
  description = "URL sugerida da plataforma."
  value       = local.create_route53_bootstrap ? "https://${var.route53_record_name}.${var.domain_name}" : "http://${aws_instance.pilot.public_ip}"
}
