resource "aws_dynamodb_table" "content" {
  name                        = "${var.name_prefix}-content"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "collection"
  range_key                   = "id"
  deletion_protection_enabled = var.deletion_protection

  attribute {
    name = "collection"
    type = "S"
  }
  attribute {
    name = "id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }
  server_side_encryption {
    enabled = true
  }
  tags = var.tags
}

resource "aws_dynamodb_table" "contacts" {
  name                        = "${var.name_prefix}-contacts"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "id"
  deletion_protection_enabled = var.deletion_protection

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "entity"
    type = "S"
  }
  attribute {
    name = "createdAt"
    type = "S"
  }
  global_secondary_index {
    name            = "by-created-at"
    hash_key        = "entity"
    range_key       = "createdAt"
    projection_type = "ALL"
  }
  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }
  server_side_encryption {
    enabled = true
  }
  tags = var.tags
}

resource "aws_dynamodb_table" "rate_limit" {
  name                        = "${var.name_prefix}-rate-limit"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "id"
  deletion_protection_enabled = var.deletion_protection

  attribute {
    name = "id"
    type = "S"
  }
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
  server_side_encryption {
    enabled = true
  }
  tags = var.tags
}
