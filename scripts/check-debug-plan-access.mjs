import assert from "node:assert/strict";

function printUsage() {
  console.error("Usage: node scripts/check-debug-plan-access.mjs <production|development> [baseUrl]");
  console.error("Example: node scripts/check-debug-plan-access.mjs production http://127.0.0.1:3000");
}

const expectedEnv = (process.argv[2] || "").toLowerCase();
const baseUrl = process.argv[3] || "http://127.0.0.1:3000";

if (!["production", "development"].includes(expectedEnv)) {
  printUsage();
  process.exit(1);
}

const url = `${baseUrl.replace(/\/+$/, "")}/api/debug/plan`;

try {
  const response = await fetch(url);
  const body = await response.text();

  if (expectedEnv === "production") {
    assert.equal(response.status, 404, `Expected 404 in production, got ${response.status}`);

    const leakedTokens = ["no_session", "\"plan\"", "profileExists", "\"uid\""];
    const leakedToken = leakedTokens.find((token) => body.includes(token));
    assert.equal(
      leakedToken,
      undefined,
      `Production response leaked debug details (${leakedToken}) at ${url}`,
    );

    console.log(`OK: ${url} returns 404 without debug details in production.`);
  } else {
    assert.equal(response.status, 200, `Expected 200 in development, got ${response.status}`);
    console.log(`OK: ${url} returns 200 in development.`);
  }
} catch (error) {
  console.error(`Failed check for ${url}:`, error.message);
  process.exit(1);
}
