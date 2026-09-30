variable "allowed_account_id" {
  description = "Required target AWS account; checked before any provider action."
  type        = string
  nullable    = false
  validation {
    condition     = can(regex("^[0-9]{12}$", var.allowed_account_id))
    error_message = "allowed_account_id must contain exactly 12 digits."
  }
}

variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "environment" {
  type    = string
  default = "dev"
  validation {
    condition     = var.environment == "dev"
    error_message = "Use the separate environments directory for a different environment."
  }
}

variable "project" {
  type    = string
  default = "terutaro"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,15}$", var.project))
    error_message = "project must be 2–16 lowercase letters, numbers or hyphens."
  }
}

variable "additional_cors_origins" {
  description = "Additional exact HTTPS origins; localhost HTTP is allowed only in dev. No paths or wildcards."
  type        = list(string)
  default     = []
  validation {
    condition = alltrue([
      for origin in var.additional_cors_origins :
      can(regex("^https://[a-zA-Z0-9.-]+(:[0-9]+)?$", origin)) ||
      (var.environment == "dev" && can(regex("^http://(localhost|127[.]0[.]0[.]1)(:[0-9]+)?$", origin)))
    ])
    error_message = "Origins must be exact HTTPS origins without paths (dev also permits http://localhost[:port])."
  }
}

variable "enable_deletion_protection" {
  description = "Protect DynamoDB tables and Cognito from deletion. Disable only after verified migration or intentional teardown."
  type        = bool
  default     = false
  nullable    = false
}
