# ShopSphere — AWS E-commerce College Project

A modular React + Express + PostgreSQL e-commerce demo prepared for local development and AWS deployment.

## Features
- Product catalogue, search, category filters, sorting and product details
- Registration/login with bcrypt password hashing and JWT authentication
- Customer cart, wishlist, checkout (Cash on Delivery or clearly labelled mock payment)
- Order history and cancellation
- Protected admin product/order management and dashboard summary
- Prisma/PostgreSQL schema and seed data
- S3 presigned-upload adapter, SNS notification adapter, health endpoint
- Docker Compose for local PostgreSQL

> This is a college demo starter, not a security audit or a claim of production readiness. Review the deployment checklist before exposing it publicly.

## Requirements
- Node.js 20+
- npm 10+
- Docker Desktop (recommended) or PostgreSQL 15+

## 1. Configure
```bash
cp .env.example .env
```
On Windows PowerShell:
```powershell
Copy-Item .env.example .env
```
Set a unique `JWT_SECRET` in `.env` before running. Never commit `.env`.

## 2. Start PostgreSQL
```bash
docker compose up -d db
```

## 3. Install and initialize
```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

## 4. Run the app
In one terminal:
```bash
npm run dev:server
```
In another terminal:
```bash
npm run dev:client
```
Open http://localhost:5173. The API runs on http://localhost:4000 and Swagger UI on http://localhost:4000/api-docs.

## Demo accounts
Seed script creates:
- Admin: `admin@shopsphere.demo` / `DemoAdmin!234`
- Customer: `customer@shopsphere.demo` / `DemoUser!234`

These credentials are for local demonstration only. Change or remove them before deployment.

## AWS deployment outline
1. **RDS PostgreSQL:** Create a single-AZ PostgreSQL database in private subnets (`ap-south-1`). Allow inbound 5432 only from the EC2 security group. Set `DATABASE_URL` in `server/.env` and run Prisma migrations (`npm run db:deploy --workspace server`).
2. **EC2 (Ubuntu 24.04 + Nginx + PM2):** Run the Express backend under PM2 on `127.0.0.1:4000` and serve the built React frontend (`/var/www/shopsphere`) via Nginx, proxying `/api/*` and `/api-docs` to Express. Attach an IAM instance profile instead of static AWS keys.
3. **CloudFront:** Terminate HTTPS in front of the EC2 origin and forward requests to Nginx.
4. **S3:** Create a private bucket for product images. Use presigned PUT uploads via the EC2 IAM role and optionally serve images via `ASSETS_BASE_URL` (CloudFront OAC) or presigned GET URLs. Restrict CORS to the frontend origin.
5. **CloudWatch & CloudTrail:** Ship Nginx and PM2 logs and memory/disk metrics via the CloudWatch Agent (`/shopsphere/nginx`, `/shopsphere/api`), and enable a management-event CloudTrail trail.
6. **SNS:** Set `AWS_REGION` and `SNS_ORDER_TOPIC_ARN`; grant the EC2 IAM role `sns:Publish` only to the required topic.
7. **Clean up:** Delete test instances, RDS databases/snapshots, S3 objects/buckets, CloudFront distributions and SNS topics after the demonstration to avoid ongoing charges.

## Important security checks before public deployment
- Replace demo credentials and `JWT_SECRET` (at least 32 characters in production).
- Use HTTPS via CloudFront and configure `TRUST_PROXY=2` behind CloudFront + Nginx.
- Configure exact CORS origins, rate limits, request-size limits and audit logging.
- Add payment gateway integration only through a legitimate provider; the mock payment option does not charge money.
