import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginAsync, clearError } from "../../store/slices/loginSlice";
import { fetchOrgs } from "../../store/slices/orgSlice";
import { useApp } from "../../context/AppContext";
import { sendOtp, verifyOtp, resetPassword } from "../../services/authService";
import kinkoLogo1 from "../../assets/kinkologo1.png";
import "./styles.css";

const LOGIN_ERRORS = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_DISABLED:    "Account is disabled — contact your admin.",
  EMAIL_NOT_VERIFIED:  "Email not verified — check your inbox.",
};

// ── view states: "login" | "forgot" | "otp" | "reset" | "done"

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error, errorCode } = useSelector((s) => s.login);
  const { loginSuperAdmin, setSessionFromApi, switchOrg } = useApp();

  // Login form
  const [form, setForm]               = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password flow
  const [view, setView]               = useState("login");
  const [fpEmail, setFpEmail]         = useState("");
  const [fpOtp, setFpOtp]             = useState("");
  const [fpVerifyToken, setFpVerifyToken] = useState("");
  const [fpNewPw, setFpNewPw]         = useState("");
  const [fpConfirmPw, setFpConfirmPw] = useState("");
  const [showNewPw, setShowNewPw]     = useState(false);
  const [fpLoading, setFpLoading]     = useState(false);
  const [fpError, setFpError]         = useState("");
  const [fpSuccess, setFpSuccess]     = useState("");

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  // ── Login ─────────────────────────────────────────────────
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

    if (!payload.activeOrg?.id) {
      const orgsResult = await dispatch(fetchOrgs());
      if (fetchOrgs.fulfilled.match(orgsResult) && orgsResult.payload?.length > 0) {
        const list = orgsResult.payload;
        const defaultOrg = list.find((o) => o.isDefault) ?? list[0];
        switchOrg(defaultOrg);
      }
    }

    navigate("/admin/dashboard");
  };

  const loginErrorMsg = LOGIN_ERRORS[errorCode] || error || "";

  // ── Forgot password helpers ───────────────────────────────
  const goForgot = () => {
    setFpEmail(form.email); // pre-fill if user already typed their email
    setFpOtp(""); setFpVerifyToken(""); setFpNewPw(""); setFpConfirmPw("");
    setFpError(""); setFpSuccess(""); setShowNewPw(false);
    setView("forgot");
  };

  const backToLogin = () => { setView("login"); setFpError(""); };

  // Step 1 — send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!fpEmail.trim()) { setFpError("Email is required."); return; }
    setFpLoading(true); setFpError("");
    try {
      await sendOtp(fpEmail.trim(), "FORGOT_PASSWORD");
      setView("otp");
    } catch (err) {
      setFpError(err?.response?.data?.message ?? "Failed to send OTP. Check the email and try again.");
    } finally {
      setFpLoading(false);
    }
  };

  // Step 2 — verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!fpOtp.trim()) { setFpError("Enter the OTP sent to your email."); return; }
    setFpLoading(true); setFpError("");
    try {
      const token = await verifyOtp(fpEmail.trim(), fpOtp.trim(), "FORGOT_PASSWORD");
      setFpVerifyToken(token);
      setView("reset");
    } catch (err) {
      setFpError(err?.response?.data?.message ?? "Invalid or expired OTP. Try again.");
    } finally {
      setFpLoading(false);
    }
  };

  // Step 3 — reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!fpNewPw)                          { setFpError("Enter a new password."); return; }
    if (fpNewPw.length < 8)               { setFpError("Password must be at least 8 characters."); return; }
    if (fpNewPw !== fpConfirmPw)          { setFpError("Passwords do not match."); return; }
    setFpLoading(true); setFpError("");
    try {
      await resetPassword(fpVerifyToken, fpNewPw);
      setFpSuccess("Password reset successfully. You can now sign in.");
      setView("done");
    } catch (err) {
      setFpError(err?.response?.data?.message ?? "Reset failed. The link may have expired — start over.");
    } finally {
      setFpLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="sa-login-page">
      <div className="sa-login-card">

        <div className="sa-login-card__top">
          <img src={kinkoLogo1} alt="Kinko" className="sa-login-card__logo" />
        </div>

        {/* ── LOGIN VIEW ── */}
        {view === "login" && (
          <>
            <h1 className="sa-login-card__title">Admin Portal</h1>

            {loginErrorMsg && (
              <div className="sa-login-card__error">
                <span>⚠</span> {loginErrorMsg}
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
                <div className="sa-login-form__label-row">
                  <label htmlFor="password" className="sa-login-form__label">Password</label>
                  <button type="button" className="sa-fp-trigger" onClick={goForgot}>
                    Forgot password?
                  </button>
                </div>
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
          </>
        )}

        {/* ── FORGOT — Step 1: Email ── */}
        {view === "forgot" && (
          <>
            <h1 className="sa-login-card__title">Reset Password</h1>
            <p className="sa-fp-desc">Enter your admin email. We'll send a one-time code to reset your password.</p>

            {fpError && <div className="sa-login-card__error"><span>⚠</span> {fpError}</div>}

            <form className="sa-login-form" onSubmit={handleSendOtp} noValidate>
              <div className="sa-login-form__field">
                <label htmlFor="fp-email" className="sa-login-form__label">Email</label>
                <input id="fp-email" type="email" autoComplete="email" required
                  value={fpEmail} onChange={(e) => { setFpEmail(e.target.value); setFpError(""); }}
                  className="sa-login-form__input" placeholder="admin@hdw.in" />
              </div>

              <button type="submit" className="sa-login-form__submit" disabled={fpLoading}>
                {fpLoading ? "Sending…" : "Send OTP"}
              </button>
            </form>

            <button className="sa-login-card__back" onClick={backToLogin}>← Back to sign in</button>
          </>
        )}

        {/* ── FORGOT — Step 2: OTP ── */}
        {view === "otp" && (
          <>
            <h1 className="sa-login-card__title">Enter OTP</h1>
            <p className="sa-fp-desc">
              A 6-digit code was sent to <strong>{fpEmail}</strong>. Enter it below.
            </p>

            {fpError && <div className="sa-login-card__error"><span>⚠</span> {fpError}</div>}

            <form className="sa-login-form" onSubmit={handleVerifyOtp} noValidate>
              <div className="sa-login-form__field">
                <label htmlFor="fp-otp" className="sa-login-form__label">One-Time Code</label>
                <input id="fp-otp" type="text" inputMode="numeric" maxLength={6}
                  autoComplete="one-time-code" required
                  value={fpOtp} onChange={(e) => { setFpOtp(e.target.value.replace(/\D/g, "")); setFpError(""); }}
                  className="sa-login-form__input sa-fp-otp-input" placeholder="••••••" />
              </div>

              <button type="submit" className="sa-login-form__submit" disabled={fpLoading}>
                {fpLoading ? "Verifying…" : "Verify OTP"}
              </button>
            </form>

            <button className="sa-login-card__back" onClick={() => { setView("forgot"); setFpError(""); }}>
              ← Resend / change email
            </button>
          </>
        )}

        {/* ── FORGOT — Step 3: New Password ── */}
        {view === "reset" && (
          <>
            <h1 className="sa-login-card__title">New Password</h1>
            <p className="sa-fp-desc">Choose a strong password for your account.</p>

            {fpError && <div className="sa-login-card__error"><span>⚠</span> {fpError}</div>}

            <form className="sa-login-form" onSubmit={handleResetPassword} noValidate>
              <div className="sa-login-form__field">
                <label htmlFor="fp-newpw" className="sa-login-form__label">New Password</label>
                <div className="sa-login-form__input-wrap">
                  <input id="fp-newpw"
                    type={showNewPw ? "text" : "password"}
                    autoComplete="new-password" required
                    value={fpNewPw} onChange={(e) => { setFpNewPw(e.target.value); setFpError(""); }}
                    className="sa-login-form__input" placeholder="Min. 8 characters" />
                  <button type="button" className="sa-login-form__eye"
                    onClick={() => setShowNewPw((p) => !p)} tabIndex={-1}>
                    {showNewPw ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div className="sa-login-form__field">
                <label htmlFor="fp-confirmpw" className="sa-login-form__label">Confirm Password</label>
                <input id="fp-confirmpw"
                  type={showNewPw ? "text" : "password"}
                  autoComplete="new-password" required
                  value={fpConfirmPw} onChange={(e) => { setFpConfirmPw(e.target.value); setFpError(""); }}
                  className="sa-login-form__input" placeholder="Re-enter password" />
              </div>

              <button type="submit" className="sa-login-form__submit" disabled={fpLoading}>
                {fpLoading ? "Resetting…" : "Reset Password"}
              </button>
            </form>
          </>
        )}

        {/* ── DONE ── */}
        {view === "done" && (
          <>
            <div className="sa-fp-success-icon">✓</div>
            <h1 className="sa-login-card__title">Password Reset</h1>
            <p className="sa-fp-desc">{fpSuccess}</p>
            <button className="sa-login-form__submit" style={{ marginTop: 8 }} onClick={backToLogin}>
              Back to Sign In
            </button>
          </>
        )}

      </div>
    </div>
  );
}
