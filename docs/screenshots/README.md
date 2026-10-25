# ShopSphere — DA III Screenshot Directory & Evidence Checklist

> **Current Status:** Screenshots have **not yet been captured or committed** to this directory. No placeholder or fabricated images have been added. Capture each genuine screenshot from the live deployment (`https://d2yj8h74tzry42.cloudfront.net/`) and AWS Console (`ap-south-1`), redact sensitive identifiers as instructed below, and save the files directly in `docs/screenshots/` using the exact filenames listed in the table.

---

## 1. Required Screenshots for DA III Evaluation

Save all captured images in **`docs/screenshots/`** (PNG format recommended, minimum `1280×720` resolution):

| # | Status | Target Filename (`docs/screenshots/`) | View / URL to Capture | What the Screenshot Demonstrates |
|---|---|---|---|---|
| 1 | `[ ]` Pending | `01-homepage-cloudfront-https.png` | `https://d2yj8h74tzry42.cloudfront.net/` | ShopSphere homepage loaded over CloudFront HTTPS with browser address bar and TLS padlock visible, hero section, category pills, and popular product cards. |
| 2 | `[ ]` Pending | `02-product-catalogue-seeded.png` | `https://d2yj8h74tzry42.cloudfront.net/products` | Full product collection displaying the 8 seeded catalogue items across 6 categories (`Electronics`, `Fashion`, `Home & Kitchen`, `Books`, `Beauty & Personal Care`, `Sports & Fitness`) with INR pricing and ratings. |
| 3 | `[ ]` Pending | `03-product-detail-page.png` | `https://d2yj8h74tzry42.cloudfront.net/products/novatech-wireless-headphones` | Product detail page (`GET /api/products/:id`) showing full product description, brand/category badge, stock availability, quantity selector, "Add to cart" button, and related products. |
| 4 | `[ ]` Pending | `04-search-and-category-filter.png` | `https://d2yj8h74tzry42.cloudfront.net/products?category=electronics&sort=price-asc` | Catalogue sidebar filtering and search (`q`, `category`, `minPrice`/`maxPrice`, `inStock`, `rating`, `sort`) dynamically querying `GET /api/products`. |
| 5 | `[ ]` Pending | `05-shopping-cart.png` | `https://d2yj8h74tzry42.cloudfront.net/cart` | Authenticated customer shopping cart (`GET /api/cart`) with selected product(s), quantity controls (`PATCH /api/cart/items/:id`), item removal, and calculated INR subtotal/shipping summary. |
| 6 | `[ ]` Pending | `06-customer-login.png` | `https://d2yj8h74tzry42.cloudfront.net/login` | Customer login / registration screen (`POST /api/auth/login` or `POST /api/auth/register`) showing JWT-backed session authentication (never display plaintext passwords). |
| 7 | `[ ]` Pending | `07-checkout-and-order-confirmation.png` | `https://d2yj8h74tzry42.cloudfront.net/checkout` and `/orders` | Delivery address form (`POST /api/addresses`), payment method selection (`COD` or `MOCK`), and resulting order confirmation entry (`SS-...` order number, status `PENDING`, itemized total) in Order History (`GET /api/orders`). |
| 8 | `[ ]` Pending | `08-admin-dashboard.png` | `https://d2yj8h74tzry42.cloudfront.net/admin` | Protected Admin Dashboard (`GET /api/admin/dashboard`, `Role.ADMIN`) displaying live aggregate metrics: active product count, customer count, total orders, pending orders, revenue, and recent order list. |
| 9 | `[ ]` Pending | `09-admin-product-management.png` | `https://d2yj8h74tzry42.cloudfront.net/admin` (Product creation & inventory panel) | Admin product creation form (`POST /api/admin/products`), product table with stock/price overview, order status transition selector (`PATCH /api/admin/orders/:id/status`), or soft-deactivation (`DELETE /api/admin/products/:id`). |
| 10 | `[ ]` Pending | `10-api-health-endpoints.png` | `https://d2yj8h74tzry42.cloudfront.net/api/health` and `/api/health/db` | Browser or terminal (`curl -i`) output showing HTTP `200 OK` JSON responses from both `/api/health` (`{"status":"ok","service":"shopsphere-api",...}`) and `/api/health/db` (`{"status":"ok","db":"up",...}`). |
| 11 | `[ ]` Pending | `11-aws-console-architecture-redacted.png` | AWS Console (`ap-south-1`): CloudFront, EC2, RDS, VPC/Security Groups | Deployed AWS resources: CloudFront distribution (`d2yj8h74tzry42.cloudfront.net` with Default `*` and `/api/*` behaviors), Ubuntu 24.04 EC2 instance with attached IAM role, private Single-AZ RDS PostgreSQL (`Publicly accessible = No`), and `shopsphere-ec2-sg` / `shopsphere-rds-sg` inbound rules (**with 12-digit AWS Account ID redacted**). |
| 12 | `[ ]` Pending | `12-s3-sns-cloudwatch-evidence.png` | AWS Console (`ap-south-1`): S3 `shopsphere-products-2026`, SNS topic/email, and (if enabled) CloudWatch/CloudTrail | Private S3 bucket `shopsphere-products-2026` showing `Block all public access = On` (and/or presigned upload response), SNS topic / confirmed order notification email, and any verified CloudWatch metrics/logs or CloudTrail event history (**with account IDs and personal email addresses redacted**). |

---

## 2. Security & Redaction Rules Before Committing Screenshots

Because this GitHub repository is **public**, verify every image before running `git add docs/screenshots/*.png`:

1. **Redact or crop out:**
   - 12-digit AWS Account IDs in the top-right AWS Console header and inside ARN strings (`arn:aws:...:123456789012:...`).
   - Private RDS internal hostnames/IPs if paired with credentials, EC2 public IPv4 addresses if SSH (`22`) is open, and any `.pem` key filenames.
   - Any `JWT_SECRET`, database password, `Authorization: Bearer ...` header, or `localStorage.shopsphere_token` value in browser DevTools.
   - Personal email addresses or phone numbers in SNS subscription pages.
2. **Safe to show publicly:**
   - CloudFront URL (`https://d2yj8h74tzry42.cloudfront.net/`).
   - S3 bucket name (`shopsphere-products-2026`) with `Block all public access: On`.
   - Security group names (`shopsphere-ec2-sg`, `shopsphere-rds-sg`) and port numbers (`80`, `4000`, `5432`).
   - Public `/api/health`, `/api/health/db`, and `/api/products` responses.
