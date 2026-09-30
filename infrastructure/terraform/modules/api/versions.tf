terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.66, < 7.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.8, < 3.0"
    }
  }
}
