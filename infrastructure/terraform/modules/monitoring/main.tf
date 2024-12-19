# Provider Configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.0"
    }
  }
}

# Local Variables
locals {
  name_prefix = "memorable-${var.environment}"
  common_tags = {
    Environment = var.environment
    Project     = "memorable"
    ManagedBy   = "terraform"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "app_logs" {
  for_each = var.log_groups

  name              = "/${local.name_prefix}/${each.key}"
  retention_in_days = each.value.retention_days
  kms_key_id       = each.value.kms_encrypted ? aws_kms_key.log_encryption[0].arn : null

  tags = merge(local.common_tags, {
    Component = each.key
  })
}

# KMS Key for Log Encryption
resource "aws_kms_key" "log_encryption" {
  count = length([for lg in var.log_groups : lg if lg.kms_encrypted]) > 0 ? 1 : 0

  description             = "KMS key for CloudWatch Logs encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.common_tags
}

# CloudWatch Metric Filters
resource "aws_cloudwatch_log_metric_filter" "filters" {
  for_each = var.metric_filters

  name           = "${local.name_prefix}-${each.key}"
  pattern        = each.value.pattern
  log_group_name = aws_cloudwatch_log_group.app_logs["application"].name

  metric_transformation {
    name      = each.value.metric_name
    namespace = each.value.namespace
    value     = "1"
    unit      = each.value.unit
  }
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"

  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "alert_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alarm_notification_email
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "system_metrics" {
  for_each = {
    cpu_utilization = {
      metric_name = "CPUUtilization"
      threshold   = var.monitoring_thresholds.cpu_utilization_threshold
      namespace   = "AWS/ECS"
    }
    memory_utilization = {
      metric_name = "MemoryUtilization"
      threshold   = var.monitoring_thresholds.memory_utilization_threshold
      namespace   = "AWS/ECS"
    }
    api_latency = {
      metric_name = "Duration"
      threshold   = var.monitoring_thresholds.api_latency_threshold
      namespace   = "AWS/ApiGateway"
    }
    error_rate = {
      metric_name = "ErrorCount"
      threshold   = var.monitoring_thresholds.error_rate_threshold
      namespace   = "Memorable/Application"
    }
    ai_generation_time = {
      metric_name = "AIGenerationTime"
      threshold   = var.monitoring_thresholds.ai_generation_time_threshold
      namespace   = "Memorable/AI"
    }
    page_load_time = {
      metric_name = "PageLoadTime"
      threshold   = var.monitoring_thresholds.page_load_time_threshold
      namespace   = "Memorable/Frontend"
    }
  }

  alarm_name          = "${local.name_prefix}-${each.key}-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name        = each.value.metric_name
  namespace          = each.value.namespace
  period             = 300
  statistic          = "Average"
  threshold          = each.value.threshold
  alarm_description  = "Alert when ${each.key} exceeds threshold"
  alarm_actions      = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# DataDog Integration
resource "datadog_monitor" "service_monitors" {
  for_each = {
    api_availability = {
      name    = "API Availability"
      type    = "service check"
      query   = "\"aws.apigateway.availability\".over(\"environment:${var.environment}\").by(\"apiname\").last(5).count_by_status()"
      message = "API Gateway availability has dropped below threshold"
    }
    ecs_memory = {
      name    = "ECS Memory Usage"
      type    = "metric alert"
      query   = "avg(last_5m):avg:aws.ecs.memory_utilization{environment:${var.environment}} by {servicename} > ${var.monitoring_thresholds.memory_utilization_threshold}"
      message = "ECS service memory utilization is high"
    }
    ai_performance = {
      name    = "AI Generation Performance"
      type    = "metric alert"
      query   = "avg(last_5m):avg:memorable.ai.generation.duration{environment:${var.environment}} > ${var.monitoring_thresholds.ai_generation_time_threshold}"
      message = "AI content generation time is above threshold"
    }
  }

  name    = "${local.name_prefix}-${each.key}"
  type    = each.value.type
  query   = each.value.query
  message = each.value.message

  monitor_thresholds {
    critical = var.monitoring_thresholds.error_rate_threshold
    warning  = var.monitoring_thresholds.error_rate_threshold * 0.8
  }

  notify_no_data    = true
  renotify_interval = 60

  tags = [var.environment, "service:memorable", "managed-by:terraform"]
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = var.dashboard_config.widgets_per_row
        height = 6
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", "*"],
            [".", "MemoryUtilization", ".", "*"]
          ]
          period = var.dashboard_config.default_period
          region = var.region
          title  = "ECS Service Metrics"
        }
      },
      {
        type   = "metric"
        x      = var.dashboard_config.widgets_per_row
        y      = 0
        width  = var.dashboard_config.widgets_per_row
        height = 6
        properties = {
          metrics = [
            ["Memorable/AI", "AIGenerationTime"],
            ["Memorable/Frontend", "PageLoadTime"]
          ]
          period = var.dashboard_config.default_period
          region = var.region
          title  = "Performance Metrics"
        }
      }
    ]
  })
}

# Outputs
output "cloudwatch_log_groups" {
  value = {
    for k, v in aws_cloudwatch_log_group.app_logs : k => {
      name = v.name
      arn  = v.arn
    }
  }
  description = "Created CloudWatch log groups"
}

output "alarm_topic" {
  value = {
    arn    = aws_sns_topic.alerts.arn
    name   = aws_sns_topic.alerts.name
  }
  description = "SNS topic for monitoring alerts"
}

output "datadog_monitors" {
  value = {
    for k, v in datadog_monitor.service_monitors : k => {
      id   = v.id
      name = v.name
    }
  }
  description = "Created DataDog monitors"
}