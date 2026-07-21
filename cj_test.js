/**
 * CJ Dropshipping API - quick auth test
 *
 * Usage:
 *   export CJ_API_KEY="your-key-here"
 *   node cj_test.js
 *
 * Never paste your key directly into this file or into chat —
 * keep it in an environment variable so it doesn't end up in
 * logs, git history, or anywhere else it shouldn't be.
 */

const CJ_API_KEY = process.env.CJ_API_KEY;
const CJ_EMAIL = process.env.CJ_EMAIL; // CJ auth also typically needs the account email

if (!CJ_API_KEY || !CJ_EMAIL) {
  console.error("Missing CJ_API_KEY or CJ_EMAIL environment variable.");
  console.error('Set them with: export CJ_API_KEY="..." export CJ_EMAIL="..."');
  process.exit(1);
}

const BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

async function getAccessToken() {
  const res = await fetch(`${BASE_URL}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: CJ_EMAIL,
      password: CJ_API_KEY, // CJ calls this field "password" but it's your API key
    }),
  });

  const data = await res.json();

  if (!res.ok || data.result === false) {
    console.error("Auth failed:", data.message || res.statusText);
    process.exit(1);
  }

  console.log("Auth succeeded.");
  console.log("Access token (first 8 chars):", data.data.accessToken.slice(0, 8) + "...");
  console.log("Expires:", data.data.accessTokenExpiryDate);
  return data.data.accessToken;
}

getAccessToken().catch((err) => {
  console.error("Request error:", err.message);
  process.exit(1);
});
