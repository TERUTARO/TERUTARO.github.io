output "content_table_name" { value = aws_dynamodb_table.content.name }
output "content_table_arn" { value = aws_dynamodb_table.content.arn }
output "contacts_table_name" { value = aws_dynamodb_table.contacts.name }
output "contacts_table_arn" { value = aws_dynamodb_table.contacts.arn }
output "rate_limit_table_name" { value = aws_dynamodb_table.rate_limit.name }
output "rate_limit_table_arn" { value = aws_dynamodb_table.rate_limit.arn }
