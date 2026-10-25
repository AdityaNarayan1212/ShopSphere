/**
 * ShopSphere k6 Load Test
 *
 * Profile:
 *   - 10 Virtual Users (VUs) for 60 seconds
 *   - Targets: GET /api/products and GET /api/health
 *   - Thresholds:
 *       * 95th percentile response time (http_req_duration p(95)) < 500ms
 *       * HTTP error rate (http_req_failed) < 1%
 *
 * How to run:
 *   1. Install k6 (https://grafana.com/docs/k6/latest/set-up/install-k6/):
 *        - Windows (winget): winget install k6 --source winget
 *        - Ubuntu/Debian:    sudo snap install k6
 *        - Docker:           docker run --rm -i grafana/k6 run - < loadtest/k6.js
 *
 *   2. Run against local server:
 *        k6 run loadtest/k6.js
 *
 *   3. Run against deployed CloudFront/EC2 URL:
 *        k6 run -e BASE_URL=https://PLACEHOLDER_CLOUDFRONT_DOMAIN.cloudfront.net loadtest/k6.js
 */

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:4000").replace(/\/+$/, "");

export const options = {
  vus: 10,
  duration: "60s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"]
  }
};

export default function () {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    "GET /api/health status is 200": (r) => r.status === 200
  });

  const productsRes = http.get(`${BASE_URL}/api/products`);
  check(productsRes, {
    "GET /api/products status is 200": (r) => r.status === 200
  });

  sleep(1);
}
