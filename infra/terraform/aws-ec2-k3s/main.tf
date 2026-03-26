provider "aws" {
  region = var.aws_region
}

locals {
  common_tags = merge(
    {
      Project     = "kubeclass-web-lab"
      Environment = "pilot"
      ManagedBy   = "terraform"
    },
    var.tags
  )

  create_route53_bootstrap = var.domain_name != "" && var.route53_zone_id != ""
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ssm_parameter" "ubuntu_ami" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

resource "aws_vpc" "pilot" {
  cidr_block           = "10.40.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-vpc"
  })
}

resource "aws_internet_gateway" "pilot" {
  vpc_id = aws_vpc.pilot.id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-igw"
  })
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.pilot.id
  cidr_block              = "10.40.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = data.aws_availability_zones.available.names[0]

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-public-a"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.pilot.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.pilot.id
  }

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-public-rt"
  })
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "pilot" {
  name        = "${var.name_prefix}-pilot-sg"
  description = "Security group do piloto EC2 + k3s"
  vpc_id      = aws_vpc.pilot.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = length(var.allowed_ssh_cidrs) > 0 ? [1] : []

    content {
      description = "SSH administrativo"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.allowed_ssh_cidrs
    }
  }

  dynamic "ingress" {
    for_each = length(var.allowed_k8s_api_cidrs) > 0 ? [1] : []

    content {
      description = "API do Kubernetes"
      from_port   = 6443
      to_port     = 6443
      protocol    = "tcp"
      cidr_blocks = var.allowed_k8s_api_cidrs
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-pilot-sg"
  })
}

resource "aws_iam_role" "pilot" {
  name = "${var.name_prefix}-pilot-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.pilot.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "route53" {
  count = local.create_route53_bootstrap ? 1 : 0
  name  = "${var.name_prefix}-route53-bootstrap"
  role  = aws_iam_role.pilot.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "route53:ChangeResourceRecordSets"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:route53:::hostedzone/${var.route53_zone_id}"
      },
      {
        Action = [
          "route53:ListHostedZonesByName",
          "route53:ListResourceRecordSets"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "pilot" {
  name = "${var.name_prefix}-pilot-profile"
  role = aws_iam_role.pilot.name
}

resource "aws_instance" "pilot" {
  ami                         = data.aws_ssm_parameter.ubuntu_ami.value
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  key_name                    = var.ssh_key_name
  vpc_security_group_ids      = [aws_security_group.pilot.id]
  iam_instance_profile        = aws_iam_instance_profile.pilot.name
  associate_public_ip_address = true

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_size_gb
    encrypted   = true
  }

  user_data = templatefile("${path.module}/templates/cloud-init.sh.tftpl", {
    domain_name         = var.domain_name
    route53_zone_id     = var.route53_zone_id
    route53_record_name = var.route53_record_name
    create_route53      = local.create_route53_bootstrap
    name_prefix         = var.name_prefix
  })

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-pilot"
  })
}
