# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login/user-login.spec.js >> User Login Page >> email field has correct placeholder and type
- Location: tests/login/user-login.spec.js:25:3

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('#email')
Expected: "admin@kinko.com"
Received: "admin@hdw.in"
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for locator('#email')
    9 × locator resolved to <input value="" id="email" required="" type="email" name="email" autocomplete="email" placeholder="admin@hdw.in" class="sa-login-form__input"/>
      - unexpected value "admin@hdw.in"

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - img "Kinko" [ref=e6]
  - heading "Admin Portal" [level=1] [ref=e7]
  - generic [ref=e8]:
    - generic [ref=e9]:
      - generic [ref=e10]: Email
      - textbox "Email" [ref=e11]:
        - /placeholder: admin@hdw.in
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: Password
        - button "Forgot password?" [ref=e15] [cursor=pointer]
      - generic [ref=e16]:
        - textbox "Password" [ref=e17]:
          - /placeholder: ••••••••
        - button "👁️" [ref=e18] [cursor=pointer]
    - button "Sign in" [ref=e19] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { UserLoginPage } from "./UserLoginPage.js";
  3   | 
  4   | test.describe("User Login Page", () => {
  5   |   let loginPage;
  6   | 
  7   |   test.beforeEach(async ({ page }) => {
  8   |     loginPage = new UserLoginPage(page);
  9   |     await loginPage.goto();
  10  |   });
  11  | 
  12  |   // ── Layout ─────────────────────────────────────────────────────────────
  13  | 
  14  |   test("renders branding and form elements", async () => {
  15  |     await expect(loginPage.brandLogo).toBeVisible();
  16  |     await expect(loginPage.cardTitle).toHaveText("Welcome back");
  17  |     await expect(loginPage.emailInput).toBeVisible();
  18  |     await expect(loginPage.passwordInput).toBeVisible();
  19  |     await expect(loginPage.rememberMe).toBeVisible();
  20  |     await expect(loginPage.submitBtn).toBeVisible();
  21  |     await expect(loginPage.forgotBtn).toBeVisible();
  22  |     await expect(loginPage.superAdminLink).toBeVisible();
  23  |   });
  24  | 
  25  |   test("email field has correct placeholder and type", async () => {
  26  |     await expect(loginPage.emailInput).toHaveAttribute("type", "email");
> 27  |     await expect(loginPage.emailInput).toHaveAttribute("placeholder", "admin@kinko.com");
      |                                        ^ Error: expect(locator).toHaveAttribute(expected) failed
  28  |   });
  29  | 
  30  |   test("password field is masked by default", async () => {
  31  |     await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  32  |   });
  33  | 
  34  |   // ── Interactions ───────────────────────────────────────────────────────
  35  | 
  36  |   test("typing in email updates the field", async () => {
  37  |     await loginPage.fillEmail("test@kinko.com");
  38  |     await expect(loginPage.emailInput).toHaveValue("test@kinko.com");
  39  |   });
  40  | 
  41  |   test("typing in password updates the field", async () => {
  42  |     await loginPage.fillPassword("secret123");
  43  |     await expect(loginPage.passwordInput).toHaveValue("secret123");
  44  |   });
  45  | 
  46  |   test("eye toggle reveals and hides password", async ({ page }) => {
  47  |     await loginPage.fillPassword("secret123");
  48  |     await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  49  | 
  50  |     await loginPage.togglePasswordVisibility();
  51  |     await expect(loginPage.passwordInput).toHaveAttribute("type", "text");
  52  | 
  53  |     await loginPage.togglePasswordVisibility();
  54  |     await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  55  |   });
  56  | 
  57  |   test("remember me checkbox toggles", async () => {
  58  |     await expect(loginPage.rememberMe).not.toBeChecked();
  59  |     await loginPage.checkRememberMe();
  60  |     await expect(loginPage.rememberMe).toBeChecked();
  61  |   });
  62  | 
  63  |   // ── Validation ─────────────────────────────────────────────────────────
  64  | 
  65  |   test("submit button is enabled when form is empty", async () => {
  66  |     // HTML5 validation prevents submission, but button itself stays enabled
  67  |     await expect(loginPage.submitBtn).toBeEnabled();
  68  |   });
  69  | 
  70  |   test("browser validates required email before submitting", async ({ page }) => {
  71  |     // Fill only password — browser should block form submit due to empty email
  72  |     await loginPage.fillPassword("somepassword");
  73  |     await loginPage.submit();
  74  |     // Page should not navigate away
  75  |     await expect(page).toHaveURL(/#\/login/);
  76  |   });
  77  | 
  78  |   // ── Error state ────────────────────────────────────────────────────────
  79  | 
  80  |   test("shows error alert for invalid credentials", async ({ page }) => {
  81  |     await loginPage.login("wrong@kinko.com", "wrongpassword");
  82  |     await expect(loginPage.errorAlert).toBeVisible({ timeout: 10_000 });
  83  |   });
  84  | 
  85  |   test("error clears when user starts typing", async ({ page }) => {
  86  |     await loginPage.login("wrong@kinko.com", "badpass");
  87  |     await expect(loginPage.errorAlert).toBeVisible({ timeout: 10_000 });
  88  | 
  89  |     await loginPage.fillEmail("new@kinko.com");
  90  |     await expect(loginPage.errorAlert).not.toBeVisible();
  91  |   });
  92  | 
  93  |   // ── Loading state ──────────────────────────────────────────────────────
  94  | 
  95  |   test("submit button shows loading text while request is in-flight", async ({ page }) => {
  96  |     await loginPage.fillEmail("user@kinko.com");
  97  |     await loginPage.fillPassword("password123");
  98  | 
  99  |     // Click and immediately check — the button should disable during the API call
  100 |     await loginPage.submitBtn.click();
  101 |     await expect(loginPage.submitBtn).toBeDisabled();
  102 |   });
  103 | 
  104 |   // ── Navigation ─────────────────────────────────────────────────────────
  105 | 
  106 |   test("Super Admin link navigates to /admin/login", async ({ page }) => {
  107 |     await loginPage.goToSuperAdminLogin();
  108 |     await expect(page).toHaveURL(/#\/admin\/login/);
  109 |   });
  110 | });
  111 | 
```