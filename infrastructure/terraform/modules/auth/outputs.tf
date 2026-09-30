output "user_pool_id" { value = aws_cognito_user_pool.admin.id }
output "user_pool_client_id" { value = aws_cognito_user_pool_client.admin.id }
output "issuer_url" { value = "https://${aws_cognito_user_pool.admin.endpoint}" }
output "admin_group" { value = aws_cognito_user_group.administrators.name }
