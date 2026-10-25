# College Report Screenshot Checklist (DA III — ShopSphere)

Capture the following screenshots during deployment and testing for inclusion in the Cloud Architecture Design report. Redact any sensitive tokens or passwords before pasting into the document.

## 1. AWS Console — Infrastructure & Networking (`ap-south-1`)
- [ ] **VPC & Subnets:** VPC overview showing public and private subnets in `ap-south-1` (confirming no NAT Gateway or Application Load Balancer is provisioned).
- [ ] **Security Groups:**
  - `shopsphere-ec2-sg` inbound rules (`TCP 80` and restricted `TCP 22`).
  - `shopsphere-rds-sg` inbound rules showing `TCP 5432` allowed **only** from `shopsphere-ec2-sg`.
- [ ] **EC2 Instance:** Running `t3.micro` Ubuntu 24.04 instance summary showing the attached IAM role (`shopsphere-ec2-role`) and security group.
- [ ] **RDS PostgreSQL:** Available Single-AZ PostgreSQL instance showing **Publicly accessible = No** and `shopsphere-rds-sg`.
- [ ] **S3 Bucket:** Private product image bucket showing **Block all public access = On** and the configured CORS policy.
- [ ] **IAM Role & Policy:** `shopsphere-ec2-role` permissions tab showing `CloudWatchAgentServerPolicy` and the least-privilege inline policy for S3 and SNS.
- [ ] **CloudFront Distribution:** Distribution summary showing the HTTPS `*.cloudfront.net` domain name, EC2 origin, and status `Deployed`.

## 2. Health Endpoints & Deployment Verification
- [ ] **EC2 Terminal (`deploy/deploy.sh` & PM2):** Output of `pm2 status`, `sudo nginx -t`, and `deploy/deploy.sh` completing cleanly.
- [ ] **API Health (`GET /api/health`):** Browser or `curl` output from `https://<CLOUDFRONT_DOMAIN>/api/health` returning `{"status":"ok","service":"shopsphere-api",...}`.
- [ ] **Database Health (`GET /api/health/db`):** Browser or `curl` output from `https://<CLOUDFRONT_DOMAIN>/api/health/db` returning `{"status":"ok","db":"up",...}`.
- [ ] **Smoke Test Script (`scripts/smoke-test.sh`):** Terminal output showing `PASS` for `health`, `register`, `login`, `products`, `cart`, and `order`.

## 3. Live Site & End-to-End Order Flow
- [ ] **Live Storefront (HTTPS):** Browser showing the ShopSphere home/catalogue page over `https://<CLOUDFRONT_DOMAIN>` (padlock icon visible).
- [ ] **Product Filtering & Details:** Searching or filtering products by category/brand and viewing a product detail page.
- [ ] **Customer Registration / Login & Cart:** Logged-in customer adding items to the shopping cart.
- [ ] **Checkout & Order Confirmation:** Adding a delivery address, placing a Cash on Delivery (`COD`) or `MOCK` order, and viewing the generated `SS-...` order number in the Order History page.

## 4. Admin Dashboard & S3 Presigned Upload
- [ ] **Admin Dashboard (`/api/admin/dashboard` UI):** Logged in as admin showing total products, customers, orders, pending count, and total revenue.
- [ ] **Admin Product Image Upload (S3):** Uploading a product image via presigned S3 PUT URL and viewing the created/updated product.

## 5. Observability, Notifications & Auditing
- [ ] **CloudWatch Log Groups:** CloudWatch Logs console showing `/shopsphere/nginx` (`access`/`error` streams) and `/shopsphere/api` (JSON request logs from Express/PM2).
- [ ] **CloudWatch Metrics & Alarms:** `ShopSphere/EC2` custom metrics (memory and disk usage) plus EC2 CPU/status alarms.
- [ ] **SNS Order Notification Email:** Inbox screenshot of the email sent by Amazon SNS (`ShopSphere order update`) when an order is placed.
- [ ] **CloudTrail Events:** CloudTrail Event History showing recent `ap-south-1` management events (e.g., EC2, S3, or RDS API calls).

## 6. Load Test & Cost Estimate
- [ ] **k6 Load Test Output (`loadtest/k6.js`):** Terminal summary of the 10-VU, 60-second k6 run showing `http_req_duration p(95) < 500ms` and `http_req_failed < 1%`.
- [ ] **AWS Pricing Calculator / Cost Estimate (`docs/cost-estimate.md`):** Screenshot of the AWS Pricing Calculator estimate alongside the completed table in `docs/cost-estimate.md`.
