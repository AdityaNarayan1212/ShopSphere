# ShopSphere AWS Deployment Runbook (`ap-south-1`)

Target architecture (free-tier / AWS credits only — **no** NAT Gateway, ALB, Elastic Beanstalk, Cognito, Multi-AZ, or ElastiCache):

```
Browser -> CloudFront (HTTPS) -> EC2 Ubuntu 24.04 (Nginx :80 + PM2 + Express :4000) -> RDS PostgreSQL (private)
                                                    |-> S3 (private bucket, presigned uploads via IAM role)
                                                    |-> SNS (order notifications via IAM role)
                                                    |-> CloudWatch Agent (logs & memory/disk metrics)
```

---

## 1. VPC & Security Groups (`ap-south-1`)

1. Use the default VPC in `ap-south-1` (or a VPC with 2 public subnets and 2 private subnets across two AZs, **without** a NAT Gateway).
2. Create Security Group **`shopsphere-ec2-sg`**:
   - **Inbound:**
     - `TCP 80` (HTTP) from `0.0.0.0/0` (or restricted to the AWS CloudFront managed prefix list `com.amazonaws.global.cloudfront.origin-facing`).
     - `TCP 22` (SSH) from **your IP only** (`<YOUR_PUBLIC_IP>/32`).
   - **Outbound:** Allow all (`0.0.0.0/0`).
3. Create Security Group **`shopsphere-rds-sg`**:
   - **Inbound:** `TCP 5432` (PostgreSQL) with **Source = `shopsphere-ec2-sg`** only.
   - **Outbound:** Default.

---

## 2. Private S3 Bucket for Product Images

1. In S3, create a bucket (e.g. `shopsphere-media-<placeholder>`) in `ap-south-1`.
2. Keep **Block all public access = ON** (never make the bucket public).
3. Under **Permissions -> Cross-origin resource sharing (CORS)**, paste the contents of [`deploy/s3-cors.json`](../deploy/s3-cors.json) and replace `https://PLACEHOLDER_CLOUDFRONT_DOMAIN.cloudfront.net` with your CloudFront distribution URL once created.

---

## 3. Optional SNS Topic for Order Notifications

1. In Amazon SNS (`ap-south-1`), create a **Standard** topic (e.g. `shopsphere-orders`) and record its ARN.
2. Create an **Email** subscription with your college email address and click **Confirm subscription** in the email you receive.

---

## 4. IAM Role for EC2 (No Static Access Keys)

1. In IAM -> **Roles** -> **Create role**:
   - Trusted entity: **AWS service -> EC2**.
2. Attach the AWS-managed policy **`CloudWatchAgentServerPolicy`** (allows the CloudWatch Agent to push logs and memory/disk metrics).
3. Create an inline policy named `ShopSphereAppLeastPrivilege` using [`deploy/iam/ec2-role-policy.json`](../deploy/iam/ec2-role-policy.json), replacing:
   - `PLACEHOLDER_S3_BUCKET_NAME` with your S3 bucket name.
   - `PLACEHOLDER_AWS_ACCOUNT_ID` and `PLACEHOLDER_SNS_TOPIC_NAME` with your account ID and SNS topic name.
4. Name the role **`shopsphere-ec2-role`**.

---

## 5. Private RDS PostgreSQL Instance

1. In RDS -> **Create database**:
   - Engine: **PostgreSQL 16**.
   - Template: **Free tier** (`db.t3.micro` or `db.t4g.micro`, **Single-AZ**).
   - Initial database name: `shopsphere`.
   - Master username: `shopsphere`, set a strong master password.
   - Storage: 20 GB gp2/gp3, disable storage autoscaling if you want a hard cap.
   - Connectivity:
     - **Public access: No** (private subnets).
     - VPC security group: **`shopsphere-rds-sg`**.
   - Wait until status is **Available** and copy the **Endpoint**.

---

## 6. Launch & Bootstrap EC2 Ubuntu 24.04

1. In EC2 -> **Launch instance**:
   - AMI: **Ubuntu Server 24.04 LTS (HVM), SSD Volume Type**.
   - Instance type: **`t3.micro`** (1 GB RAM, free-tier eligible).
   - Key pair: create/download a `.pem` key (keep it out of Git).
   - Network settings: public subnet, **Auto-assign public IP: Enable**, Security group: **`shopsphere-ec2-sg`**.
   - Advanced details -> **IAM instance profile**: **`shopsphere-ec2-role`**.
2. SSH into the instance:
   ```bash
   chmod 400 /path/to/key.pem
   ssh -i /path/to/key.pem ubuntu@<EC2_PUBLIC_IP>
   ```
3. Clone the repository and run the idempotent bootstrap script [`deploy/setup-ec2.sh`](../deploy/setup-ec2.sh) (adds 2 GB swap, installs git, nginx, postgresql-client, Node 20, PM2, and configures PM2 systemd startup):
   ```bash
   git clone -b deploy-fixes https://github.com/AdityaNarayan1212/ShopSphere.git ~/shopsphere
   cd ~/shopsphere
   bash deploy/setup-ec2.sh
   ```

---

## 7. Configure Production Environment & Seed Database

1. Copy [`server/.env.production.example`](../server/.env.production.example) to `server/.env`:
   ```bash
   cp ~/shopsphere/server/.env.production.example ~/shopsphere/server/.env
   chmod 600 ~/shopsphere/server/.env
   ```
2. Generate a strong `JWT_SECRET` (at least 32 characters):
   ```bash
   openssl rand -base64 48
   ```
3. Edit `~/shopsphere/server/.env` and fill in:
   - `DATABASE_URL` (pointing to your private RDS endpoint with `?schema=public&sslmode=require`)
   - `JWT_SECRET`
   - `CLIENT_ORIGIN` (your CloudFront HTTPS domain)
   - `S3_BUCKET`, `ASSETS_BASE_URL` (optional), `SNS_ORDER_TOPIC_ARN` (optional)
   - `SEED_ADMIN_PASSWORD` (strong password; production seeding refuses `DemoAdmin!234`)
4. Verify RDS connectivity from EC2:
   ```bash
   psql "postgresql://shopsphere:<DB_PASSWORD>@<RDS_ENDPOINT>:5432/shopsphere?sslmode=require" -c "SELECT 1;"
   ```

---

## 8. Deploy Application with `deploy/deploy.sh`

1. Run [`deploy/deploy.sh`](../deploy/deploy.sh), which pulls the repo, installs dependencies, runs Prisma generate + `prisma migrate deploy`, builds server and client (`VITE_API_URL=/api`), copies `client/dist` to `/var/www/shopsphere`, reloads PM2 ([`deploy/ecosystem.config.cjs`](../deploy/ecosystem.config.cjs)), tests and reloads Nginx ([`deploy/nginx.conf`](../deploy/nginx.conf)), and queries `/api/health`:
   ```bash
   cd ~/shopsphere
   bash deploy/deploy.sh
   ```
2. Run the initial production seed once:
   ```bash
   cd ~/shopsphere
   NODE_ENV=production npm run db:seed --workspace server
   ```
3. Verify local health endpoints on EC2:
   ```bash
   curl -fsSL http://127.0.0.1/api/health
   curl -fsSL http://127.0.0.1/api/health/db
   ```

---

## 9. Configure CloudFront (HTTPS)

1. In CloudFront -> **Create distribution**:
   - **Origin domain:** EC2 Public IPv4 DNS name (e.g. `ec2-xx-xx-xx-xx.ap-south-1.compute.amazonaws.com`).
   - **Protocol:** **HTTP only** (Port 80 between CloudFront and EC2 Nginx).
   - **Viewer protocol policy:** **Redirect HTTP to HTTPS**.
   - **Allowed HTTP methods:** `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`.
   - **Cache policy (Default `*` behavior):** `CachingDisabled` (or create a separate `/assets/*` behavior with `CachingOptimized` and default `*` behavior with `CachingDisabled` + `OriginRequestPolicy: AllViewer`).
   - **Origin request policy:** `AllViewer` (forwards `Authorization`, query strings, cookies, and `X-Forwarded-*` headers to Nginx/Express).
2. Once deployed, copy the CloudFront domain (`https://dxxxxxxxxxxxx.cloudfront.net`), update `CLIENT_ORIGIN` in `~/shopsphere/server/.env` and S3 CORS (`deploy/s3-cors.json`), and reload PM2:
   ```bash
   pm2 reload ~/shopsphere/deploy/ecosystem.config.cjs --update-env
   ```

---

## 10. Install & Start CloudWatch Agent and CloudTrail

1. Install the Amazon CloudWatch Agent on Ubuntu 24.04 (`amd64`):
   ```bash
   curl -fsSL https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -o /tmp/amazon-cloudwatch-agent.deb
   sudo dpkg -i -E /tmp/amazon-cloudwatch-agent.deb
   ```
2. Apply [`deploy/cloudwatch-agent.json`](../deploy/cloudwatch-agent.json) to ship `/var/log/nginx/access.log` and `error.log` to `/shopsphere/nginx`, PM2 logs to `/shopsphere/api`, and memory/disk metrics to `ShopSphere/EC2`:
   ```bash
   sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
     -a fetch-config \
     -m ec2 \
     -s \
     -c file:/home/ubuntu/shopsphere/deploy/cloudwatch-agent.json
   ```
3. (Optional) In **AWS CloudTrail**, create a trail logging management events across regions to an S3 bucket for audit evidence.

---

## 11. End-to-End Smoke Test

From your machine or EC2, run [`scripts/smoke-test.sh`](../scripts/smoke-test.sh) against the live URL:

```bash
bash scripts/smoke-test.sh https://<YOUR_CLOUDFRONT_DOMAIN>.cloudfront.net
```
