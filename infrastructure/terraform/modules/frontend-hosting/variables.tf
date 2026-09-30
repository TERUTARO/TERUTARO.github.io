variable "name_prefix" { type = string }
variable "account_id" { type = string }
variable "tags" { type = map(string) }
variable "price_class" {
  type    = string
  default = "PriceClass_200"
}
