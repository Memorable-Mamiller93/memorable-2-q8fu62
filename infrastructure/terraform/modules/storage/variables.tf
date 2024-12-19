# Core environment variable with validation for allowed environments
variable "environment" {
  description = "Deployment environment identifier (dev/staging/prod)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Primary AWS region with validation for supported regions
variable "region" {
  description = "AWS region for primary S3 bucket deployment"
  type        = string
  
  validation {
    condition     = can(regex("^(us|eu|ap|sa|ca|me|af)-[a-z]+-[0-9]+$", var.region))
    error_message = "Must be a valid AWS region identifier."
  }
}

# S3 bucket naming prefix with validation
variable "bucket_name_prefix" {
  description = "Prefix for S3 bucket names - will be combined with environment"
  type        = string
  
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.bucket_name_prefix))
    error_message = "Bucket prefix must be between 3 and 63 characters, contain only lowercase letters, numbers, and hyphens, and start/end with a letter or number."
  }
}

# Versioning configuration with production enforcement
variable "bucket_versioning_enabled" {
  description = "Enable versioning for S3 buckets (required for production)"
  type        = bool
  default     = true
  
  validation {
    condition     = var.environment != "prod" || var.bucket_versioning_enabled
    error_message = "Versioning must be enabled for production environment."
  }
}

# CDN enablement toggle
variable "enable_cdn" {
  description = "Enable CloudFront CDN distribution for content delivery"
  type        = bool
  default     = true
}

# CloudFront price class with validation
variable "cdn_price_class" {
  description = "CloudFront distribution price class (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_100"
  
  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.cdn_price_class)
    error_message = "Price class must be one of: PriceClass_All, PriceClass_200, PriceClass_100."
  }
}

# Encryption configuration
variable "encryption_enabled" {
  description = "Enable AES-256 server-side encryption for S3 buckets"
  type        = bool
  default     = true
  
  validation {
    condition     = var.environment != "prod" || var.encryption_enabled
    error_message = "Encryption must be enabled for production environment."
  }
}

# Cross-region replication configuration
variable "replication_enabled" {
  description = "Enable cross-region replication for disaster recovery"
  type        = bool
  default     = false
}

# Secondary region for replication
variable "replication_region" {
  description = "Secondary AWS region for S3 bucket replication when enabled"
  type        = string
  default     = null
  
  validation {
    condition     = var.replication_region == null || can(regex("^(us|eu|ap|sa|ca|me|af)-[a-z]+-[0-9]+$", var.replication_region))
    error_message = "When specified, must be a valid AWS region identifier."
  }
}

# Lifecycle rules configuration
variable "lifecycle_rules" {
  description = "List of lifecycle rules for S3 bucket objects"
  type = list(object({
    id                     = string
    enabled               = bool
    prefix                = string
    transition_days       = optional(number)
    expiration_days       = optional(number)
    storage_class         = optional(string)
    noncurrent_versions   = optional(number)
  }))
  default = []
  
  validation {
    condition     = alltrue([
      for rule in var.lifecycle_rules :
      rule.storage_class == null || contains(["STANDARD_IA", "ONEZONE_IA", "GLACIER", "DEEP_ARCHIVE"], rule.storage_class)
    ])
    error_message = "Storage class must be one of: STANDARD_IA, ONEZONE_IA, GLACIER, DEEP_ARCHIVE."
  }
}

# CORS configuration
variable "cors_enabled" {
  description = "Enable CORS configuration for S3 buckets"
  type        = bool
  default     = false
}

# Resource tagging
variable "tags" {
  description = "Map of tags to apply to all resources"
  type        = map(string)
  default     = {}
  
  validation {
    condition     = length(var.tags) <= 50
    error_message = "Maximum of 50 tags can be specified."
  }
}