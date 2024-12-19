# Environment and Region Configuration
environment = "dev"
aws_region  = "us-east-1"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c"
]

# Compute Instance Types - Development Sized
instance_types = {
  web_instance_type     = "t3.small"  # Reduced size for dev workloads
  api_instance_type     = "t3.medium" # Reduced size for dev workloads
  service_instance_type = "t3.large"  # Reduced size for dev workloads
}

# Database Configuration - Development Sized
database_config = {
  instance_class           = "db.t3.medium"    # Smaller instance for dev
  allocated_storage       = 20                 # Reduced storage for dev
  engine_version         = "15.3"             # Latest stable PostgreSQL
  backup_retention_period = 3                  # Reduced retention for dev
  multi_az               = false              # Single AZ for dev cost savings
  maintenance_window     = "Mon:03:00-Mon:04:00"
}

# ElastiCache Configuration - Development Sized
elasticache_config = {
  node_type                = "cache.t3.medium" # Smaller instance for dev
  num_cache_nodes         = 1                 # Single node for dev
  engine_version          = "7.0"             # Latest stable Redis
  automatic_failover      = false             # Disabled for dev
  snapshot_retention_limit = 1                 # Minimal retention for dev
}

# ECS Task Configuration - Development Sized
ecs_task_config = {
  cpu_units = {
    web     = 512    # Reduced CPU for dev
    api     = 1024   # Reduced CPU for dev
    service = 2048   # Reduced CPU for dev
  }
  memory_units = {
    web     = 1024   # Reduced memory for dev
    api     = 2048   # Reduced memory for dev
    service = 4096   # Reduced memory for dev
  }
  desired_count = {
    web     = 1      # Single instance for dev
    api     = 1      # Single instance for dev
    service = 1      # Single instance for dev
  }
  health_check_grace_period = 60  # Shorter grace period for dev
}

# Auto Scaling Configuration - Development Settings
autoscaling_config = {
  min_capacity       = 1     # Minimum single instance
  max_capacity       = 2     # Limited scaling for dev
  cpu_threshold      = 80    # Higher threshold for dev
  memory_threshold   = 85    # Higher threshold for dev
  scale_in_cooldown  = 180   # Shorter cooldown for dev
  scale_out_cooldown = 120   # Shorter cooldown for dev
}

# Monitoring Configuration - Development Settings
monitoring_config = {
  retention_in_days = 30     # Shorter retention for dev
  alarm_email      = "dev-alerts@memorable.com"
}

# Resource Tags
tags = {
  environment = "dev"
  project     = "memorable"
  owner       = "dev-team"
  managed-by  = "terraform"
  cost-center = "development"
}

# Domain Configuration
domain_name = "dev.memorable.com"