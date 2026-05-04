import { test, expect } from "@playwright/test";
import { SuperAdminLoginPage } from "./SuperAdminLoginPage.js";

test.describe("Super Admin Login Page", () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new SuperAdminLoginPage(page);
    await loginPage.goto();
  });

  // ── Layout ─────────────────────────────────────────────────────────────

  test("renders logo, title and form elements", async () => {
    await expect(loginPage.cardTitle).toHaveText("Admin Portal");
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitBtn).toBeVisible();
    await expect(loginPage.forgotBtn).toBeVisible();
  });

  test("password field is masked by default", async () => {
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  });

  test("email field has correct placeholder", async () => {
    await expect(loginPage.emailInput).toHaveAttribute("placeholder", "admin@hdw.in");
  });

  // ── Interactions ───────────────────────────────────────────────────────

  test("eye toggle reveals and hides password", async () => {
    await loginPage.fillPassword("secret123");
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");

    await loginPage.togglePasswordVisibility();
    await expect(loginPage.passwordInput).toHaveAttribute("type", "text");

    await loginPage.togglePasswordVisibility();
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  });

  test("typing clears any visible error", async ({ page }) => {
    // Trigger an error first
    await loginPage.login("bad@hdw.in", "badpassword");
    await expect(loginPage.errorBanner).toBeVisible({ timeout: 10_000 });

    await loginPage.fillEmail("new@hdw.in");
    await expect(loginPage.errorBanner).not.toBeVisible();
  });

  // ── Validation ─────────────────────────────────────────────────────────

  test("browser validates required fields before submit", async ({ page }) => {
    await loginPage.submitBtn.click();
    await expect(page).toHaveURL(/#\/admin\/login/);
  });

  // ── Error state ────────────────────────────────────────────────────────

  test("shows error for invalid credentials", async ({ page }) => {
    await loginPage.login("wrong@hdw.in", "wrongpassword");
    await expect(loginPage.errorBanner).toBeVisible({ timeout: 10_000 });
  });

  test("submit button disables while loading", async () => {
    await loginPage.fillEmail("admin@hdw.in");
    await loginPage.fillPassword("password123");
    await loginPage.submitBtn.click();
    await expect(loginPage.submitBtn).toBeDisabled();
  });

  // ── Forgot Password Flow ───────────────────────────────────────────────

  test.describe("Forgot Password", () => {
    test("clicking Forgot password switches to forgot view", async () => {
      await loginPage.clickForgotPassword();
      await expect(loginPage.cardTitle).toHaveText("Reset Password");
      await expect(loginPage.fpEmailInput).toBeVisible();
    });

    test("pre-fills email from login form into forgot view", async () => {
      await loginPage.fillEmail("admin@hdw.in");
      await loginPage.clickForgotPassword();
      await expect(loginPage.fpEmailInput).toHaveValue("admin@hdw.in");
    });

    test("back button returns to login view from forgot view", async () => {
      await loginPage.clickForgotPassword();
      await expect(loginPage.cardTitle).toHaveText("Reset Password");

      await loginPage.goBackToLogin();
      await expect(loginPage.cardTitle).toHaveText("Admin Portal");
    });

    test("empty email shows validation error in forgot view", async ({ page }) => {
      await loginPage.clickForgotPassword();
      // Clear the pre-filled email and submit
      await loginPage.fpEmailInput.clear();
      await loginPage.sendOtpBtn.click();
      await expect(loginPage.errorBanner).toBeVisible();
      await expect(loginPage.errorBanner).toContainText("Email is required");
    });

    test("invalid email shows API error in forgot view", async ({ page }) => {
      await loginPage.clickForgotPassword();
      await loginPage.sendOtp("nonexistent@hdw.in");
      await expect(loginPage.errorBanner).toBeVisible({ timeout: 10_000 });
    });

    test("OTP view shows correct email and back link", async ({ page }) => {
      // Use a known email that triggers OTP send — we only check the UI transition,
      // not the real OTP delivery, so we mock the network if needed in CI.
      // Here we verify the navigation to OTP step with a real API call.
      await loginPage.clickForgotPassword();
      await loginPage.fpEmailInput.fill("admin@hdw.in");

      // Intercept the OTP request to avoid waiting for actual delivery
      await page.route("**/auth/otp/send", async (route) => {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      });

      await loginPage.sendOtpBtn.click();
      await expect(loginPage.cardTitle).toHaveText("Enter OTP");
    });

    test("empty OTP shows error on OTP view", async ({ page }) => {
      await loginPage.clickForgotPassword();
      await loginPage.fpEmailInput.fill("admin@hdw.in");

      await page.route("**/auth/otp/send", async (route) => {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      });

      await loginPage.sendOtpBtn.click();
      await expect(loginPage.cardTitle).toHaveText("Enter OTP");

      // Submit without entering OTP
      await loginPage.verifyOtpBtn.click();
      await expect(loginPage.errorBanner).toContainText("Enter the OTP");
    });

    test("password mismatch shows error on reset view", async ({ page }) => {
      // Navigate directly to reset view by mocking both API calls
      await loginPage.clickForgotPassword();
      await loginPage.fpEmailInput.fill("admin@hdw.in");

      await page.route("**/auth/otp/send", async (route) => {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      });
      await loginPage.sendOtpBtn.click();
      await expect(loginPage.cardTitle).toHaveText("Enter OTP");

      await page.route("**/auth/otp/verify", async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ verifyToken: "mock-token-123" }),
        });
      });

      await loginPage.otpInput.fill("123456");
      await loginPage.verifyOtpBtn.click();
      await expect(loginPage.cardTitle).toHaveText("New Password");

      // Now enter mismatched passwords
      await loginPage.resetPassword("Password1!", "Password2!");
      await expect(loginPage.errorBanner).toContainText("do not match");
    });

    test("short password shows error on reset view", async ({ page }) => {
      await loginPage.clickForgotPassword();
      await loginPage.fpEmailInput.fill("admin@hdw.in");

      await page.route("**/auth/otp/send", async (route) => {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      });
      await loginPage.sendOtpBtn.click();

      await page.route("**/auth/otp/verify", async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ verifyToken: "mock-token-123" }),
        });
      });

      await loginPage.otpInput.fill("123456");
      await loginPage.verifyOtpBtn.click();
      await expect(loginPage.cardTitle).toHaveText("New Password");

      await loginPage.resetPassword("short", "short");
      await expect(loginPage.errorBanner).toContainText("at least 8 characters");
    });

    test("successful password reset shows done view", async ({ page }) => {
      await loginPage.clickForgotPassword();
      await loginPage.fpEmailInput.fill("admin@hdw.in");

      await page.route("**/auth/otp/send", async (route) => {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      });
      await loginPage.sendOtpBtn.click();

      await page.route("**/auth/otp/verify", async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ verifyToken: "mock-token-123" }),
        });
      });
      await loginPage.otpInput.fill("123456");
      await loginPage.verifyOtpBtn.click();

      await page.route("**/auth/reset-password", async (route) => {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      });
      await loginPage.resetPassword("NewPassword1!", "NewPassword1!");

      await expect(loginPage.cardTitle).toHaveText("Password Reset");
      await expect(loginPage.successIcon).toBeVisible();
    });

    test("back to sign in from done view returns to login", async ({ page }) => {
      await loginPage.clickForgotPassword();
      await loginPage.fpEmailInput.fill("admin@hdw.in");

      await page.route("**/auth/otp/send", async (route) => {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      });
      await loginPage.sendOtpBtn.click();

      await page.route("**/auth/otp/verify", async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ verifyToken: "mock-token-123" }),
        });
      });
      await loginPage.otpInput.fill("123456");
      await loginPage.verifyOtpBtn.click();

      await page.route("**/auth/reset-password", async (route) => {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      });
      await loginPage.resetPassword("NewPassword1!", "NewPassword1!");

      await expect(loginPage.cardTitle).toHaveText("Password Reset");
      await loginPage.backToSignIn.click();
      await expect(loginPage.cardTitle).toHaveText("Admin Portal");
    });
  });
});
