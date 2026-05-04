# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login/super-admin-login.spec.js >> Super Admin Login Page >> submit button disables while loading
- Location: tests/login/super-admin-login.spec.js:66:3

# Error details

```
Error: expect(locator).toBeDisabled() failed

Locator:  locator('.sa-login-form__submit')
Expected: disabled
Received: enabled
Timeout:  5000ms

Call log:
  - Expect "toBeDisabled" with timeout 5000ms
  - waiting for locator('.sa-login-form__submit')
    9 × locator resolved to <button type="submit" class="sa-login-form__submit">Sign in</button>
      - unexpected value "enabled"

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - img "Kinko" [ref=e6]
  - heading "Admin Portal" [level=1] [ref=e7]
  - generic [ref=e8]:
    - generic [ref=e9]: ⚠
    - text: Invalid email or password.
  - generic [ref=e10]:
    - generic [ref=e11]:
      - generic [ref=e12]: Email
      - textbox "Email" [ref=e13]:
        - /placeholder: admin@hdw.in
        - text: admin@hdw.in
    - generic [ref=e14]:
      - generic [ref=e15]:
        - generic [ref=e16]: Password
        - button "Forgot password?" [ref=e17] [cursor=pointer]
      - generic [ref=e18]:
        - textbox "Password" [ref=e19]:
          - /placeholder: ••••••••
          - text: password123
        - button "👁️" [ref=e20] [cursor=pointer]
    - button "Sign in" [ref=e21] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { SuperAdminLoginPage } from "./SuperAdminLoginPage.js";
  3   | 
  4   | test.describe("Super Admin Login Page", () => {
  5   |   let loginPage;
  6   | 
  7   |   test.beforeEach(async ({ page }) => {
  8   |     loginPage = new SuperAdminLoginPage(page);
  9   |     await loginPage.goto();
  10  |   });
  11  | 
  12  |   // ── Layout ─────────────────────────────────────────────────────────────
  13  | 
  14  |   test("renders logo, title and form elements", async () => {
  15  |     await expect(loginPage.cardTitle).toHaveText("Admin Portal");
  16  |     await expect(loginPage.emailInput).toBeVisible();
  17  |     await expect(loginPage.passwordInput).toBeVisible();
  18  |     await expect(loginPage.submitBtn).toBeVisible();
  19  |     await expect(loginPage.forgotBtn).toBeVisible();
  20  |   });
  21  | 
  22  |   test("password field is masked by default", async () => {
  23  |     await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  24  |   });
  25  | 
  26  |   test("email field has correct placeholder", async () => {
  27  |     await expect(loginPage.emailInput).toHaveAttribute("placeholder", "admin@hdw.in");
  28  |   });
  29  | 
  30  |   // ── Interactions ───────────────────────────────────────────────────────
  31  | 
  32  |   test("eye toggle reveals and hides password", async () => {
  33  |     await loginPage.fillPassword("secret123");
  34  |     await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  35  | 
  36  |     await loginPage.togglePasswordVisibility();
  37  |     await expect(loginPage.passwordInput).toHaveAttribute("type", "text");
  38  | 
  39  |     await loginPage.togglePasswordVisibility();
  40  |     await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  41  |   });
  42  | 
  43  |   test("typing clears any visible error", async ({ page }) => {
  44  |     // Trigger an error first
  45  |     await loginPage.login("bad@hdw.in", "badpassword");
  46  |     await expect(loginPage.errorBanner).toBeVisible({ timeout: 10_000 });
  47  | 
  48  |     await loginPage.fillEmail("new@hdw.in");
  49  |     await expect(loginPage.errorBanner).not.toBeVisible();
  50  |   });
  51  | 
  52  |   // ── Validation ─────────────────────────────────────────────────────────
  53  | 
  54  |   test("browser validates required fields before submit", async ({ page }) => {
  55  |     await loginPage.submitBtn.click();
  56  |     await expect(page).toHaveURL(/#\/admin\/login/);
  57  |   });
  58  | 
  59  |   // ── Error state ────────────────────────────────────────────────────────
  60  | 
  61  |   test("shows error for invalid credentials", async ({ page }) => {
  62  |     await loginPage.login("wrong@hdw.in", "wrongpassword");
  63  |     await expect(loginPage.errorBanner).toBeVisible({ timeout: 10_000 });
  64  |   });
  65  | 
  66  |   test("submit button disables while loading", async () => {
  67  |     await loginPage.fillEmail("admin@hdw.in");
  68  |     await loginPage.fillPassword("password123");
  69  |     await loginPage.submitBtn.click();
> 70  |     await expect(loginPage.submitBtn).toBeDisabled();
      |                                       ^ Error: expect(locator).toBeDisabled() failed
  71  |   });
  72  | 
  73  |   // ── Forgot Password Flow ───────────────────────────────────────────────
  74  | 
  75  |   test.describe("Forgot Password", () => {
  76  |     test("clicking Forgot password switches to forgot view", async () => {
  77  |       await loginPage.clickForgotPassword();
  78  |       await expect(loginPage.cardTitle).toHaveText("Reset Password");
  79  |       await expect(loginPage.fpEmailInput).toBeVisible();
  80  |     });
  81  | 
  82  |     test("pre-fills email from login form into forgot view", async () => {
  83  |       await loginPage.fillEmail("admin@hdw.in");
  84  |       await loginPage.clickForgotPassword();
  85  |       await expect(loginPage.fpEmailInput).toHaveValue("admin@hdw.in");
  86  |     });
  87  | 
  88  |     test("back button returns to login view from forgot view", async () => {
  89  |       await loginPage.clickForgotPassword();
  90  |       await expect(loginPage.cardTitle).toHaveText("Reset Password");
  91  | 
  92  |       await loginPage.goBackToLogin();
  93  |       await expect(loginPage.cardTitle).toHaveText("Admin Portal");
  94  |     });
  95  | 
  96  |     test("empty email shows validation error in forgot view", async ({ page }) => {
  97  |       await loginPage.clickForgotPassword();
  98  |       // Clear the pre-filled email and submit
  99  |       await loginPage.fpEmailInput.clear();
  100 |       await loginPage.sendOtpBtn.click();
  101 |       await expect(loginPage.errorBanner).toBeVisible();
  102 |       await expect(loginPage.errorBanner).toContainText("Email is required");
  103 |     });
  104 | 
  105 |     test("invalid email shows API error in forgot view", async ({ page }) => {
  106 |       await loginPage.clickForgotPassword();
  107 |       await loginPage.sendOtp("nonexistent@hdw.in");
  108 |       await expect(loginPage.errorBanner).toBeVisible({ timeout: 10_000 });
  109 |     });
  110 | 
  111 |     test("OTP view shows correct email and back link", async ({ page }) => {
  112 |       // Use a known email that triggers OTP send — we only check the UI transition,
  113 |       // not the real OTP delivery, so we mock the network if needed in CI.
  114 |       // Here we verify the navigation to OTP step with a real API call.
  115 |       await loginPage.clickForgotPassword();
  116 |       await loginPage.fpEmailInput.fill("admin@hdw.in");
  117 | 
  118 |       // Intercept the OTP request to avoid waiting for actual delivery
  119 |       await page.route("**/auth/otp/send", async (route) => {
  120 |         await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  121 |       });
  122 | 
  123 |       await loginPage.sendOtpBtn.click();
  124 |       await expect(loginPage.cardTitle).toHaveText("Enter OTP");
  125 |     });
  126 | 
  127 |     test("empty OTP shows error on OTP view", async ({ page }) => {
  128 |       await loginPage.clickForgotPassword();
  129 |       await loginPage.fpEmailInput.fill("admin@hdw.in");
  130 | 
  131 |       await page.route("**/auth/otp/send", async (route) => {
  132 |         await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  133 |       });
  134 | 
  135 |       await loginPage.sendOtpBtn.click();
  136 |       await expect(loginPage.cardTitle).toHaveText("Enter OTP");
  137 | 
  138 |       // Submit without entering OTP
  139 |       await loginPage.verifyOtpBtn.click();
  140 |       await expect(loginPage.errorBanner).toContainText("Enter the OTP");
  141 |     });
  142 | 
  143 |     test("password mismatch shows error on reset view", async ({ page }) => {
  144 |       // Navigate directly to reset view by mocking both API calls
  145 |       await loginPage.clickForgotPassword();
  146 |       await loginPage.fpEmailInput.fill("admin@hdw.in");
  147 | 
  148 |       await page.route("**/auth/otp/send", async (route) => {
  149 |         await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  150 |       });
  151 |       await loginPage.sendOtpBtn.click();
  152 |       await expect(loginPage.cardTitle).toHaveText("Enter OTP");
  153 | 
  154 |       await page.route("**/auth/otp/verify", async (route) => {
  155 |         await route.fulfill({
  156 |           status: 200,
  157 |           body: JSON.stringify({ verifyToken: "mock-token-123" }),
  158 |         });
  159 |       });
  160 | 
  161 |       await loginPage.otpInput.fill("123456");
  162 |       await loginPage.verifyOtpBtn.click();
  163 |       await expect(loginPage.cardTitle).toHaveText("New Password");
  164 | 
  165 |       // Now enter mismatched passwords
  166 |       await loginPage.resetPassword("Password1!", "Password2!");
  167 |       await expect(loginPage.errorBanner).toContainText("do not match");
  168 |     });
  169 | 
  170 |     test("short password shows error on reset view", async ({ page }) => {
```