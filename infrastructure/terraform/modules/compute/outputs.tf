# ECS Cluster Outputs
output "ecs_cluster_id" {
  description = "ID of the ECS cluster for service deployments"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster for service and task configurations"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_config" {
  description = "Detailed ECS cluster configuration including capacity providers and settings"
  value = {
    id                = aws_ecs_cluster.main.id
    name              = aws_ecs_cluster.main.name
    capacity_provider = aws_ecs_capacity_provider.main.name
    container_insights = "enabled"
    tags              = aws_ecs_cluster.main.tags
  }
}

# Auto Scaling Group Outputs
output "ecs_asg_config" {
  description = "Auto Scaling Group configuration for ECS cluster"
  value = {
    id               = aws_autoscaling_group.ecs.id
    name             = aws_autoscaling_group.ecs.name
    min_size         = aws_autoscaling_group.ecs.min_size
    max_size         = aws_autoscaling_group.ecs.max_size
    desired_capacity = aws_autoscaling_group.ecs.desired_capacity
    subnets          = aws_autoscaling_group.ecs.vpc_zone_identifier
  }
}

# Launch Template Outputs
output "ecs_launch_template" {
  description = "Launch template configuration for ECS instances"
  value = {
    id           = aws_launch_template.ecs.id
    name_prefix  = aws_launch_template.ecs.name_prefix
    latest_version = aws_launch_template.ecs.latest_version
  }
}

# IAM Role Outputs
output "ecs_instance_role" {
  description = "IAM role ARN for ECS instances"
  value = {
    role_arn = aws_iam_role.ecs_instance.arn
    role_name = aws_iam_role.ecs_instance.name
  }
}

# Load Balancer Target Group Outputs
output "ecs_target_group" {
  description = "Load balancer target group for ECS services"
  value = {
    arn  = aws_lb_target_group.ecs.arn
    name = aws_lb_target_group.ecs.name
    port = aws_lb_target_group.ecs.port
  }
}

# Auto Scaling Policy Outputs
output "ecs_scaling_policies" {
  description = "Auto scaling policies for ECS cluster"
  value = {
    scale_up = {
      name = aws_autoscaling_policy.ecs_scale_up.name
      arn  = aws_autoscaling_policy.ecs_scale_up.arn
    }
    scale_down = {
      name = aws_autoscaling_policy.ecs_scale_down.name
      arn  = aws_autoscaling_policy.ecs_scale_down.arn
    }
  }
}

# CloudWatch Alarm Outputs
output "ecs_alarms" {
  description = "CloudWatch alarms for ECS cluster scaling"
  value = {
    cpu_high = {
      name      = aws_cloudwatch_metric_alarm.ecs_cpu_high.alarm_name
      threshold = aws_cloudwatch_metric_alarm.ecs_cpu_high.threshold
    }
    cpu_low = {
      name      = aws_cloudwatch_metric_alarm.ecs_cpu_low.alarm_name
      threshold = aws_cloudwatch_metric_alarm.ecs_cpu_low.threshold
    }
  }
}

# Container Resource Configurations
output "container_definitions" {
  description = "Container resource allocations for different service tiers"
  value = {
    frontend = {
      cpu    = local.container_definitions.frontend.cpu
      memory = local.container_definitions.frontend.memory
      image  = local.container_definitions.frontend.image
    }
    api = {
      cpu    = local.container_definitions.api.cpu
      memory = local.container_definitions.api.memory
      image  = local.container_definitions.api.image
    }
    services = {
      cpu    = local.container_definitions.services.cpu
      memory = local.container_definitions.services.memory
      image  = local.container_definitions.services.image
    }
  }
}

# CloudWatch Log Group Output
output "ecs_log_group" {
  description = "CloudWatch log group for ECS cluster logs"
  value = {
    name              = aws_cloudwatch_log_group.ecs_cluster.name
    arn               = aws_cloudwatch_log_group.ecs_cluster.arn
    retention_in_days = aws_cloudwatch_log_group.ecs_cluster.retention_in_days
  }
}

# Resource Tags Output
output "resource_tags" {
  description = "Tags applied to ECS cluster resources"
  value       = local.common_tags
}