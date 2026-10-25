#!/usr/bin/env bash
set -euo pipefail

# ShopSphere end-to-end API smoke test
# Usage: bash scripts/smoke-test.sh [BASE_URL]
# Example (local):      bash scripts/smoke-test.sh http://localhost:4000
# Example (CloudFront): bash scripts/smoke-test.sh https://dxxxxxxxxxxxx.cloudfront.net

BASE_URL="${1:-http://localhost:4000}"
BASE_URL="${BASE_URL%/}"
API_URL="${BASE_URL}/api"

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  echo "PASS: $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo "FAIL: $1 — $2"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

json_field() {
  local expr="$1"
  node -e "const d = JSON.parse(require('fs').readFileSync(0, 'utf8')); const v = (${expr})(d); if (v === undefined || v === null || v === '') process.exit(1); console.log(v);"
}

echo "==> Running ShopSphere smoke tests against ${API_URL}"

# 1. Health (/api/health and /api/health/db)
if HEALTH_JSON="$(curl -fsSL "${API_URL}/health" 2>/dev/null)" \
  && [ "$(printf '%s' "${HEALTH_JSON}" | json_field 'd => d.status')" = "ok" ] \
  && DB_JSON="$(curl -fsSL "${API_URL}/health/db" 2>/dev/null)" \
  && [ "$(printf '%s' "${DB_JSON}" | json_field 'd => d.db')" = "up" ]; then
  pass "health (/api/health & /api/health/db)"
else
  fail "health (/api/health & /api/health/db)" "Health or DB health check failed"
fi

# 2. Register (/api/auth/register)
EMAIL="smoke.$(date +%s).$RANDOM@shopsphere.test"
PASSWORD="Sm0kePass!${RANDOM}99"
if REG_JSON="$(curl -fsSL -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke User\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" 2>/dev/null)" \
  && REG_TOKEN="$(printf '%s' "${REG_JSON}" | json_field 'd => d.token')"; then
  pass "register (POST /api/auth/register)"
else
  fail "register (POST /api/auth/register)" "Could not register new customer"
fi

# 3. Login (/api/auth/login)
TOKEN=""
if LOGIN_JSON="$(curl -fsSL -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" 2>/dev/null)" \
  && TOKEN="$(printf '%s' "${LOGIN_JSON}" | json_field 'd => d.token')"; then
  pass "login (POST /api/auth/login)"
else
  fail "login (POST /api/auth/login)" "Could not log in as registered customer"
fi

# 4. Products (/api/products)
PRODUCT_ID=""
if PROD_JSON="$(curl -fsSL "${API_URL}/products" 2>/dev/null)" \
  && PRODUCT_ID="$(printf '%s' "${PROD_JSON}" | json_field 'd => d.items && d.items[0] && d.items[0].id')"; then
  pass "products (GET /api/products)"
else
  fail "products (GET /api/products)" "No products returned"
fi

# 5. Cart (/api/cart/items & /api/cart)
if [ -n "${TOKEN}" ] && [ -n "${PRODUCT_ID}" ] \
  && curl -fsSL -X POST "${API_URL}/cart/items" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"productId\":\"${PRODUCT_ID}\",\"quantity\":1}" >/dev/null 2>&1 \
  && CART_JSON="$(curl -fsSL "${API_URL}/cart" -H "Authorization: Bearer ${TOKEN}" 2>/dev/null)" \
  && [ "$(printf '%s' "${CART_JSON}" | json_field 'd => d.items && d.items.length')" -ge 1 ]; then
  pass "cart (POST /api/cart/items & GET /api/cart)"
else
  fail "cart (POST /api/cart/items & GET /api/cart)" "Could not add or fetch cart item"
fi

# 6. Order (POST /api/addresses & POST /api/orders)
if [ -n "${TOKEN}" ] \
  && ADDR_JSON="$(curl -fsSL -X POST "${API_URL}/addresses" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"recipient":"Smoke User","line1":"42 Cloud Way","city":"Chennai","state":"Tamil Nadu","postalCode":"600127","phone":"9876543210"}' 2>/dev/null)" \
  && ADDRESS_ID="$(printf '%s' "${ADDR_JSON}" | json_field 'd => d.id')" \
  && ORDER_JSON="$(curl -fsSL -X POST "${API_URL}/orders" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"addressId\":\"${ADDRESS_ID}\",\"paymentMethod\":\"COD\"}" 2>/dev/null)" \
  && ORDER_NUMBER="$(printf '%s' "${ORDER_JSON}" | json_field 'd => d.order && d.order.orderNumber')"; then
  pass "order (POST /api/addresses & POST /api/orders -> ${ORDER_NUMBER})"
else
  fail "order (POST /api/addresses & POST /api/orders)" "Could not create address or place order"
fi

echo "==> Summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
[ "${FAIL_COUNT}" -eq 0 ]
