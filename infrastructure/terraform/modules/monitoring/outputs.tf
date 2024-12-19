# Output for CloudWatch Log Groups with enhanced validation and metadata
output "cloudwatch_log_groups" {
  description = "CloudWatch log group resources with comprehensive metadata including name, ARN, and retention policy"
  value = {
    app_logs = {
      name           = aws_cloudwatch_log_group.app_logs["application"].name
      arn            = aws_cloudwatch_log_group.app_logs["application"].arn
      retention_days = aws_cloudwatch_log_group.app_logs["application"].retention_in_days
      kms_encrypted  = aws_cloudwatch_log_group.app_logs["application"].kms_key_id != null
    }
    api_logs = {
      name           = aws_cloudwatch_log_group.app_logs["api"].name
      arn            = aws_cloudwatch_log_group.app_logs["api"].arn
      retention_days = aws_cloudwatch_log_group.app_logs["api"].retention_in_days
      kms_encrypted  = aws_cloudwatch_log_group.app_logs["api"].kms_key_id != null
    }
    ai_service_logs = {
      name           = aws_cloudwatch_log_group.app_logs["ai_service"].name
      arn            = aws_cloudwatch_log_group.app_logs["ai_service"].arn
      retention_days = aws_cloudwatch_log_group.app_logs["ai_service"].retention_in_days
      kms_encrypted  = aws_cloudwatch_log_group.app_logs["ai_service"].kms_key_id != null
    }
  }

  depends_on = [aws_cloudwatch_log_group.app_logs]
}

# Output for SNS Alert Topic with enhanced metadata
output "alarm_topic" {
  description = "SNS topic details for monitoring alerts including ARN, name and region information"
  value = {
    arn           = aws_sns_topic.alerts.arn
    name          = aws_sns_topic.alerts.name
    region        = data.aws_region.current.name
    subscription_email = var.alarm_notification_email
    subscription_protocol = "email"
  }

  depends_on = [
    aws_sns_topic.alerts,
    aws_sns_topic_subscription.alert_email
  ]
}

# Output for DataDog Monitors with comprehensive metric configurations
output "datadog_monitors" {
  description = "DataDog monitoring resources with detailed metric configurations and alert thresholds"
  value = {
    system_metrics = {
      for k, v in datadog_monitor.service_monitors : k => {
        id              = v.id
        name            = v.name
        type            = v.type
        query           = v.query
        message        = v.message
        critical_threshold = var.monitoring_thresholds[k]
        warning_threshold  = var.monitoring_thresholds[k] * 0.8
      } if contains(["api_availability", "ecs_memory"], k)
    }
    performance_metrics = {
      for k, v in datadog_monitor.service_monitors : k => {
        id              = v.id
        name            = v.name
        type            = v.type
        query           = v.query
        message        = v.message
        critical_threshold = var.monitoring_thresholds[k]
        warning_threshold  = var.monitoring_thresholds[k] * 0.8
      } if contains(["ai_performance"], k)
    }
    availability_metrics = {
      uptime = {
        threshold = 99.9
        evaluation_period = "1h"
        datapoints_required = 3
      }
      latency = {
        threshold_ms = var.monitoring_thresholds.api_latency_threshold
        percentile = 95
      }
    }
  }

  depends_on = [datadog_monitor.service_monitors]
}

# Output for CloudWatch Dashboard
output "cloudwatch_dashboard" {
  description = "CloudWatch dashboard details for system monitoring and visualization"
  value = {
    dashboard_name = aws_cloudwatch_dashboard.main.dashboard_name
    dashboard_arn  = aws_cloudwatch_dashboard.main.dashboard_arn
    widgets_count  = var.dashboard_config.widgets_per_row * 2 # Two rows of widgets
    refresh_rate   = var.dashboard_config.refresh_interval
  }

  depends_on = [aws_cloudwatch_dashboard.main]
}

# Output for Metric Filters
output "metric_filters" {
  description = "CloudWatch metric filters for log pattern analysis and alerting"
  value = {
    for k, v in aws_cloudwatch_log_metric_filter.filters : k => {
      name           = v.name
      pattern        = v.pattern
      log_group_name = v.log_group_name
      metric_name    = v.metric_transformation[0].name
      namespace      = v.metric_transformation[0].namespace
      unit           = v.metric_transformation[0].unit
    }
  }

  depends_on = [aws_cloudwatch_log_metric_filter.filters]
}

# Data source for current region
data "aws_region" "current" {}