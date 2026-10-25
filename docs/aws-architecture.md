# ShopSphere AWS architecture

## Request flow
Browser → HTTPS CloudFront/Amplify → React static assets
Browser → HTTPS backend endpoint on Elastic Beanstalk → Express REST API
Express → private RDS PostgreSQL
Express → private S3 bucket (presigned product image uploads)
Express → SNS topic (optional order notifications)
Backend logs/metrics → CloudWatch
Production authentication target → Amazon Cognito (adapter still needs to be implemented and verified)

## Network and access
- Put RDS in private subnets; allow PostgreSQL ingress only from the backend security group.
- Use an IAM instance profile for the backend. Do not put AWS access keys in source code or frontend environment variables.
- Keep S3 private. Configure CORS narrowly and use short-lived presigned URLs. Use CloudFront Origin Access Control or signed access where appropriate.
- Use TLS for all public endpoints and managed secrets/environment settings.
- Configure backend CORS to exact frontend origins.

## Suggested college demo order
1. Run app locally with Docker PostgreSQL.
2. Show React frontend and REST API.
3. Create RDS and update backend DATABASE_URL.
4. Deploy backend to Elastic Beanstalk and demonstrate `/api/health`.
5. Deploy frontend using Amplify or S3 + CloudFront.
6. Upload product image with the S3 presigned endpoint (after bucket/IAM setup).
7. Configure SNS topic and demonstrate order notifications.
8. Show CloudWatch logs/alarms.

## Cost hygiene
Use the smallest suitable resources for the short demonstration, check current AWS pricing, avoid unnecessary NAT gateways/load balancers, and delete resources after grading. RDS deletion, snapshots, data transfer, S3 storage and CloudFront can continue to incur charges.
