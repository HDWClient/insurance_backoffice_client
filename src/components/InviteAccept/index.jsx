import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as authService from "../../services/authService";
import "./styles.css";

const ERROR_MESSAGES = {
  USER_NOT_FOUND:      "No account found for this email. Check the address or contact your administrator.",
  INVALID_CREDENTIALS: "No account found for this email. Check the address or contact your administrator.",
  OTP_NOT_FOUND:       "No invite code found for this email. Use 'Resend code' to request a new one.",
  OTP_EXPIRED:         "Your invite code has expired. Click 'Resend code' to get a new one.",
  OTP_INVALIDATED:     "Too many incorrect attempts — the code is now invalid. Click 'Resend code' to get a new one.",
  INVALID_OTP:         "Incorrect code. Please double-check your email and try again.",
  VALIDATION_ERROR:    "Password is too short. Please use at least 8 characters.",
  ACCOUNT_DISABLED:    "Your account has been disabled. Contact your administrator.",
  EMAIL_NOT_VERIFIED:  "Your email is not yet verified. Contact your administrator.",
  OTP_RATE_LIMITED:    "Please wait a moment before requesting another code.",
  OTP_LOCKED:          "Too many attempts. Contact your administrator for assistance.",
};

function errMsg(code, fallback) {
  return ERROR_MESSAGES[code] ?? fallback ?? `Something went wrong (${code}).`;
}

export default function InviteAccept() {
  const navigate = useNavigate();

  const [done, setDone]                       = useState(false);
  const [email, setEmail]                     = useState("");
  const [otp, setOtp]                         = useState("");
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword]       = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [resending, setResending]             = useState(false);
  const [resendMsg, setResendMsg]             = useState(null);
  const [error, setError]                     = useState(null);

  const allFilled =
    email.trim() &&
    otp.length === 6 &&
    password.length >= 8 &&
    confirmPassword;

  const handleResend = async () => {
    if (!email.trim()) { setError("Please enter your email first."); return; }
    setResending(true); setResendMsg(null); setError(null);
    try {
      await authService.sendOtp(email.trim(), "INVITE");
      setResendMsg("A new code has been sent to your email.");
    } catch (err) {
      const code = err?.response?.data?.errorCode;
      const msg  = err?.response?.data?.message;
      setError(errMsg(code, msg));
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim())            { setError("Email is required.");                    return; }
    if (otp.trim().length !== 6)  { setError("Please enter the 6-digit code.");        return; }
    if (!password)                { setError("Password is required.");                 return; }
    if (password.length < 8)      { setError("Password must be at least 8 characters."); return; }
    if (!confirmPassword)         { setError("Please confirm your password.");          return; }
    if (password !== confirmPassword) { setError("Passwords do not match.");            return; }

    setLoading(true); setError(null);
    try {
      await authService.acceptInvite(email.trim(), otp.trim(), password);
      setDone(true);
    } catch (err) {
      const code = err?.response?.data?.errorCode;
      const msg  = err?.response?.data?.message;
      setError(errMsg(code, msg));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="ia-page">
        <div className="ia-card">
          <div className="ia-icon ia-icon--ok">✓</div>
          <h1 className="ia-title">Account activated!</h1>
          <p className="ia-body">Your account is ready. Click below to log in.</p>
          <button className="ia-btn ia-btn--primary" onClick={() => navigate("/admin/login", { replace: true })}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ia-page">
      <div className="ia-card">
        <div className="ia-icon ia-icon--mail">✉</div>
        <h1 className="ia-title">You've been invited!</h1>
        <p className="ia-body">
          Fill in all the details below to activate your account.
        </p>

        {error     && <div className="ia-error">{error}</div>}
        {resendMsg && <div className="ia-success">{resendMsg}</div>}

        <form onSubmit={handleSubmit} className="ia-form">
          <div className="ia-field">
            <label className="ia-label">Your email <span className="ia-required">*</span></label>
            <input
              className="ia-input"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); setResendMsg(null); }}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              required
            />
          </div>

          <div className="ia-field">
            <label className="ia-label">Verification code <span className="ia-required">*</span></label>
            <input
              className="ia-input ia-input--otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); setResendMsg(null); }}
              placeholder="123456"
              required
            />
          </div>

          <div className="ia-field">
            <label className="ia-label">New password <span className="ia-required">*</span></label>
            <div className="ia-input-wrap">
              <input
                className="ia-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                required
              />
              <button type="button" className="ia-eye" onClick={() => setShowPassword(p => !p)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="ia-field">
            <label className="ia-label">Confirm password <span className="ia-required">*</span></label>
            <input
              className="ia-input"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
            />
          </div>

          <button
            className="ia-btn ia-btn--primary"
            type="submit"
            disabled={loading || !allFilled}
          >
            {loading ? "Activating…" : "Activate Account"}
          </button>
        </form>

        <button className="ia-link" onClick={handleResend} disabled={resending}>
          {resending ? "Sending…" : "Resend code"}
        </button>
      </div>
    </div>
  );
}
