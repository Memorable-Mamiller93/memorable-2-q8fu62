# VPC Outputs
output "vpc_id" {
  description = "ID of the created VPC for resource association"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the created VPC for network planning"
  value       = aws_vpc.main.cidr_block
}

output "vpc_dns_settings" {
  description = "DNS settings for the VPC configuration"
  value = {
    enable_dns_hostnames = aws_vpc.main.enable_dns_hostnames
    enable_dns_support   = aws_vpc.main.enable_dns_support
  }
}

# Subnet Outputs
output "public_subnet_ids" {
  description = "List of public subnet IDs for load balancer and bastion host placement"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for application and database tier placement"
  value       = aws_subnet.private[*].id
}

output "subnet_details" {
  description = "Detailed subnet information including CIDR blocks and AZs"
  value = {
    public_subnets = [
      for subnet in aws_subnet.public : {
        id                = subnet.id
        cidr_block       = subnet.cidr_block
        availability_zone = subnet.availability_zone
      }
    ]
    private_subnets = [
      for subnet in aws_subnet.private : {
        id                = subnet.id
        cidr_block       = subnet.cidr_block
        availability_zone = subnet.availability_zone
      }
    ]
  }
}

# NAT Gateway Outputs
output "nat_gateway_ips" {
  description = "List of Elastic IPs associated with NAT Gateways"
  value       = aws_eip.nat[*].public_ip
}

output "nat_gateway_details" {
  description = "Detailed information about NAT Gateways for network troubleshooting"
  value = {
    nat_gateway_ids = aws_nat_gateway.main[*].id
    nat_gateway_subnets = aws_nat_gateway.main[*].subnet_id
    elastic_ips = aws_eip.nat[*].public_ip
  }
}

# Route Table Outputs
output "route_tables" {
  description = "Route table IDs for network routing configuration"
  value = {
    public  = aws_route_table.public.id
    private = aws_route_table.private[*].id
  }
}

# Network ACL Outputs
output "network_acls" {
  description = "Network ACL IDs for security configuration"
  value = {
    public  = aws_network_acl.public.id
    private = aws_network_acl.private.id
  }
}

# VPN Gateway Output (if enabled)
output "vpn_gateway_id" {
  description = "ID of the VPN Gateway if enabled"
  value       = var.enable_vpn_gateway ? aws_vpn_gateway.main[0].id : null
}

# Flow Logs Output
output "flow_logs_config" {
  description = "VPC Flow Logs configuration details"
  value = var.enable_flow_logs ? {
    log_group_name = aws_cloudwatch_log_group.flow_logs[0].name
    log_group_arn  = aws_cloudwatch_log_group.flow_logs[0].arn
    role_arn       = aws_iam_role.flow_logs[0].arn
  } : null
}

# Availability Zones Output
output "availability_zones" {
  description = "List of availability zones used in the VPC configuration"
  value       = var.availability_zones
}

# Security-related Outputs
output "network_security_details" {
  description = "Network security configuration details"
  value = {
    vpc_flow_logs_enabled = var.enable_flow_logs
    nat_gateway_enabled   = var.enable_nat_gateway
    single_nat_gateway    = var.single_nat_gateway
    vpn_gateway_enabled   = var.enable_vpn_gateway
  }
  sensitive = true
}

# Tags Output
output "resource_tags" {
  description = "Tags applied to network resources"
  value       = var.tags
}

# Internet Gateway Output
output "internet_gateway_id" {
  description = "ID of the Internet Gateway attached to the VPC"
  value       = aws_internet_gateway.main.id
}