import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginAsync, clearError } from "../../store/slices/loginSlice";
import { fetchOrgs } from "../../store/slices/orgSlice";
import { useApp } from "../../context/AppContext";
import kinkoLogo1 from "../../assets/kinkologo1.png";
import "./styles.css";

const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_DISABLED:    "Account is disabled — contact your admin.",
  EMAIL_NOT_VERIFIED:  "Email not verified — check your inbox.",
};

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error, errorCode } = useSelector((s) => s.login);
  const { loginSuperAdmin, setSessionFromApi, switchOrg } = useApp();

  const [form, setForm]               = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const handleChange = (e) => {
    dispatch(clearError());
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(loginAsync({ email: form.email, password: form.password }));
    if (!loginAsync.fulfilled.match(result)) return;

    const payload = result.payload;
    setSessionFromApi(payload);
    loginSuperAdmin();

    // If the login response has no org context (super admin with no currentOrgId),
    // fetch the org list and set the first available org as X-ORG-ID.
    // Without this the /me/permissions call returns INVALID_ORG_CONTEXT.
    if (!payload.activeOrg?.id) {
      const orgsResult = await dispatch(fetchOrgs());
      if (fetchOrgs.fulfilled.match(orgsResult) && orgsResult.payload?.length > 0) {
        const list = orgsResult.payload;
        // Prefer the default org (Kinco / isDefault: true), fall back to first
        const defaultOrg = list.find((o) => o.isDefault) ?? list[0];
        switchOrg(defaultOrg);
      }
    }

    navigate("/admin/dashboard");
  };

  const errorMsg = ERROR_MESSAGES[errorCode] || error || "";

  return (
    <div className="sa-login-page">
      <div className="sa-login-card">
        <div className="sa-login-card__top">
          <img src={kinkoLogo1} alt="Kinko" className="sa-login-card__logo" />
        </div>

        <h1 className="sa-login-card__title">Admin Portal</h1>

        {errorMsg && (
          <div className="sa-login-card__error">
            <span>⚠</span> {errorMsg}
          </div>
        )}

        <form className="sa-login-form" onSubmit={handleSubmit} noValidate>
          <div className="sa-login-form__field">
            <label htmlFor="email" className="sa-login-form__label">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required
              value={form.email} onChange={handleChange}
              className="sa-login-form__input" placeholder="admin@hdw.in" />
          </div>

          <div className="sa-login-form__field">
            <label htmlFor="password" className="sa-login-form__label">Password</label>
            <div className="sa-login-form__input-wrap">
              <input id="password" name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password" required
                value={form.password} onChange={handleChange}
                className="sa-login-form__input" placeholder="••••••••" />
              <button type="button" className="sa-login-form__eye"
                onClick={() => setShowPassword((p) => !p)} tabIndex={-1}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button type="submit" className="sa-login-form__submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
