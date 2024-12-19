# Provider Configuration for Memorable Platform
# Version: 1.0.0
# Provider versions:
# - hashicorp/aws v5.0.0
# - hashicorp/random v3.5.0
# - hashicorp/null v3.2.0

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

# Primary AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  # Enhanced security defaults
  default_tags {
    tags = {
      Environment     = var.environment
      Project         = "memorable"
      ManagedBy      = "terraform"
      SecurityLevel   = "high"
      ComplianceScope = "pci-dss"
    }
  }

  # Provider-level security configurations
  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/TerraformExecutionRole"
    session_name = "TerraformProvisioningSession"
  }

  # S3 security defaults
  s3_force_path_style = false
  s3_use_path_style  = false

  # Enhanced retry configuration
  retry_mode = "adaptive"
  max_retries = 10

  # Provider-level encryption configuration
  default_encryption {
    kms_master_key_id = data.aws_kms_key.terraform_state.id
  }

  # HTTP client configuration
  http_proxy = null
  https_proxy = null
  no_proxy = null

  # Enhanced logging and debugging
  log_level = "INFO"
  log_include_sensitive = false

  # Provider endpoints configuration
  endpoints {
    s3 = "s3.${var.aws_region}.amazonaws.com"
    dynamodb = "dynamodb.${var.aws_region}.amazonaws.com"
  }
}

# Secondary AWS Provider for Disaster Recovery
provider "aws" {
  alias  = "secondary"
  region = "us-west-2" # Secondary region for disaster recovery

  # Inherit primary provider security configurations
  default_tags {
    tags = {
      Environment     = var.environment
      Project         = "memorable"
      ManagedBy      = "terraform"
      SecurityLevel   = "high"
      ComplianceScope = "pci-dss"
      Region         = "secondary"
    }
  }

  assume_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/TerraformExecutionRole"
    session_name = "TerraformDRSession"
  }

  # Secondary region specific configurations
  retry_mode = "adaptive"
  max_retries = 10

  default_encryption {
    kms_master_key_id = data.aws_kms_key.terraform_state_secondary.id
  }
}

# Random Provider for Secure Resource Naming
provider "random" {
  # Enhanced entropy configuration for production use
  keepers = {
    environment = var.environment
    timestamp   = timestamp()
  }
}

# Null Provider for Resource Provisioning
provider "null" {
  # Default configuration for resource provisioning
}

# Data sources for provider configuration
data "aws_caller_identity" "current" {}

data "aws_kms_key" "terraform_state" {
  key_id = "alias/terraform-state-${var.environment}"
}

data "aws_kms_key" "terraform_state_secondary" {
  provider = aws.secondary
  key_id   = "alias/terraform-state-${var.environment}"
}

# Provider feature flags
locals {
  provider_flags = {
    enable_s3_versioning          = true
    enable_dynamodb_encryption    = true
    enable_cloudwatch_logs        = true
    enable_vpc_endpoint_policies  = true
    enable_backup_encryption      = true
    enable_cross_region_replica   = true
  }
}