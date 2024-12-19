# Backend Configuration for Memorable Platform Infrastructure
# Version: ~> 5.0 (AWS Provider)
# Purpose: Defines remote state storage and locking mechanism with encryption and versioning

terraform {
  # S3 Backend Configuration
  backend "s3" {
    # State Storage Configuration
    bucket = "memorable-terraform-state"
    key    = "${var.environment}/terraform.tfstate"
    region = "us-east-1"

    # Security Configuration
    encrypt = true
    acl     = "private"

    # Server-Side Encryption
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm = "AES256"
        }
      }
    }

    # State Locking Configuration
    dynamodb_table = "memorable-terraform-locks"

    # Version Management
    versioning = true

    # Access Control
    # Note: IAM roles and policies should be configured separately
    # with least privilege access principles

    # Additional Security Measures
    force_path_style           = false
    skip_credentials_validation = false
    skip_metadata_api_check     = false
    skip_region_validation      = false

    # Lifecycle Management
    lifecycle {
      prevent_destroy = true
    }

    # Tags for Resource Management
    tags = {
      Environment = var.environment
      Project     = "memorable"
      ManagedBy   = "terraform"
      Purpose     = "state-management"
    }
  }
}

# DynamoDB Table Configuration for State Locking
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "memorable-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  # Enable Point-in-Time Recovery
  point_in_time_recovery {
    enabled = true
  }

  # Enable Server-Side Encryption
  server_side_encryption {
    enabled = true
  }

  # Tags for Resource Management
  tags = {
    Environment = var.environment
    Project     = "memorable"
    ManagedBy   = "terraform"
    Purpose     = "state-locking"
  }

  # Lifecycle Policy
  lifecycle {
    prevent_destroy = true
  }
}

# S3 Bucket Policy for State Storage
resource "aws_s3_bucket_policy" "state_bucket" {
  bucket = "memorable-terraform-state"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnforceHTTPS"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          "arn:aws:s3:::memorable-terraform-state",
          "arn:aws:s3:::memorable-terraform-state/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport": "false"
          }
        }
      },
      {
        Sid    = "EnforceVersioning"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:PutBucketVersioning"
        Resource = "arn:aws:s3:::memorable-terraform-state"
        Condition = {
          StringNotEquals = {
            "s3:VersionStatus": "Enabled"
          }
        }
      }
    ]
  })
}

# S3 Bucket Versioning Configuration
resource "aws_s3_bucket_versioning" "state_versioning" {
  bucket = "memorable-terraform-state"
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Encryption Configuration
resource "aws_s3_bucket_server_side_encryption_configuration" "state_encryption" {
  bucket = "memorable-terraform-state"

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "state_public_access" {
  bucket = "memorable-terraform-state"

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}