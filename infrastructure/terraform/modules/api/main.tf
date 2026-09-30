locals {
  functions = {
    public = {
      handler     = "public.handler.lambda_handler"
      environment = { CONTENT_TABLE = var.content_table_name }
    }
    contact = {
      handler = "contact.handler.lambda_handler"
      environment = {
        CONTACTS_TABLE   = var.contacts_table_name
        RATE_LIMIT_TABLE = var.rate_limit_table_name
      }
    }
    admin = {
      handler = "admin.handler.lambda_handler"
      environment = {
        CONTENT_TABLE  = var.content_table_name
        CONTACTS_TABLE = var.contacts_table_name
        ADMIN_GROUP    = var.admin_group
        ADMIN_SCOPE    = "aws.cognito.signin.user.admin"
      }
    }
  }
  routes = {
    "GET /public/content" = {
      function = "public", protected = false, rate = 50, burst = 100, invocation = "GET/public/content"
    }
    "POST /contact" = {
      function = "contact", protected = false, rate = 5, burst = 10, invocation = "POST/contact"
    }
    "GET /admin/content/{collection}" = {
      function = "admin", protected = true, rate = 10, burst = 20, invocation = "GET/admin/content/*"
    }
    "PUT /admin/content/{collection}/{id}" = {
      function = "admin", protected = true, rate = 10, burst = 20, invocation = "PUT/admin/content/*/*"
    }
    "DELETE /admin/content/{collection}/{id}" = {
      function = "admin", protected = true, rate = 10, burst = 20, invocation = "DELETE/admin/content/*/*"
    }
    "GET /admin/contacts" = {
      function = "admin", protected = true, rate = 10, burst = 20, invocation = "GET/admin/contacts"
    }
    "PATCH /admin/contacts/{id}" = {
      function = "admin", protected = true, rate = 10, burst = 20, invocation = "PATCH/admin/contacts/*"
    }
  }
  data_policies = {
    public = jsonencode({
      Version = "2012-10-17"
      Statement = [{
        Effect   = "Allow"
        Action   = ["dynamodb:Query"]
        Resource = var.content_table_arn
      }]
    })
    contact = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect   = "Allow"
          Action   = ["dynamodb:GetItem", "dynamodb:PutItem"]
          Resource = var.contacts_table_arn
        },
        {
          Effect   = "Allow"
          Action   = ["dynamodb:UpdateItem"]
          Resource = var.rate_limit_table_arn
        }
      ]
    })
    admin = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect   = "Allow"
          Action   = ["dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Query"]
          Resource = var.content_table_arn
        },
        {
          Effect   = "Allow"
          Action   = ["dynamodb:UpdateItem"]
          Resource = var.contacts_table_arn
        },
        {
          Effect   = "Allow"
          Action   = ["dynamodb:Query"]
          Resource = "${var.contacts_table_arn}/index/by-created-at"
        }
      ]
    })
  }
}

# Package common code and all three entry-point packages together, without test/config artifacts.
data "archive_file" "lambda" {
  type                        = "zip"
  source_dir                  = var.lambda_source_dir
  output_path                 = "${path.root}/.build/${var.name_prefix}-lambda.zip"
  output_file_mode            = "0644"
  exclude_symlink_directories = true
  excludes = [
    "tests", "tests/**", "**/tests/**", "**/test_*.py", "**/*_test.py",
    "__pycache__", "**/__pycache__/**", "**/*.pyc", "**/*.pyo",
    ".pytest_cache", ".pytest_cache/**", ".venv", ".venv/**",
    ".env", ".env.*", "**/.env", "**/.env.*", ".DS_Store", "**/.DS_Store",
    "README.md", "requirements-dev.txt"
  ]
}

resource "aws_iam_role" "lambda" {
  for_each = local.functions
  name     = "${var.name_prefix}-${each.key}-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
  tags = var.tags
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = local.functions
  name              = "/aws/lambda/${var.name_prefix}-${each.key}"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_iam_role_policy" "logs" {
  for_each = local.functions
  name     = "write-function-logs"
  role     = aws_iam_role.lambda[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.lambda[each.key].arn}:*"
    }]
  })
}

resource "aws_iam_role_policy" "data" {
  for_each = local.functions
  name     = "function-data-access"
  role     = aws_iam_role.lambda[each.key].id
  policy   = local.data_policies[each.key]
}

resource "aws_lambda_function" "api" {
  for_each         = local.functions
  function_name    = "${var.name_prefix}-${each.key}"
  role             = aws_iam_role.lambda[each.key].arn
  runtime          = "python3.12"
  architectures    = ["x86_64"]
  handler          = each.value.handler
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  memory_size      = 256
  timeout          = 15

  environment {
    variables = each.value.environment
  }
  depends_on = [aws_iam_role_policy.logs, aws_iam_role_policy.data]
  tags       = var.tags
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.name_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.cors_allow_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "Idempotency-Key"]
    max_age       = 600
  }
  tags = var.tags
}

resource "aws_apigatewayv2_authorizer" "admin" {
  api_id           = aws_apigatewayv2_api.http.id
  name             = "cognito-administrators"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  jwt_configuration {
    audience = [var.user_pool_client_id]
    issuer   = var.user_pool_issuer
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  for_each               = local.functions
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api[each.key].invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 16000
}

resource "aws_apigatewayv2_route" "routes" {
  for_each             = local.routes
  api_id               = aws_apigatewayv2_api.http.id
  route_key            = each.key
  target               = "integrations/${aws_apigatewayv2_integration.lambda[each.value.function].id}"
  authorization_type   = each.value.protected ? "JWT" : "NONE"
  authorizer_id        = each.value.protected ? aws_apigatewayv2_authorizer.admin.id : null
  authorization_scopes = each.value.protected ? ["aws.cognito.signin.user.admin"] : null
}

resource "aws_lambda_permission" "api_gateway" {
  for_each       = local.routes
  statement_id   = "ApiRoute${substr(sha1(each.key), 0, 16)}"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.api[each.value.function].function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${aws_apigatewayv2_api.http.execution_arn}/*/${each.value.invocation}"
  source_account = var.account_id
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${var.name_prefix}"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  # Exclude bodies, user input, tokens, IP addresses and query strings from access logs.
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
    })
  }
  default_route_settings {
    throttling_rate_limit  = 10
    throttling_burst_limit = 20
  }
  dynamic "route_settings" {
    for_each = local.routes
    content {
      route_key              = route_settings.key
      throttling_rate_limit  = route_settings.value.rate
      throttling_burst_limit = route_settings.value.burst
    }
  }
  depends_on = [aws_apigatewayv2_route.routes]
  tags       = var.tags
}
