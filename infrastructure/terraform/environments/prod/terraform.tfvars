# Environment and Region Configuration
environment = "prod"
aws_region  = "us-west-2"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = [
  "us-west-2a",
  "us-west-2b",
  "us-west-2c"
]

# Instance Type Configuration
instance_types = {
  web_instance_type     = "t3.large"     # For web servers
  api_instance_type     = "c5.xlarge"    # For API servers
  service_instance_type = "c5.2xlarge"   # For service containers
}

# RDS Database Configuration
database_config = {
  instance_class              = "db.r5.2xlarge"
  allocated_storage          = 100
  engine_version            = "15.0"
  multi_az                  = true
  backup_retention_period   = 30
  performance_insights_enabled = true
  monitoring_interval       = 60
  deletion_protection      = true
}

# ElastiCache Configuration
elasticache_config = {
  node_type                  = "cache.r5.xlarge"
  num_cache_nodes           = 3
  engine_version            = "7.0"
  automatic_failover_enabled = true
  snapshot_retention_limit  = 7
  maintenance_window        = "sun:05:00-sun:09:00"
  notification_topic_arn    = "arn:aws:sns:us-west-2:*:cache-alerts"
}

# ECS Task Configuration
ecs_task_config = {
  web = {
    cpu_units                        = 2048
    memory_units                    = 4096
    desired_count                   = 4
    health_check_grace_period       = 300
    deployment_maximum_percent      = 200
    deployment_minimum_healthy_percent = 100
  }
  api = {
    cpu_units                        = 4096
    memory_units                    = 8192
    desired_count                   = 6
    health_check_grace_period       = 180
    deployment_maximum_percent      = 200
    deployment_minimum_healthy_percent = 100
  }
  service = {
    cpu_units                        = 8192
    memory_units                    = 16384
    desired_count                   = 4
    health_check_grace_period       = 300
    deployment_maximum_percent      = 200
    deployment_minimum_healthy_percent = 100
  }
}

# Auto Scaling Configuration
autoscaling_config = {
  min_capacity              = 2
  max_capacity             = 10
  cpu_threshold            = 70
  memory_threshold         = 85
  scale_in_cooldown        = 300
  scale_out_cooldown       = 180
  target_tracking_policies = {
    request_count_per_target    = 1000
    alb_request_count_threshold = 10000
  }
}

# Monitoring Configuration
monitoring_config = {
  detailed_monitoring_enabled   = true
  log_retention_days          = 90
  alarm_notification_arn      = "arn:aws:sns:us-west-2:*:monitoring-alerts"
  metrics_collection_interval = 60
  enhanced_monitoring_enabled = true
}

# Backup Configuration
backup_config = {
  enabled           = true
  schedule         = "cron(0 5 ? * * *)"
  retention_period = 30
  copy_tags        = true
  lifecycle_rules  = {
    transition_to_ia_days      = 30
    transition_to_glacier_days = 90
  }
}

# Domain Configuration
domain_name = "memorable.com"

# Resource Tags
tags = {
  environment = "prod"
  project     = "memorable"
  owner       = "platform-team"
  managed-by  = "terraform"
  cost-center = "platform-prod"
}