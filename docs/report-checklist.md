# College Report Evidence & Screenshot Checklist (DA III — ShopSphere)

The canonical 12-item screenshot index and redaction guide for the **BCSE355L Cloud Architecture Design (DA III)** submission is maintained in **[`docs/screenshots/README.md`](./screenshots/README.md)**.

## Quick Checklist Summary

- [ ] `docs/screenshots/01-homepage-cloudfront-https.png` — ShopSphere homepage over CloudFront HTTPS (`https://d2yj8h74tzry42.cloudfront.net/`).
- [ ] `docs/screenshots/02-product-catalogue-seeded.png` — Product collection showing the 8 seeded products across 6 categories.
- [ ] `docs/screenshots/03-product-detail-page.png` — Product detail page (`/products/:slug`) with stock status and related products.
- [ ] `docs/screenshots/04-search-and-category-filter.png` — Search and category/price/rating/stock filter results.
- [ ] `docs/screenshots/05-shopping-cart.png` — Authenticated customer shopping cart with selected product and INR totals.
- [ ] `docs/screenshots/06-customer-login.png` — Customer login screen (`/login`).
- [ ] `docs/screenshots/07-checkout-and-order-confirmation.png` — Checkout and placed order (`SS-...`) in Order History (`/orders`).
- [ ] `docs/screenshots/08-admin-dashboard.png` — Admin dashboard (`/admin`) showing products, customers, orders, pending count, and revenue.
- [ ] `docs/screenshots/09-admin-product-management.png` — Admin product creation and order status management panel.
- [ ] `docs/screenshots/10-api-health-endpoints.png` — Live responses from `/api/health` and `/api/health/db`.
- [ ] `docs/screenshots/11-aws-console-architecture-redacted.png` — CloudFront (`/api/*` + `*` behaviors), EC2, private RDS, and Security Groups in `ap-south-1` (account IDs redacted).
- [ ] `docs/screenshots/12-s3-sns-cloudwatch-evidence.png` — Private S3 bucket `shopsphere-products-2026`, SNS order notification evidence, and verified CloudWatch/CloudTrail views (account IDs redacted).

See [`docs/screenshots/README.md`](./screenshots/README.md) for detailed capture instructions and security redaction requirements, and [`docs/DA-III-content.md`](./DA-III-content.md) for the complete DA III report source text.
