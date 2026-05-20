/**
 * FUNCTIONAL TEST SUITE — Authentication
 *
 * Covers:
 *  - Super-admin login (success, failure, loading state)
 *  - Password visibility toggle
 *  - Error clearing on input
 *  - Forgot-password multi-step flow (forgot → OTP → reset → done)
 *  - Back navigation between forgot-password steps
 *  - Logout
 */
import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, SUPER_ADMIN } from "./helpers/auth.js";

test.describe("Auth — Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/admin/login");
  });

  test("login page renders title, email, password and submit", async ({ page }) => {
    await expect(page.locator(".sa-login-card__title")).toHaveText("Admin Portal");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator(".sa-login-form__submit")).toBeVisible();
  });

  test("password is masked by default and toggles to text", async ({ page }) => {
    await page.locator("#password").fill("secret");
    await expect(page.locator("#password")).toHaveAttribute("type", "password");
    await page.locator(".sa-login-form__eye").click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
    await page.locator(".sa-login-form__eye").click();
    await expect(page.locator("#password")).toHaveAttribute("type", "password");
  });

  test("invalid credentials shows error banner", async ({ page }) => {
    await page.locator("#email").fill("bad@bad.com");
    await page.locator("#password").fill("wrongpass");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__error")).toBeVisible({ timeout: 12_000 });
  });

  test("error banner clears when user starts typing", async ({ page }) => {
    await page.locator("#email").fill("bad@bad.com");
    await page.locator("#password").fill("wrongpass");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__error")).toBeVisible({ timeout: 12_000 });
    await page.locator("#email").fill("a");
    await expect(page.locator(".sa-login-card__error")).not.toBeVisible();
  });

  test("submit button disables while request is in flight", async ({ page }) => {
    await page.locator("#email").fill(SUPER_ADMIN.email);
    await page.locator("#password").fill(SUPER_ADMIN.password);
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-form__submit")).toBeDisabled();
  });

  test("valid super-admin credentials navigate to dashboard", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await expect(page.locator(".sa-overview__title")).toBeVisible();
  });
});

test.describe("Auth — Forgot Password flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/admin/login");
  });

  test("clicking Forgot password shows Reset Password view", async ({ page }) => {
    await page.locator(".sa-fp-trigger").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("Reset Password");
    await expect(page.locator("#fp-email")).toBeVisible();
  });

  test("email from login form is pre-filled in forgot view", async ({ page }) => {
    await page.locator("#email").fill("admin@test.com");
    await page.locator(".sa-fp-trigger").click();
    await expect(page.locator("#fp-email")).toHaveValue("admin@test.com");
  });

  test("back button from forgot view returns to login", async ({ page }) => {
    await page.locator(".sa-fp-trigger").click();
    await page.locator(".sa-login-card__back").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("Admin Portal");
  });

  test("empty email on forgot view shows validation error", async ({ page }) => {
    await page.locator(".sa-fp-trigger").click();
    await page.locator("#fp-email").clear();
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__error")).toBeVisible({ timeout: 5_000 });
  });

  test("unknown email shows API error on forgot view", async ({ page }) => {
    await page.locator(".sa-fp-trigger").click();
    await page.locator("#fp-email").fill("nonexistent@nowhere.com");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__error")).toBeVisible({ timeout: 12_000 });
  });

  test("mocked OTP send navigates to Enter OTP view", async ({ page }) => {
    await page.route("**/auth/otp/send", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    );
    await page.locator(".sa-fp-trigger").click();
    await page.locator("#fp-email").fill("admin@test.com");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("Enter OTP", { timeout: 8_000 });
  });

  test("empty OTP field shows error on OTP view", async ({ page }) => {
    await page.route("**/auth/otp/send", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    );
    await page.locator(".sa-fp-trigger").click();
    await page.locator("#fp-email").fill("admin@test.com");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("Enter OTP", { timeout: 8_000 });
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__error")).toBeVisible({ timeout: 5_000 });
  });

  test("mocked OTP verify navigates to New Password view", async ({ page }) => {
    await page.route("**/auth/otp/send", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    );
    await page.route("**/auth/otp/verify", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true, data: { verifyToken: "tok-123" } }) })
    );
    await page.locator(".sa-fp-trigger").click();
    await page.locator("#fp-email").fill("admin@test.com");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("Enter OTP", { timeout: 8_000 });
    await page.locator("#fp-otp").fill("123456");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("New Password", { timeout: 8_000 });
  });

  test("password mismatch shows error on reset view", async ({ page }) => {
    await page.route("**/auth/otp/send", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    );
    await page.route("**/auth/otp/verify", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true, data: { verifyToken: "tok-123" } }) })
    );
    await page.locator(".sa-fp-trigger").click();
    await page.locator("#fp-email").fill("admin@test.com");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("Enter OTP", { timeout: 8_000 });
    await page.locator("#fp-otp").fill("123456");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("New Password", { timeout: 8_000 });
    await page.locator("#fp-newpw").fill("Password1!");
    await page.locator("#fp-confirmpw").fill("Password2!");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__error")).toContainText(/match/i, { timeout: 5_000 });
  });

  test("password too short shows error on reset view", async ({ page }) => {
    await page.route("**/auth/otp/send", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    );
    await page.route("**/auth/otp/verify", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true, data: { verifyToken: "tok-123" } }) })
    );
    await page.locator(".sa-fp-trigger").click();
    await page.locator("#fp-email").fill("admin@test.com");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("Enter OTP", { timeout: 8_000 });
    await page.locator("#fp-otp").fill("123456");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("New Password", { timeout: 8_000 });
    await page.locator("#fp-newpw").fill("abc");
    await page.locator("#fp-confirmpw").fill("abc");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__error")).toContainText(/8/i, { timeout: 5_000 });
  });

  test("successful reset shows Password Reset done view", async ({ page }) => {
    await page.route("**/auth/otp/send", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    );
    await page.route("**/auth/otp/verify", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true, data: { verifyToken: "tok-123" } }) })
    );
    await page.route("**/auth/reset-password", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    );
    await page.locator(".sa-fp-trigger").click();
    await page.locator("#fp-email").fill("admin@test.com");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("Enter OTP", { timeout: 8_000 });
    await page.locator("#fp-otp").fill("123456");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("New Password", { timeout: 8_000 });
    await page.locator("#fp-newpw").fill("NewPass1!");
    await page.locator("#fp-confirmpw").fill("NewPass1!");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("Password Reset", { timeout: 8_000 });
    await expect(page.locator(".sa-fp-success-icon")).toBeVisible();
  });

  test("Back to Sign In from done view returns to login", async ({ page }) => {
    await page.route("**/auth/otp/send", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    );
    await page.route("**/auth/otp/verify", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true, data: { verifyToken: "tok-123" } }) })
    );
    await page.route("**/auth/reset-password", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    );
    await page.locator(".sa-fp-trigger").click();
    await page.locator("#fp-email").fill("admin@test.com");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("Enter OTP", { timeout: 8_000 });
    await page.locator("#fp-otp").fill("123456");
    await page.locator(".sa-login-form__submit").click();
    await page.locator("#fp-newpw").fill("NewPass1!");
    await page.locator("#fp-confirmpw").fill("NewPass1!");
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("Password Reset", { timeout: 8_000 });
    await page.locator(".sa-login-form__submit").click();
    await expect(page.locator(".sa-login-card__title")).toHaveText("Admin Portal");
  });
});

test.describe("Auth — Logout", () => {
  test("sign out redirects to admin login page", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.locator(".sa-navbar__logout").click();
    await expect(page).toHaveURL(/#\/admin\/login/, { timeout: 10_000 });
    await expect(page.locator(".sa-login-card__title")).toHaveText("Admin Portal");
  });
});
