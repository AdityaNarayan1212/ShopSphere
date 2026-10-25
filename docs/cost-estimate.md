# ShopSphere AWS Cost Estimate (`ap-south-1` Mumbai)

> **Important:** All monetary figures below are marked `TODO: verify in AWS Pricing Calculator`. Verify current `ap-south-1` rates in the [AWS Pricing Calculator](https://calculator.aws/) before submitting the college report, and terminate all billable resources immediately after the demonstration/grading.

## 1. Services Used

| Service | Resource / Configuration (`ap-south-1`) | Free-Tier / Credit Treatment | Estimated Monthly Cost (USD) |
|---|---|---|---|
| **Amazon EC2** | 1 × `t3.micro` (Ubuntu 24.04 LTS, 1 vCPU, 1 GB RAM + 2 GB swapfile on root volume) | AWS Free Tier (750 hrs/month for 12 months on eligible accounts) or AWS Learner/Educate Credits | `TODO: verify in AWS Pricing Calculator` |
| **Amazon EBS** | 1 × 8–20 GB `gp3` root volume attached to EC2 | AWS Free Tier includes up to 30 GB of EBS General Purpose (SSD) storage | `TODO: verify in AWS Pricing Calculator` |
| **Amazon RDS for PostgreSQL** | 1 × `db.t3.micro` / `db.t4g.micro` (PostgreSQL 16, Single-AZ, 20 GB General Purpose SSD, private subnet, no Multi-AZ) | AWS Free Tier (750 hrs/month Single-AZ + 20 GB storage + 20 GB backup for 12 months) or AWS Credits | `TODO: verify in AWS Pricing Calculator` |
| **Amazon CloudFront** | 1 × HTTPS distribution in front of EC2 Nginx | Always Free tier includes 1 TB data transfer out and 10,000,000 HTTP/HTTPS requests per month | `TODO: verify in AWS Pricing Calculator` |
| **Amazon S3** | 1 × private bucket for product images (presigned `PUT` / `GET`) | AWS Free Tier (5 GB Standard storage, 20,000 `GET`, 2,000 `PUT` requests/month for 12 months) | `TODO: verify in AWS Pricing Calculator` |
| **Amazon CloudWatch** | Log groups `/shopsphere/nginx` & `/shopsphere/api` (14-day retention) + `ShopSphere/EC2` memory/disk metrics + basic alarms | Always Free tier includes 5 GB log ingestion/archive, 10 custom metrics, and 10 standard alarms | `TODO: verify in AWS Pricing Calculator` |
| **Amazon SNS** | 1 × Standard topic (`shopsphere-orders`) + email subscription | Always Free tier includes 1,000,000 publishes and 1,000 email deliveries per month | `TODO: verify in AWS Pricing Calculator` |
| **AWS CloudTrail** | 1 × management-event trail (S3 storage for trail logs) | First copy of management events in each region is free; S3 storage billed under S3 bucket usage | `TODO: verify in AWS Pricing Calculator` |
| **AWS IAM & VPC** | `shopsphere-ec2-role` instance profile, security groups (`shopsphere-ec2-sg`, `shopsphere-rds-sg`), subnets | Free (no charge for IAM roles, security groups, or VPC subnets) | `TODO: verify in AWS Pricing Calculator` |
| **Public IPv4 Address** | 1 × public IPv4 attached to EC2 instance | Check current AWS Public IPv4 address hourly charge vs. Free Tier / Credit coverage | `TODO: verify in AWS Pricing Calculator` |

---

## 2. Explicitly Excluded Paid Services (Cost Avoidance)

To keep the deployment strictly within Free Tier / student credit limits, the architecture intentionally avoids:

- **NAT Gateway:** RDS lives in private subnets and requires no outbound internet access; EC2 runs in a public subnet.
- **Application Load Balancer (ALB):** CloudFront routes directly to Nginx on the single EC2 instance.
- **AWS Elastic Beanstalk:** Managed directly via idempotent scripts (`deploy/setup-ec2.sh`, `deploy/deploy.sh`) on EC2.
- **Amazon Cognito:** Uses application-managed bcrypt + JWT authentication.
- **RDS Multi-AZ & Provisioned IOPS:** Uses Single-AZ `db.t3.micro` with standard `gp2`/`gp3` storage.
- **Amazon ElastiCache:** No Redis/Memcached cluster provisioned.
