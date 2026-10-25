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
1. **RDS PostgreSQL:** Create a PostgreSQL database in private subnets. Allow inbound 5432 only from the backend security group. Set `DATABASE_URL` in backend environment settings and run Prisma migrations as a controlled deployment step.
2. **Elastic Beanstalk:** Deploy the `server` application or package the monorepo with a root start command. Set `NODE_ENV=production`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, and optional S3/SNS settings in the environment. Attach an IAM instance profile instead of static AWS keys.
3. **S3:** Create a private bucket for product images. Use presigned uploads and serve images through CloudFront or short-lived presigned GET URLs. Restrict CORS to the frontend origin.
4. **Cognito (production identity):** This demo currently uses local JWT auth. Replace the auth adapter with Cognito JWT verification before using Cognito as the identity provider; do not claim Cognito is active until that adapter is configured.
5. **Frontend:** Build `client` using `npm run build --workspace client`, then deploy `client/dist` to Amplify Hosting or a private S3 origin behind CloudFront. Configure SPA fallback to `index.html`.
6. **CloudWatch:** Send application logs to CloudWatch and create alarms for 5xx responses, latency, CPU, memory and database connections.
7. **SNS:** Set `AWS_REGION` and `SNS_ORDER_TOPIC_ARN`; grant the backend role `sns:Publish` only to the required topic.
8. **Clean up:** Delete test environments, load balancers, RDS instances/snapshots, S3 objects/buckets, CloudFront distributions and SNS topics after the demonstration to avoid ongoing charges.

## Important security checks before public deployment
- Replace demo credentials and JWT secret.
- Use HTTPS and secure cookie/token handling appropriate to your deployment.
- Configure exact CORS origins, rate limits, request-size limits and audit logging.
- Add tests, dependency scanning, backups, recovery testing and secret rotation.
- Configure Cognito or another production identity provider and verify JWT issuer/audience.
- Add payment gateway integration only through a legitimate provider; the mock payment option does not charge money.
