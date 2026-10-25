# ShopSphere AWS Architecture (`ap-south-1`)

**Live Storefront & API Entry Point:** https://d2yj8h74tzry42.cloudfront.net/  
**GitHub Repository:** https://github.com/AdityaNarayan1212/ShopSphere

---

## 1. Architecture Overview

ShopSphere is deployed in the **AWS Asia Pacific (Mumbai) region (`ap-south-1`)** using a cost-aware, two-tier VPC topology fronted by **Amazon CloudFront**. The architecture is designed for the VIT Chennai **BCSE355L Cloud Architecture Design (DA III)** assessment to demonstrate defense-in-depth network isolation, credential-free IAM service integration, and reverse-proxy single-origin routing without incurring charges from paid-by-default networking appliances (no NAT Gateway, no Application Load Balancer, no Elastic Beanstalk, no Multi-AZ RDS, and no ElastiCache).

```mermaid
flowchart TB
    User["User Browser / API Client"]

    subgraph Edge["AWS Global Edge Network"]
        CF["Amazon CloudFront Distribution<br/>https://d2yj8h74tzry42.cloudfront.net/<br/>• Default (*) Behavior: SPA Static Assets<br/>• /api/* Behavior: CachingDisabled, All HTTP Methods"]
    end

    subgraph AWSRegion["AWS Region: ap-south-1 (Mumbai)"]
        subgraph VPC["Amazon VPC (Public & Private Subnets — No NAT Gateway, No ALB)"]
            subgraph PublicSubnet["Public Subnet (Application Tier)"]
                subgraph EC2SG["Security Group: shopsphere-ec2-sg<br/>(Inbound: TCP 80 HTTP from CloudFront, TCP 22 SSH restricted)"]
                    subgraph EC2["Amazon EC2 Ubuntu 24.04 LTS (t3.micro, 2 GB Swap)"]
                        Nginx["Nginx 1.24 Reverse Proxy (:80)<br/>• Serves React SPA (/var/www/shopsphere)<br/>• Proxies /api/* & /api-docs to 127.0.0.1:4000"]
                        PM2["PM2 Process Manager + Express.js API (:4000)<br/>Node.js 20 LTS + Prisma ORM Client"]
                        CWAgent["CloudWatch Agent (Config Provided in deploy/cloudwatch-agent.json)"]
                    end
                end
            end

            subgraph PrivateSubnet["Private Subnets (Database Tier — No Public IP)"]
                subgraph RDSSG["Security Group: shopsphere-rds-sg<br/>(Inbound: TCP 5432 PostgreSQL ONLY from shopsphere-ec2-sg)"]
                    RDS[("Amazon RDS for PostgreSQL 16<br/>(Single-AZ, Private Subnet)")]
                end
            end
        end

        IAM["EC2 IAM Instance Role<br/>(Least-Privilege S3 & SNS Policy — No Static Keys)"]
        S3[("Amazon S3 Private Bucket<br/>shopsphere-products-2026<br/>(Block Public Access ON, Presigned PUT)")]
        SNS["Amazon SNS Topic<br/>(Order Notification Publishes)"]
        CW["Amazon CloudWatch<br/>(Host Metrics & Optional Log Groups)"]
        CT["AWS CloudTrail<br/>(Account Management Event History)"]
    end

    User -->|"HTTPS (TLS 1.3 / 443)"| CF
    CF -->|"HTTP (:80) Origin Fetch<br/>Default (*) & /api/* Behaviors"| Nginx
    Nginx -->|"try_files SPA Fallback (/index.html, /assets/*)"| CF
    Nginx -->|"Reverse Proxy (127.0.0.1:4000)<br/>X-Forwarded-For / X-Forwarded-Proto"| PM2
    PM2 -->|"Prisma TCP :5432 (SSL)"| RDS
    EC2 -.->|"Instance Metadata (IMDSv2)"| IAM
    PM2 -->|"Generate Presigned PUT URL"| S3
    User -.->|"Direct Presigned PUT Upload (CORS)"| S3
    PM2 -->|"Publish Order Notification"| SNS
    CWAgent -.->|"Ships Logs/Metrics When Enabled"| CW
    AWSRegion -.->|"Management API Audit"| CT
```

---

## 2. Accessibility & Textual Walkthrough of the Request and Data Flow

For screen readers and print evaluation, the end-to-end request lifecycle operates across five logical boundaries:

1. **Client to Edge (`Browser -> Amazon CloudFront`):**
   - Users access `https://d2yj8h74tzry42.cloudfront.net/` over HTTPS. Plain HTTP requests (`http://d2yj8h74tzry42.cloudfront.net/`) receive an immediate `301 Moved Permanently` redirect to `https://`.
   - The CloudFront distribution uses the EC2 Nginx server as its origin and defines two path behaviors:
     - **Default (`*`) behavior:** Serves the compiled React 18 + Vite single-page application (`index.html` and fingerprinted `/assets/*` bundles with `Cache-Control: public, max-age=31536000, immutable`).
     - **API (`/api/*`) behavior:** Configured with **caching disabled** (`X-Cache: Miss from cloudfront` on every request), all REST methods enabled (`GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`), and viewer headers (`Authorization`, `Content-Type`, query strings) forwarded to the origin.

2. **Public Application Tier (`CloudFront -> EC2 Ubuntu 24.04 -> Nginx -> PM2 / Express`):**
   - Requests enter the VPC public subnet through the Internet Gateway and reach the Ubuntu 24.04 EC2 instance (`t3.micro` with a 2 GB swapfile configured via [`deploy/setup-ec2.sh`](../deploy/setup-ec2.sh)), protected by security group `shopsphere-ec2-sg`.
   - **Nginx (`1.24.0`)** listens on TCP port `80` ([`deploy/nginx.conf`](../deploy/nginx.conf)):
     - Static routes (`/`, `/products`, `/cart`, `/admin`, etc.) resolve against `/var/www/shopsphere` with `try_files $uri $uri/ /index.html` so React Router (`BrowserRouter`) deep links render without `404` errors.
     - API routes (`/api/*`) and Swagger documentation (`/api-docs`) are reverse-proxied over loopback (`http://127.0.0.1:4000`) with `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers attached.
   - **Express.js (`server/src/index.ts`)** runs under **PM2** ([`deploy/ecosystem.config.cjs`](../deploy/ecosystem.config.cjs)) on `127.0.0.1:4000` with `app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1))` so rate limiting (`express-rate-limit` on `/api/auth`) evaluates the real client IP behind CloudFront and Nginx.

3. **Private Database Tier (`Express -> Amazon RDS for PostgreSQL`):**
   - Express connects via Prisma ORM (`@prisma/client`) over TCP port `5432` to a **Single-AZ Amazon RDS for PostgreSQL 16** instance located in private subnets (`Publicly accessible = No`).
   - Database security group `shopsphere-rds-sg` permits inbound TCP `5432` **only** from `shopsphere-ec2-sg`. No internet host can reach the database directly, and because RDS initiates no outbound internet connections, **no NAT Gateway is required**.

4. **Credential-Free AWS Service Integrations (`EC2 IAM Role -> S3 & SNS`):**
   - The EC2 instance assumes an IAM instance profile scoped by [`deploy/iam/ec2-role-policy.json`](../deploy/iam/ec2-role-policy.json). No static `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` values are stored on disk or in environment files.
   - **Amazon S3 (`shopsphere-products-2026`):** A private S3 bucket (`Block all public access = ON`) stores product images under `products/<uuid>.<ext>`. The admin endpoint `POST /api/admin/uploads/presign` uses `@aws-sdk/s3-request-presigner` to generate a 300-second presigned `PUT` URL. No separate S3 CloudFront distribution is deployed; seeded catalogue products use curated HTTPS image URLs while `shopsphere-products-2026` supports the presigned upload workflow.
   - **Amazon SNS:** When an order is placed (`POST /api/orders`) and `SNS_ORDER_TOPIC_ARN` is configured, `notifyOrder()` publishes an order summary (`Subject: "ShopSphere order update"`) to the configured Amazon SNS topic using `@aws-sdk/client-sns`. If `SNS_ORDER_TOPIC_ARN` is unset, the server falls back to structured console logging without failing the checkout transaction.

5. **Observability & Auditing (`CloudWatch & CloudTrail`):**
   - **Application Logging:** Express emits one structured JSON log line per HTTP request (`{"method","path","status","ms"}`) to standard output (captured by PM2 in `~/.pm2/logs/`), intentionally omitting `Authorization` headers and request bodies.
   - **CloudWatch Agent & CloudTrail Status:** Standard EC2/RDS host metrics and default AWS CloudTrail 90-day management event history are available in the AWS Console by default. Repository configuration [`deploy/cloudwatch-agent.json`](../deploy/cloudwatch-agent.json) defines log shipping for `/shopsphere/nginx` and `/shopsphere/api` plus memory/disk metrics; however, active log-stream delivery and custom persistent CloudTrail trails must be verified in the AWS Console (see [`docs/screenshots/README.md`](./screenshots/README.md)) rather than assumed from the configuration file alone.
