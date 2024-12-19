# Environment Configuration
variable "environment" {
  description = "Deployment environment identifier (dev/staging/prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Region Configuration
variable "region" {
  description = "AWS region for monitoring resources deployment"
  type        = string
  validation {
    condition     = can(regex("^(us|eu|ap|sa|ca|me|af)-(north|south|east|west|central)-[1-9]$", var.region))
    error_message = "AWS region must be a valid region identifier."
  }
  default = "us-east-1"
}

# CloudWatch Log Configuration
variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  validation {
    condition     = var.log_retention_days >= 30 && var.log_retention_days <= 365
    error_message = "Log retention must be between 30 and 365 days."
  }
  default = 90
}

# DataDog Integration
variable "datadog_api_key" {
  description = "DataDog API key for integration"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.datadog_api_key) > 30
    error_message = "DataDog API key must be valid."
  }
}

variable "datadog_app_key" {
  description = "DataDog application key for enhanced integration features"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.datadog_app_key) > 30
    error_message = "DataDog application key must be valid."
  }
}

# Alerting Configuration
variable "alarm_notification_email" {
  description = "Email address for monitoring alerts"
  type        = string
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.alarm_notification_email))
    error_message = "Must provide a valid email address for alarm notifications."
  }
}

# Performance Monitoring Thresholds
variable "monitoring_thresholds" {
  description = "Threshold values for various monitoring metrics"
  type = object({
    cpu_utilization_threshold    = number
    memory_utilization_threshold = number
    api_latency_threshold       = number
    error_rate_threshold        = number
    ai_generation_time_threshold = number
    page_load_time_threshold    = number
  })
  
  validation {
    condition = (
      var.monitoring_thresholds.cpu_utilization_threshold <= 80 &&
      var.monitoring_thresholds.memory_utilization_threshold <= 85 &&
      var.monitoring_thresholds.api_latency_threshold <= 1000 &&
      var.monitoring_thresholds.error_rate_threshold <= 1 &&
      var.monitoring_thresholds.ai_generation_time_threshold <= 30000 &&
      var.monitoring_thresholds.page_load_time_threshold <= 3000
    )
    error_message = "Monitoring thresholds must meet performance requirements specified in technical documentation."
  }

  default = {
    cpu_utilization_threshold    = 70
    memory_utilization_threshold = 75
    api_latency_threshold       = 500
    error_rate_threshold        = 0.5
    ai_generation_time_threshold = 25000  # 25 seconds
    page_load_time_threshold    = 2000    # 2 seconds
  }
}

# Log Groups Configuration
variable "log_groups" {
  description = "Configuration for CloudWatch log groups"
  type = map(object({
    retention_days = number
    kms_encrypted  = bool
  }))
  
  default = {
    application = {
      retention_days = 90
      kms_encrypted  = true
    }
    api = {
      retention_days = 90
      kms_encrypted  = true
    }
    ai_service = {
      retention_days = 90
      kms_encrypted  = true
    }
    security = {
      retention_days = 365
      kms_encrypted  = true
    }
  }
}

# Dashboard Configuration
variable "dashboard_config" {
  description = "Configuration for CloudWatch dashboards"
  type = object({
    refresh_interval = number
    widgets_per_row  = number
    default_period   = number
  })
  
  default = {
    refresh_interval = 60
    widgets_per_row  = 3
    default_period   = 300
  }
}

# Metric Filters
variable "metric_filters" {
  description = "Log metric filters for monitoring specific patterns"
  type = map(object({
    pattern     = string
    metric_name = string
    namespace   = string
    unit        = string
  }))
  
  default = {
    error_logs = {
      pattern     = "[timestamp, level=ERROR, ...]"
      metric_name = "ErrorCount"
      namespace   = "Memorable/Application"
      unit        = "Count"
    }
    ai_generation_time = {
      pattern     = "[timestamp, service=AI, duration]"
      metric_name = "AIGenerationTime"
      namespace   = "Memorable/AI"
      unit        = "Milliseconds"
    }
  }
}