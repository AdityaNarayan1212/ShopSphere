# API quick reference

Base URL: `http://localhost:4000/api`

## Public
- `GET /health`
- `GET /health/db`
- `GET /products?q=&category=&brand=&minPrice=&maxPrice=&rating=&inStock=true&sort=&page=&limit=`
- `GET /products/:id` (id or slug)
- `GET /categories`
- `GET /brands`
- `GET /products/:id/reviews`

## Authentication
- `POST /auth/register` — `{ "name", "email", "password" }`
- `POST /auth/login` — `{ "email", "password" }`
- `POST /auth/logout` — bearer token
- `GET /auth/me` — bearer token

## Customer (Bearer token required)
- `GET /cart`
- `POST /cart/items` — `{ "productId", "quantity" }`
- `PATCH /cart/items/:id` — `{ "quantity" }`
- `DELETE /cart/items/:id`
- `GET /wishlist`
- `POST /wishlist/items` — `{ "productId" }`
- `DELETE /wishlist/items/:id`
- `GET /addresses`
- `POST /addresses` — recipient/address/phone fields
- `POST /orders` — `{ "addressId", "paymentMethod": "COD" | "MOCK" }`
- `GET /orders`
- `GET /orders/:id`
- `POST /orders/:id/cancel`
- `POST /products/:id/reviews` — purchased customers only

## Admin (Bearer token + ADMIN role)
- `GET /admin/dashboard`
- `POST /admin/products`
- `PATCH /admin/products/:id`
- `DELETE /admin/products/:id` — deactivates product
- `GET /admin/orders`
- `PATCH /admin/orders/:id/status`
- `GET /admin/customers`
- `PATCH /admin/customers/:id/active`
- `POST /admin/uploads/presign`

Swagger UI is available at `/api-docs`. The OpenAPI document is intentionally concise; expand it to document all request/response schemas before external integration.
