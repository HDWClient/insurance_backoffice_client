/**
 * Page Object for the regular-user login page (/#/login).
 * Encapsulates all selectors and actions so specs stay declarative.
 */
export class UserLoginPage {
  constructor(page) {
    this.page = page;

    // Fields
    this.emailInput     = page.locator('#email');
    this.passwordInput  = page.locator('#password');
    this.rememberMe     = page.locator('#remember-me');
    this.toggleEye      = page.locator('.kl-field__eye');
    this.submitBtn      = page.locator('button[type="submit"]');
    this.forgotBtn      = page.locator('.kl-field__forgot-link');
    this.superAdminLink = page.locator('.kl-sa-link');
    this.errorAlert     = page.locator('[role="alert"]');

    // Branding
    this.brandLogo  = page.locator('.kl-brand__logo');
    this.cardTitle  = page.locator('.kl-card__heading');
  }

  async goto() {
    await this.page.goto('/#/login');
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

  async checkRememberMe() {
    await this.rememberMe.check();
  }

  async submit() {
    await this.submitBtn.click();
  }

  async login(email, password) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async goToSuperAdminLogin() {
    await this.superAdminLink.click();
  }

  errorMessage() {
    return this.errorAlert;
  }
}
