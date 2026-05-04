import { test, expect } from "@playwright/test";
import { UserLoginPage } from "./UserLoginPage.js";

test.describe("User Login Page", () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new UserLoginPage(page);
    await loginPage.goto();
  });

  // ── Layout ─────────────────────────────────────────────────────────────

  test("renders branding and form elements", async () => {
    await expect(loginPage.brandLogo).toBeVisible();
    await expect(loginPage.cardTitle).toHaveText("Welcome back");
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.rememberMe).toBeVisible();
    await expect(loginPage.submitBtn).toBeVisible();
    await expect(loginPage.forgotBtn).toBeVisible();
    await expect(loginPage.superAdminLink).toBeVisible();
  });

  test("email field has correct placeholder and type", async () => {
    await expect(loginPage.emailInput).toHaveAttribute("type", "email");
    await expect(loginPage.emailInput).toHaveAttribute("placeholder", "admin@kinko.com");
  });

  test("password field is masked by default", async () => {
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  });

  // ── Interactions ───────────────────────────────────────────────────────

  test("typing in email updates the field", async () => {
    await loginPage.fillEmail("test@kinko.com");
    await expect(loginPage.emailInput).toHaveValue("test@kinko.com");
  });

  test("typing in password updates the field", async () => {
    await loginPage.fillPassword("secret123");
    await expect(loginPage.passwordInput).toHaveValue("secret123");
  });

  test("eye toggle reveals and hides password", async ({ page }) => {
    await loginPage.fillPassword("secret123");
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");

    await loginPage.togglePasswordVisibility();
    await expect(loginPage.passwordInput).toHaveAttribute("type", "text");

    await loginPage.togglePasswordVisibility();
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  });

  test("remember me checkbox toggles", async () => {
    await expect(loginPage.rememberMe).not.toBeChecked();
    await loginPage.checkRememberMe();
    await expect(loginPage.rememberMe).toBeChecked();
  });

  // ── Validation ─────────────────────────────────────────────────────────

  test("submit button is enabled when form is empty", async () => {
    // HTML5 validation prevents submission, but button itself stays enabled
    await expect(loginPage.submitBtn).toBeEnabled();
  });

  test("browser validates required email before submitting", async ({ page }) => {
    // Fill only password — browser should block form submit due to empty email
    await loginPage.fillPassword("somepassword");
    await loginPage.submit();
    // Page should not navigate away
    await expect(page).toHaveURL(/#\/login/);
  });

  // ── Error state ────────────────────────────────────────────────────────

  test("shows error alert for invalid credentials", async ({ page }) => {
    await loginPage.login("wrong@kinko.com", "wrongpassword");
    await expect(loginPage.errorAlert).toBeVisible({ timeout: 10_000 });
  });

  test("error clears when user starts typing", async ({ page }) => {
    await loginPage.login("wrong@kinko.com", "badpass");
    await expect(loginPage.errorAlert).toBeVisible({ timeout: 10_000 });

    await loginPage.fillEmail("new@kinko.com");
    await expect(loginPage.errorAlert).not.toBeVisible();
  });

  // ── Loading state ──────────────────────────────────────────────────────

  test("submit button shows loading text while request is in-flight", async ({ page }) => {
    await loginPage.fillEmail("user@kinko.com");
    await loginPage.fillPassword("password123");

    // Click and immediately check — the button should disable during the API call
    await loginPage.submitBtn.click();
    await expect(loginPage.submitBtn).toBeDisabled();
  });

  // ── Navigation ─────────────────────────────────────────────────────────

  test("Super Admin link navigates to /admin/login", async ({ page }) => {
    await loginPage.goToSuperAdminLogin();
    await expect(page).toHaveURL(/#\/admin\/login/);
  });
});
