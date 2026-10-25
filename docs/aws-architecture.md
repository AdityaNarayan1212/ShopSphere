# ShopSphere AWS architecture

## Request flow
Browser → HTTPS CloudFront → EC2 Ubuntu 24.04 (Nginx) → React static assets (`/var/www/shopsphere`)
Browser → HTTPS CloudFront → EC2 Ubuntu 24.04 (Nginx `/api/*` proxy) → PM2 / Express REST API (`127.0.0.1:4000`)
Express → private RDS PostgreSQL (single-AZ, private subnet)
Express → private S3 bucket (presigned product image uploads via EC2 IAM role)
Express → SNS topic (optional order notifications via EC2 IAM role)
Nginx & PM2 logs/metrics → CloudWatch Agent (`/shopsphere/nginx`, `/shopsphere/api`)
Account activity → AWS CloudTrail

## Network and access
- Put RDS in private subnets; allow PostgreSQL ingress (`5432`) only from the EC2 security group.
- Use an IAM instance profile on EC2. Do not put AWS access keys in source code or environment variables.
- Keep S3 private. Configure CORS narrowly and use short-lived presigned URLs. Use CloudFront Origin Access Control where appropriate.
- Terminate TLS at CloudFront and forward traffic to Nginx on EC2.
- Configure backend CORS to exact frontend origins.

## Suggested college demo order
1. Run app locally with Docker PostgreSQL.
2. Show React frontend and REST API.
3. Create private RDS PostgreSQL and configure `server/.env`.
4. Provision EC2 Ubuntu 24.04 with Nginx + PM2, deploy the monorepo, and demonstrate `/api/health` and `/api/health/db`.
5. Put CloudFront in front of EC2 for HTTPS.
6. Upload product image with the S3 presigned endpoint (after bucket/IAM setup).
7. Configure SNS topic and demonstrate order notifications.
8. Show CloudWatch logs/alarms and CloudTrail events.

## Cost hygiene
Use free-tier/credit-eligible resources (`t3.micro` EC2, `db.t3.micro` single-AZ RDS, no NAT Gateway, no ALB, no Multi-AZ, no ElastiCache), check current AWS pricing, and delete resources after grading. RDS deletion, snapshots, data transfer, S3 storage and CloudFront can continue to incur charges.
