# AWS Provider data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# Local variables for configuration
locals {
  db_port = 5432
  db_name = "memorable_${var.environment}"
  db_family = "postgres15"
  
  tags = merge(var.tags, {
    Module      = "database"
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# Database subnet group
resource "aws_db_subnet_group" "database" {
  name        = "${var.environment}-db-subnet-group"
  description = "Database subnet group for ${var.environment} environment"
  subnet_ids  = var.private_subnet_ids

  tags = local.tags
}

# Security group for database access
resource "aws_security_group" "database" {
  name        = "${var.environment}-database-sg"
  description = "Security group for RDS PostgreSQL instances"
  vpc_id      = var.vpc_id

  # Ingress rule for PostgreSQL access from application tier
  ingress {
    from_port       = local.db_port
    to_port         = local.db_port
    protocol        = "tcp"
    security_groups = var.app_security_group_ids
    description     = "PostgreSQL access from application tier"
  }

  # Allow internal communication between primary and replicas
  ingress {
    from_port = local.db_port
    to_port   = local.db_port
    protocol  = "tcp"
    self      = true
    description = "Internal replication traffic"
  }

  tags = local.tags
}

# KMS key for database encryption
resource "aws_kms_key" "database" {
  description             = "KMS key for RDS database encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = local.tags
}

# Parameter group for PostgreSQL optimization
resource "aws_db_parameter_group" "postgresql" {
  name        = "${var.environment}-postgresql-params"
  family      = local.db_family
  description = "Custom parameter group for PostgreSQL RDS"

  parameter {
    name  = "max_connections"
    value = "1000"
  }

  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/32768}"
  }

  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory/16384}"
  }

  parameter {
    name  = "work_mem"
    value = "32768"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "2097152"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = local.tags
}

# Primary RDS instance
resource "aws_db_instance" "primary_db" {
  identifier = "${var.environment}-postgresql-primary"
  
  # Instance specifications
  instance_class         = var.instance_class
  allocated_storage      = var.allocated_storage
  max_allocated_storage  = var.max_allocated_storage
  storage_type          = "gp3"
  
  # Database engine configuration
  engine                = "postgres"
  engine_version        = "15.3"
  username              = var.master_username
  password              = var.master_password
  db_name               = local.db_name
  
  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.database.name
  vpc_security_group_ids = [aws_security_group.database.id]
  port                   = local.db_port
  
  # High availability configuration
  multi_az               = true
  availability_zone      = var.primary_az
  
  # Backup and maintenance configuration
  backup_retention_period = var.backup_retention_days
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  # Performance and monitoring
  monitoring_interval    = 60
  monitoring_role_arn   = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  
  # Security configuration
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.database.arn
  parameter_group_name = aws_db_parameter_group.postgresql.name
  
  # Additional configuration
  auto_minor_version_upgrade = true
  deletion_protection       = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "${var.environment}-postgresql-final-snapshot"
  
  tags = local.tags
}

# Read replica instances
resource "aws_db_instance" "read_replica" {
  count = var.read_replica_count

  identifier = "${var.environment}-postgresql-replica-${count.index + 1}"
  
  # Replica configuration
  instance_class         = var.replica_instance_class
  replicate_source_db    = aws_db_instance.primary_db.id
  
  # Network configuration
  availability_zone      = var.replica_azs[count.index]
  vpc_security_group_ids = [aws_security_group.database.id]
  
  # Performance and monitoring
  monitoring_interval    = 60
  monitoring_role_arn   = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  
  # Security configuration
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.database.arn
  parameter_group_name = aws_db_parameter_group.postgresql.name
  
  # Additional configuration
  auto_minor_version_upgrade = true
  
  tags = merge(local.tags, {
    Role = "read-replica"
  })
}

# IAM role for enhanced monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.environment}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

# Attach enhanced monitoring policy to the IAM role
resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}