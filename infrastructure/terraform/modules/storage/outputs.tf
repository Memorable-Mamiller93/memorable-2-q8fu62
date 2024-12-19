# S3 bucket identifiers
output "bucket_name" {
  description = "Name of the created S3 bucket for content storage"
  value       = aws_s3_bucket.main.bucket
}

output "bucket_arn" {
  description = "ARN of the created S3 bucket for IAM policy attachments"
  value       = aws_s3_bucket.main.arn
}

output "bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket for direct access"
  value       = aws_s3_bucket.main.bucket_regional_domain_name
}

# CloudFront distribution attributes
output "cdn_domain_name" {
  description = "Domain name of the CloudFront distribution for content delivery"
  value       = var.enable_cdn ? aws_cloudfront_distribution.main[0].domain_name : null
}

output "cdn_distribution_id" {
  description = "ID of the CloudFront distribution for cache invalidation"
  value       = var.enable_cdn ? aws_cloudfront_distribution.main[0].id : null
}

# Security and compliance attributes
output "bucket_versioning_enabled" {
  description = "Indicates whether versioning is enabled on the S3 bucket"
  value       = var.bucket_versioning_enabled
  sensitive   = false
}

output "encryption_status" {
  description = "Indicates whether server-side encryption is enabled on the S3 bucket"
  value       = var.encryption_enabled
  sensitive   = false
}

# Replication configuration
output "replication_status" {
  description = "Indicates whether cross-region replication is enabled"
  value       = var.replication_enabled && var.replication_region != null
  sensitive   = false
}

output "replica_bucket_arn" {
  description = "ARN of the replica S3 bucket when replication is enabled"
  value       = var.replication_enabled && var.replication_region != null ? aws_s3_bucket.replica[0].arn : null
}

# Access configuration
output "bucket_public_access_blocked" {
  description = "Indicates whether public access is blocked on the S3 bucket"
  value       = true # Always true as enforced by aws_s3_bucket_public_access_block
  sensitive   = false
}

# Lifecycle configuration
output "lifecycle_rules_enabled" {
  description = "Number of lifecycle rules configured for the S3 bucket"
  value       = length(var.lifecycle_rules)
  sensitive   = false
}

# Cost optimization features
output "intelligent_tiering_enabled" {
  description = "Indicates whether intelligent tiering is enabled for cost optimization"
  value       = var.intelligent_tiering_enabled
  sensitive   = false
}

# Tags
output "resource_tags" {
  description = "Map of tags applied to the storage resources"
  value       = merge(var.tags, {
    Environment = var.environment
    Name        = "memorable-storage-${var.environment}"
  })
  sensitive = false
}