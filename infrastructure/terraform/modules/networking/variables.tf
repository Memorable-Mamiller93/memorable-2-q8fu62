# Terraform variables definition file for the networking module
# Version: 1.0
# Purpose: Defines variables for VPC, subnets, security groups and other network infrastructure components

variable "environment" {
  description = "Environment identifier (dev/staging/prod)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  
  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.vpc_cidr))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  description = "List of AWS availability zones for multi-AZ deployment"
  type        = list(string)
  
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones must be specified for high availability."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  
  validation {
    condition     = alltrue([
      for cidr in var.public_subnet_cidrs : can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", cidr))
    ])
    error_message = "All public subnet CIDRs must be valid IPv4 CIDR blocks."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  
  validation {
    condition     = alltrue([
      for cidr in var.private_subnet_cidrs : can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", cidr))
    ])
    error_message = "All private subnet CIDRs must be valid IPv4 CIDR blocks."
  }
}

variable "enable_nat_gateway" {
  description = "Flag to enable NAT Gateway for private subnet internet access"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Flag to use a single NAT Gateway instead of one per AZ (cost optimization for non-prod)"
  type        = bool
  default     = false
}

variable "enable_vpn_gateway" {
  description = "Flag to enable VPN Gateway for secure remote access"
  type        = bool
  default     = false
}

variable "enable_dns_hostnames" {
  description = "Flag to enable DNS hostnames in the VPC"
  type        = bool
  default     = true
}

variable "enable_dns_support" {
  description = "Flag to enable DNS support in the VPC"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Resource tags for network infrastructure components"
  type        = map(string)
  default     = {}
  
  validation {
    condition     = can(lookup(var.tags, "Environment", null)) && can(lookup(var.tags, "ManagedBy", null))
    error_message = "Tags must include at minimum 'Environment' and 'ManagedBy' keys."
  }
}

# Optional: Additional security-related variables
variable "vpc_flow_logs_retention_days" {
  description = "Number of days to retain VPC flow logs"
  type        = number
  default     = 30
  
  validation {
    condition     = var.vpc_flow_logs_retention_days >= 30
    error_message = "VPC flow logs must be retained for at least 30 days for security compliance."
  }
}

variable "enable_flow_logs" {
  description = "Flag to enable VPC flow logs for network monitoring"
  type        = bool
  default     = true
}

variable "network_acl_rules" {
  description = "Map of network ACL rules for enhanced security"
  type = map(object({
    rule_number = number
    egress     = bool
    protocol   = string
    rule_action = string
    cidr_block = string
    from_port  = number
    to_port    = number
  }))
  default = {}
}