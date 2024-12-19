# Primary Database Instance Outputs
output "primary_db_endpoint" {
  description = "Primary RDS instance endpoint for application connectivity"
  value       = aws_db_instance.primary_db.endpoint
  sensitive   = true
}

output "primary_db_address" {
  description = "Primary RDS instance address for DNS configuration"
  value       = aws_db_instance.primary_db.address
  sensitive   = true
}

output "primary_db_port" {
  description = "Primary RDS instance port for application configuration"
  value       = aws_db_instance.primary_db.port
}

output "primary_db_arn" {
  description = "Primary RDS instance ARN for IAM and monitoring configuration"
  value       = aws_db_instance.primary_db.arn
}

output "primary_db_availability_zone" {
  description = "Primary RDS instance availability zone for multi-AZ configuration"
  value       = aws_db_instance.primary_db.availability_zone
}

output "primary_db_backup_retention" {
  description = "Backup retention period for the primary RDS instance"
  value       = aws_db_instance.primary_db.backup_retention_period
}

# Read Replica Outputs
output "read_replica_endpoints" {
  description = "List of read replica endpoints for read-scaling configuration"
  value       = aws_db_instance.read_replica[*].endpoint
  sensitive   = true
}

output "read_replica_addresses" {
  description = "List of read replica addresses for DNS configuration"
  value       = aws_db_instance.read_replica[*].address
  sensitive   = true
}

output "read_replica_availability_zones" {
  description = "List of read replica availability zones for cross-AZ distribution"
  value       = aws_db_instance.read_replica[*].availability_zone
}

# Network Configuration Outputs
output "db_subnet_group_id" {
  description = "ID of the database subnet group"
  value       = aws_db_subnet_group.database.id
}

output "db_subnet_group_arn" {
  description = "ARN of the database subnet group"
  value       = aws_db_subnet_group.database.arn
}

output "db_subnet_ids" {
  description = "List of subnet IDs used by the database subnet group"
  value       = aws_db_subnet_group.database.subnet_ids
}

# Security Configuration Outputs
output "db_security_group_id" {
  description = "ID of the database security group"
  value       = aws_security_group.database.id
}

output "db_vpc_id" {
  description = "ID of the VPC containing the database"
  value       = aws_security_group.database.vpc_id
}

# Monitoring Configuration Outputs
output "monitoring_role_arn" {
  description = "ARN of the IAM role used for enhanced RDS monitoring"
  value       = aws_iam_role.rds_monitoring.arn
}

# KMS Configuration Output
output "db_kms_key_arn" {
  description = "ARN of the KMS key used for database encryption"
  value       = aws_kms_key.database.arn
  sensitive   = true
}

# Parameter Group Output
output "db_parameter_group_id" {
  description = "ID of the custom parameter group used by the database instances"
  value       = aws_db_parameter_group.postgresql.id
}