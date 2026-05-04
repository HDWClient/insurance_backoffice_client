# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login/super-admin-login.spec.js >> Super Admin Login Page >> Forgot Password >> short password shows error on reset view
- Location: tests/login/super-admin-login.spec.js:170:5

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('.sa-login-card__title')
Expected: "New Password"
Received: "Enter OTP"
Timeout:  5000ms

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for locator('.sa-login-card__title')
    9 × locator resolved to <h1 class="sa-login-card__title">Enter OTP</h1>
      - unexpected value "Enter OTP"

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - img "Kinko" [ref=e6]
  - heading "Enter OTP" [level=1] [ref=e7]
  - paragraph [ref=e8]:
    - text: A 6-digit code was sent to
    - strong [ref=e9]: admin@hdw.in
    - text: . Enter it below.
  - generic [ref=e10]:
    - generic [ref=e11]: ⚠
    - text: Invalid or expired OTP. Try again.
  - generic [ref=e12]:
    - generic [ref=e13]:
      - generic [ref=e14]: One-Time Code
      - textbox "One-Time Code" [ref=e15]:
        - /placeholder: ••••••
        - text: "123456"
    - button "Verify OTP" [ref=e16] [cursor=pointer]
  - button "← Resend / change email" [ref=e17] [cursor=pointer]
```

# Test source

```ts
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
  171 |       await loginPage.clickForgotPassword();
  172 |       await loginPage.fpEmailInput.fill("admin@hdw.in");
  173 | 
  174 |       await page.route("**/auth/otp/send", async (route) => {
  175 |         await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  176 |       });
  177 |       await loginPage.sendOtpBtn.click();
  178 | 
  179 |       await page.route("**/auth/otp/verify", async (route) => {
  180 |         await route.fulfill({
  181 |           status: 200,
  182 |           body: JSON.stringify({ verifyToken: "mock-token-123" }),
  183 |         });
  184 |       });
  185 | 
  186 |       await loginPage.otpInput.fill("123456");
  187 |       await loginPage.verifyOtpBtn.click();
> 188 |       await expect(loginPage.cardTitle).toHaveText("New Password");
      |                                         ^ Error: expect(locator).toHaveText(expected) failed
  189 | 
  190 |       await loginPage.resetPassword("short", "short");
  191 |       await expect(loginPage.errorBanner).toContainText("at least 8 characters");
  192 |     });
  193 | 
  194 |     test("successful password reset shows done view", async ({ page }) => {
  195 |       await loginPage.clickForgotPassword();
  196 |       await loginPage.fpEmailInput.fill("admin@hdw.in");
  197 | 
  198 |       await page.route("**/auth/otp/send", async (route) => {
  199 |         await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  200 |       });
  201 |       await loginPage.sendOtpBtn.click();
  202 | 
  203 |       await page.route("**/auth/otp/verify", async (route) => {
  204 |         await route.fulfill({
  205 |           status: 200,
  206 |           body: JSON.stringify({ verifyToken: "mock-token-123" }),
  207 |         });
  208 |       });
  209 |       await loginPage.otpInput.fill("123456");
  210 |       await loginPage.verifyOtpBtn.click();
  211 | 
  212 |       await page.route("**/auth/reset-password", async (route) => {
  213 |         await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  214 |       });
  215 |       await loginPage.resetPassword("NewPassword1!", "NewPassword1!");
  216 | 
  217 |       await expect(loginPage.cardTitle).toHaveText("Password Reset");
  218 |       await expect(loginPage.successIcon).toBeVisible();
  219 |     });
  220 | 
  221 |     test("back to sign in from done view returns to login", async ({ page }) => {
  222 |       await loginPage.clickForgotPassword();
  223 |       await loginPage.fpEmailInput.fill("admin@hdw.in");
  224 | 
  225 |       await page.route("**/auth/otp/send", async (route) => {
  226 |         await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  227 |       });
  228 |       await loginPage.sendOtpBtn.click();
  229 | 
  230 |       await page.route("**/auth/otp/verify", async (route) => {
  231 |         await route.fulfill({
  232 |           status: 200,
  233 |           body: JSON.stringify({ verifyToken: "mock-token-123" }),
  234 |         });
  235 |       });
  236 |       await loginPage.otpInput.fill("123456");
  237 |       await loginPage.verifyOtpBtn.click();
  238 | 
  239 |       await page.route("**/auth/reset-password", async (route) => {
  240 |         await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  241 |       });
  242 |       await loginPage.resetPassword("NewPassword1!", "NewPassword1!");
  243 | 
  244 |       await expect(loginPage.cardTitle).toHaveText("Password Reset");
  245 |       await loginPage.backToSignIn.click();
  246 |       await expect(loginPage.cardTitle).toHaveText("Admin Portal");
  247 |     });
  248 |   });
  249 | });
  250 | 
```