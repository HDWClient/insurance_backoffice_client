import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginAsync, clearError } from "../../store/slices/loginSlice";
import { useApp } from "../../context/AppContext";
import "./styles.css";

const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_DISABLED: "Account is disabled — contact your admin.",
  EMAIL_NOT_VERIFIED: "Email not verified — check your inbox.",
};

export default function UserLogin() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error, errorCode } = useSelector((s) => s.login);
  const { setSessionFromApi, loginSuperAdmin } = useApp();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const handleChange = (e) => {
    dispatch(clearError());
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(loginAsync({ email: form.email, password: form.password }));
    if (loginAsync.fulfilled.match(result)) {
      const payload = result.payload;
      setSessionFromApi(payload);
      if (payload.isSuperAdmin) {
        loginSuperAdmin();
        navigate("/admin/dashboard");
      } else {
        navigate("/dashboard");
      }
    }
  };

  const errorMsg = ERROR_MESSAGES[errorCode] || error || "";

  return (
    <div className="kl-root">

      {/* ── Left Panel: Branding & Messaging ── */}
      <div className="kl-brand">
        <div className="kl-brand__gradient-overlay" />

        {/* Logo */}
        <div className="kl-brand__logo">
          <span className="kl-brand__logo-k">K</span>
          <span className="kl-brand__logo-i">i</span>
          <span className="kl-brand__logo-nko">nko</span>
        </div>

        {/* Hero */}
        <div className="kl-brand__hero">
          <h1 className="kl-brand__headline">
            Protecting What <br /> Matters Most
          </h1>
          <p className="kl-brand__sub">
            Insurance backoffice portal for administrators and agents.
          </p>
        </div>

        {/* Bottom fade */}
        <div className="kl-brand__bottom-fade" />
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="kl-panel">

        {/* Mobile logo */}
        <div className="kl-mobile-logo">
          <span className="kl-mobile-logo__k">K</span>
          <span className="kl-mobile-logo__i">i</span>
          <span className="kl-mobile-logo__nko">nko</span>
        </div>

        {/* Login Card */}
        <div className="kl-card">

          {/* Header */}
          <div className="kl-card__header">
            <h2 className="kl-card__heading">Welcome back</h2>
            <p className="kl-card__sub">Sign in to your account</p>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="kl-error" role="alert">
              <span className="material-symbols-outlined kl-error__icon">warning</span>
              {errorMsg}
            </div>
          )}

          <form className="kl-form" onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div className="kl-field">
              <label className="kl-field__label" htmlFor="email">Email Address</label>
              <div className="kl-field__wrap">
                <div className="kl-field__icon-wrap">
                  <span className="material-symbols-outlined kl-field__icon">mail</span>
                </div>
                <input
                  id="email" name="email" type="email"
                  autoComplete="email" required
                  value={form.email} onChange={handleChange}
                  className="kl-field__input" placeholder="admin@kinko.com"
                />
              </div>
            </div>

            {/* Password */}
            <div className="kl-field">
              <label className="kl-field__label" htmlFor="password">Password</label>
              <div className="kl-field__wrap">
                <div className="kl-field__icon-wrap">
                  <span className="material-symbols-outlined kl-field__icon">lock</span>
                </div>
                <input
                  id="password" name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password" required
                  value={form.password} onChange={handleChange}
                  className="kl-field__input kl-field__input--pw" placeholder="••••••••"
                />
                <div className="kl-field__eye-wrap">
                  <button
                    type="button"
                    className="kl-field__eye"
                    onClick={() => setShowPassword((p) => !p)}
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>
              <div className="kl-field__forgot">
                <a href="#" className="kl-field__forgot-link" tabIndex={-1}>Forgot password?</a>
              </div>
            </div>

            {/* Remember me */}
            <div className="kl-remember">
              <input
                id="remember-me" name="remember-me" type="checkbox"
                className="kl-remember__checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember-me" className="kl-remember__label">Remember me</label>
            </div>

            {/* Submit */}
            <div className="kl-submit-wrap">
              <button type="submit" className="kl-submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </div>

          </form>

          {/* Super Admin */}
          <div className="kl-sa-wrap">
            <button
              type="button"
              className="kl-sa-link"
              onClick={() => navigate("/admin/login")}
            >
              Super Admin? Login here
              <span className="material-symbols-outlined kl-sa-link__arrow">arrow_forward</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
