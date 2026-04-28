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
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const { loading, error, errorCode } = useSelector((s) => s.login);
  const { setSessionFromApi, loginSuperAdmin } = useApp();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="ul-page">
      <div className="ul-card">
        <div className="ul-card__top">
          <span className="ul-card__icon">🛡️</span>
          <span className="ul-card__title">InsureHub</span>
        </div>

        <h1 className="ul-card__heading">Sign in</h1>
        <p className="ul-card__sub">Use the credentials provided by your administrator</p>

        {errorMsg && (
          <div className="ul-card__error">
            <span>⚠</span> {errorMsg}
          </div>
        )}

        <form className="ul-form" onSubmit={handleSubmit} noValidate>
          <div className="ul-form__field">
            <label htmlFor="email" className="ul-form__label">Email</label>
            <input id="email" name="email" type="email"
              autoComplete="email" required
              value={form.email} onChange={handleChange}
              className="ul-form__input" placeholder="you@example.com" />
          </div>

          <div className="ul-form__field">
            <label htmlFor="password" className="ul-form__label">Password</label>
            <div className="ul-form__input-wrap">
              <input id="password" name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password" required
                value={form.password} onChange={handleChange}
                className="ul-form__input" placeholder="••••••••" />
              <button type="button" className="ul-form__eye"
                onClick={() => setShowPassword((p) => !p)} tabIndex={-1}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button type="submit" className="ul-form__submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <button className="ul-card__sa-link" onClick={() => navigate("/admin/login")}>
          Super Admin? Login here →
        </button>
      </div>
    </div>
  );
}
