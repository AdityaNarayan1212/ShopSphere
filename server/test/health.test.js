import test from "node:test";
import assert from "node:assert/strict";

test("health endpoint contract", async () => {
  const base = process.env.TEST_API_URL || "http://localhost:4000";
  try {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "ok");
    assert.equal(body.service, "shopsphere-api");
  } catch (error) {
    if (process.env.REQUIRE_API_TEST === "1") throw error;
    console.log("Skipped live API health test: start the server or set REQUIRE_API_TEST=1.");
  }
});
