# Environment Configuration
environment = "staging"
aws_region = "us-east-1"

# Network Configuration
vpc_cidr = "10.1.0.0/16"  # Staging VPC CIDR, different from production
availability_zones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c"
]

# Compute Instance Types
instance_types = {
  web_instance_type     = "t3.large"      # For React frontend servers
  api_instance_type     = "c5.xlarge"     # For API Gateway and services
  service_instance_type = "c5.2xlarge"    # For compute-intensive services
}

# Database Configuration
database_config = {
  instance_class           = "db.r5.2xlarge"
  allocated_storage       = 100
  engine_version         = "15.0"
  backup_retention_period = 7
  multi_az               = true
  maintenance_window     = "Mon:03:00-Mon:04:00"
  deletion_protection    = true
}

# ElastiCache Configuration
elasticache_config = {
  node_type                = "cache.r5.xlarge"
  num_cache_nodes         = 2
  engine_version          = "7.0"
  automatic_failover      = true
  snapshot_retention_limit = 7
}

# ECS Task Configuration
ecs_task_config = {
  cpu_units = {
    web     = 1024    # 1 vCPU for frontend
    api     = 2048    # 2 vCPU for API services
    service = 4096    # 4 vCPU for backend services
  }
  memory_units = {
    web     = 2048    # 2GB RAM for frontend
    api     = 4096    # 4GB RAM for API services
    service = 8192    # 8GB RAM for backend services
  }
  desired_count = {
    web     = 2
    api     = 2
    service = 2
  }
  health_check_grace_period = 120
}

# Auto Scaling Configuration
autoscaling_config = {
  min_capacity       = 2
  max_capacity       = 4
  cpu_threshold      = 70
  memory_threshold   = 85
  scale_in_cooldown  = 300
  scale_out_cooldown = 180
}

# Monitoring Configuration
monitoring_config = {
  log_retention_days          = 30
  alarm_evaluation_periods    = 2
  alarm_period_seconds       = 60
  detailed_monitoring_enabled = true
  alarm_email                = "staging-alerts@memorable.com"
}

# Domain Configuration
domain_name = "staging.memorable.com"

# Resource Tags
tags = {
  Environment = "staging"
  Project     = "memorable"
  ManagedBy   = "terraform"
  CostCenter  = "staging-infrastructure"
  Owner       = "platform-team"
}

# Load Balancer Configuration
load_balancer_config = {
  idle_timeout       = 60
  deletion_protection = true
  enable_http2       = true
  enable_waf         = true
}

# S3 Configuration
s3_config = {
  versioning_enabled     = true
  lifecycle_enabled      = true
  transition_days        = 30
  expiration_days        = 90
  replication_enabled    = false
}

# CloudFront Configuration
cloudfront_config = {
  price_class          = "PriceClass_100"  # US, Canada, Europe
  minimum_protocol_version = "TLSv1.2_2021"
  enable_waf           = true
  enable_compression   = true
}