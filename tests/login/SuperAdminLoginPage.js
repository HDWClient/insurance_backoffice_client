/**
 * Page Object for the super-admin login page (/#/admin/login).
 * Covers both the sign-in form and the multi-step forgot-password flow.
 */
export class SuperAdminLoginPage {
  constructor(page) {
    this.page = page;

    // ── Login view ──────────────────────────────────────────
    this.emailInput    = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.toggleEye     = page.locator('.sa-login-form__eye');
    this.submitBtn     = page.locator('.sa-login-form__submit');
    this.forgotBtn     = page.locator('.sa-fp-trigger');
    this.errorBanner   = page.locator('.sa-login-card__error');
    this.cardTitle     = page.locator('.sa-login-card__title');

    // ── Forgot — step 1: email ───────────────────────────────
    this.fpEmailInput = page.locator('#fp-email');
    this.sendOtpBtn   = page.locator('.sa-login-form__submit');
    this.backToLogin  = page.locator('.sa-login-card__back');

    // ── Forgot — step 2: OTP ─────────────────────────────────
    this.otpInput     = page.locator('#fp-otp');
    this.verifyOtpBtn = page.locator('.sa-login-form__submit');

    // ── Forgot — step 3: reset ───────────────────────────────
    this.newPwInput     = page.locator('#fp-newpw');
    this.confirmPwInput = page.locator('#fp-confirmpw');
    this.resetBtn       = page.locator('.sa-login-form__submit');

    // ── Done ─────────────────────────────────────────────────
    this.successIcon   = page.locator('.sa-fp-success-icon');
    this.backToSignIn  = page.locator('.sa-login-form__submit');
  }

  async goto() {
    await this.page.goto('/#/admin/login');
  }

  async fillEmail(email) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password) {
    await this.passwordInput.fill(password);
  }

  async togglePasswordVisibility() {
    await this.toggleEye.click();
  }

  async submit() {
    await this.submitBtn.click();
  }

  async login(email, password) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async clickForgotPassword() {
    await this.forgotBtn.click();
  }

  // Forgot flow helpers
  async sendOtp(email) {
    await this.fpEmailInput.fill(email);
    await this.sendOtpBtn.click();
  }

  async enterOtp(otp) {
    await this.otpInput.fill(otp);
    await this.verifyOtpBtn.click();
  }

  async resetPassword(newPw, confirmPw) {
    await this.newPwInput.fill(newPw);
    await this.confirmPwInput.fill(confirmPw);
    await this.resetBtn.click();
  }

  async goBackToLogin() {
    await this.backToLogin.click();
  }

  errorMessage() {
    return this.errorBanner;
  }
}
