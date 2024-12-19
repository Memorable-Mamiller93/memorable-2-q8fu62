# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Local variables for common resource configurations
locals {
  common_tags = {
    Environment        = var.environment
    Project           = "Memorable"
    ManagedBy         = "Terraform"
    SecurityLevel     = "High"
    CostCenter        = "Platform"
    DataClassification = "Sensitive"
  }

  # Container definitions with resource allocations
  container_definitions = {
    frontend = {
      cpu    = 1024  # 1 vCPU
      memory = 2048  # 2GB RAM
      image  = "frontend:latest"
    }
    api = {
      cpu    = 2048  # 2 vCPU
      memory = 4096  # 4GB RAM
      image  = "api:latest"
    }
    services = {
      cpu    = 4096  # 4 vCPU
      memory = 8192  # 8GB RAM
      image  = "services:latest"
    }
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.environment}-memorable-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      log_configuration {
        cloud_watch_log_group_name = aws_cloudwatch_log_group.ecs_cluster.name
      }
    }
  }

  tags = merge(local.common_tags, {
    Name = "${var.environment}-memorable-cluster"
  })
}

# CloudWatch Log Group for ECS Cluster
resource "aws_cloudwatch_log_group" "ecs_cluster" {
  name              = "/aws/ecs/${var.environment}-memorable-cluster"
  retention_in_days = 30

  tags = local.common_tags
}

# ECS Capacity Providers
resource "aws_ecs_capacity_provider" "main" {
  name = "${var.environment}-capacity-provider"

  auto_scaling_group_provider {
    auto_scaling_group_arn = aws_autoscaling_group.ecs.arn
    
    managed_scaling {
      maximum_scaling_step_size = 100
      minimum_scaling_step_size = 1
      status                    = "ENABLED"
      target_capacity           = 100
    }
  }

  tags = local.common_tags
}

# Auto Scaling Group for ECS
resource "aws_autoscaling_group" "ecs" {
  name                = "${var.environment}-ecs-asg"
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = [aws_lb_target_group.ecs.arn]
  health_check_type   = "ELB"
  min_size           = 1
  max_size           = 10
  desired_capacity   = 2

  launch_template {
    id      = aws_launch_template.ecs.id
    version = "$Latest"
  }

  tag {
    key                 = "AmazonECSManaged"
    value              = true
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = local.common_tags
    content {
      key                 = tag.key
      value              = tag.value
      propagate_at_launch = true
    }
  }
}

# Launch Template for ECS Instances
resource "aws_launch_template" "ecs" {
  name_prefix   = "${var.environment}-ecs-template"
  image_id      = var.instance_types["ecs_ami"]
  instance_type = var.instance_types["ecs_instance"]

  network_interfaces {
    associate_public_ip_address = false
    security_groups            = [var.app_security_group_id]
  }

  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_instance.name
  }

  user_data = base64encode(<<-EOF
              #!/bin/bash
              echo ECS_CLUSTER=${aws_ecs_cluster.main.name} >> /etc/ecs/ecs.config
              echo ECS_ENABLE_CONTAINER_METADATA=true >> /etc/ecs/ecs.config
              echo ECS_ENABLE_SPOT_INSTANCE_DRAINING=true >> /etc/ecs/ecs.config
              EOF
  )

  monitoring {
    enabled = true
  }

  tags = local.common_tags
}

# IAM Role for ECS Instances
resource "aws_iam_role" "ecs_instance" {
  name = "${var.environment}-ecs-instance-role"

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

# IAM Instance Profile for ECS
resource "aws_iam_instance_profile" "ecs_instance" {
  name = "${var.environment}-ecs-instance-profile"
  role = aws_iam_role.ecs_instance.name
}

# IAM Role Policy Attachments
resource "aws_iam_role_policy_attachment" "ecs_instance" {
  for_each = toset([
    "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role",
    "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  ])

  role       = aws_iam_role.ecs_instance.name
  policy_arn = each.value
}

# Application Load Balancer Target Group
resource "aws_lb_target_group" "ecs" {
  name        = "${var.environment}-ecs-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "instance"

  health_check {
    enabled             = true
    healthy_threshold   = 3
    interval            = 30
    matcher            = "200"
    path               = "/health"
    port               = "traffic-port"
    timeout            = 5
    unhealthy_threshold = 3
  }

  tags = local.common_tags
}

# Auto Scaling Policies
resource "aws_autoscaling_policy" "ecs_scale_up" {
  name                   = "${var.environment}-ecs-scale-up"
  scaling_adjustment     = 1
  adjustment_type        = "ChangeInCapacity"
  cooldown              = 300
  autoscaling_group_name = aws_autoscaling_group.ecs.name
}

resource "aws_autoscaling_policy" "ecs_scale_down" {
  name                   = "${var.environment}-ecs-scale-down"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown              = 300
  autoscaling_group_name = aws_autoscaling_group.ecs.name
}

# CloudWatch Alarms for Auto Scaling
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${var.environment}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name        = "CPUUtilization"
  namespace          = "AWS/ECS"
  period             = 300
  statistic          = "Average"
  threshold          = 70

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
  }

  alarm_actions = [aws_autoscaling_policy.ecs_scale_up.arn]
  tags          = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_cpu_low" {
  alarm_name          = "${var.environment}-ecs-cpu-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name        = "CPUUtilization"
  namespace          = "AWS/ECS"
  period             = 300
  statistic          = "Average"
  threshold          = 30

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
  }

  alarm_actions = [aws_autoscaling_policy.ecs_scale_down.arn]
  tags          = local.common_tags
}