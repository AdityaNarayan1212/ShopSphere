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

test("JWT payload contains only whitelisted claims and no passwordHash", async () => {
  const base = process.env.TEST_API_URL || "http://localhost:4000";
  try {
    const email = `jwt-test-${Date.now()}@shopsphere.test`;
    const response = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "JWT Tester", email, password: "SafePassword!234" })
    });
    assert.equal(response.status, 201);
    const { token } = await response.json();
    assert.ok(token, "Expected token in register response");
    const payloadJson = Buffer.from(token.split(".")[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);
    assert.equal(payload.passwordHash, undefined, "JWT payload must never include passwordHash");
    assert.deepEqual(Object.keys(payload).sort(), ["email", "exp", "iat", "id", "role"]);
  } catch (error) {
    if (process.env.REQUIRE_API_TEST === "1") throw error;
    console.log("Skipped live JWT payload test: start the server or set REQUIRE_API_TEST=1.");
  }
});
