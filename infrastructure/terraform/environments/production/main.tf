locals {
  name_prefix = "${var.project}-${var.environment}"
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "data" {
  source                 = "../../modules/data"
  name_prefix            = local.name_prefix
  point_in_time_recovery = var.environment == "production"
  deletion_protection    = var.enable_deletion_protection
  tags                   = local.tags
}

module "auth" {
  source              = "../../modules/auth"
  name_prefix         = local.name_prefix
  deletion_protection = var.enable_deletion_protection
  tags                = local.tags
}

module "frontend" {
  source      = "../../modules/frontend-hosting"
  name_prefix = local.name_prefix
  account_id  = var.allowed_account_id
  price_class = "PriceClass_200"
  tags        = local.tags
}

module "api" {
  source                = "../../modules/api"
  name_prefix           = local.name_prefix
  account_id            = var.allowed_account_id
  lambda_source_dir     = abspath("${path.root}/../../../lambda")
  content_table_name    = module.data.content_table_name
  content_table_arn     = module.data.content_table_arn
  contacts_table_name   = module.data.contacts_table_name
  contacts_table_arn    = module.data.contacts_table_arn
  rate_limit_table_name = module.data.rate_limit_table_name
  rate_limit_table_arn  = module.data.rate_limit_table_arn
  user_pool_client_id   = module.auth.user_pool_client_id
  user_pool_issuer      = module.auth.issuer_url
  admin_group           = module.auth.admin_group
  cors_allow_origins    = distinct(concat(["https://terutaro.github.io", module.frontend.admin_url], var.additional_cors_origins))
  tags                  = local.tags
}
