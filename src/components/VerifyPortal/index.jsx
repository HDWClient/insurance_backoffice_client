import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as verifyService from "../../services/verifyService";
import "./styles.css";

const ERROR_MESSAGES = {
  INVALID_TOKEN:    "This verification link is invalid or has expired. Please check your email for the correct link.",
  OTP_RATE_LIMITED: "Please wait before requesting another code.",
  OTP_LOCKED:       "Too many attempts. This invitation has been locked.",
  ALREADY_VERIFIED: "You are already verified! Nothing more to do.",
  ROW_REJECTED:     "This invitation is no longer valid.",
  INVITE_SUPERSEDED:"This invitation was replaced by a newer one — check your inbox for a more recent email.",
  INVALID_OTP:      "Incorrect code. Please check and try again.",
  OTP_EXPIRED:      "Your code has expired. Please request a new one.",
};

function errorMessage(code, fallbackMsg) {
  return ERROR_MESSAGES[code] ?? fallbackMsg ?? `Something went wrong (${code}).`;
}

export default function VerifyPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [step, setStep]       = useState("send");  // "send" | "otp" | "done"
  const [otp, setOtp]         = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);

  if (!token) {
    return (
      <div className="vp-page">
        <div className="vp-card">
          <div className="vp-icon vp-icon--warn">!</div>
          <h1 className="vp-title">Invalid Link</h1>
          <p className="vp-body">
            No verification token found. Please click the link from your invitation email.
          </p>
        </div>
      </div>
    );
  }

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    try {
      await verifyService.sendOtp(token);
      setStep("otp");
    } catch (err) {
      const code = err?.response?.data?.errorCode;
      const msg  = err?.response?.data?.message;
      if (code === "ALREADY_VERIFIED") {
        setAlreadyEnrolled(true);
        setStep("done");
        return;
      }
      setError(errorMessage(code, msg));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (otp.trim().length !== 6) { setError("Please enter the 6-digit code."); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await verifyService.confirmOtp(token, otp.trim());
      setAlreadyEnrolled(data?.alreadyEnrolled ?? false);
      setStep("done");
    } catch (err) {
      const code = err?.response?.data?.errorCode;
      const msg  = err?.response?.data?.message;
      setError(errorMessage(code, msg));
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className="vp-page">
        <div className="vp-card">
          <div className="vp-icon vp-icon--ok">✓</div>
          <h1 className="vp-title">
            {alreadyEnrolled ? "Already Enrolled" : "You're verified!"}
          </h1>
          <p className="vp-body">
            {alreadyEnrolled
              ? "You're already enrolled with this organization. Nothing more to do."
              : "Your account has been successfully verified. You can now use the app."}
          </p>
        </div>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="vp-page">
        <div className="vp-card">
          <div className="vp-icon vp-icon--otp">✉</div>
          <h1 className="vp-title">Enter your code</h1>
          <p className="vp-body">
            We sent a 6-digit code to your registered mobile number. It expires in 10 minutes.
          </p>

          {error && <div className="vp-error">{error}</div>}

          <form onSubmit={handleConfirm} className="vp-form">
            <input
              className="vp-otp-input"
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
            />
            <button className="vp-btn vp-btn--primary" type="submit" disabled={loading || otp.length !== 6}>
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>

          <button
            className="vp-link"
            onClick={() => { setStep("send"); setOtp(""); setError(null); }}
            disabled={loading}
          >
            ← Request a new code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vp-page">
      <div className="vp-card">
        <div className="vp-icon vp-icon--mail">✉</div>
        <h1 className="vp-title">Verify your account</h1>
        <p className="vp-body">
          Click the button below and we'll send a one-time code to your registered mobile number.
        </p>

        {error && <div className="vp-error">{error}</div>}

        <button className="vp-btn vp-btn--primary" onClick={handleSend} disabled={loading}>
          {loading ? "Sending…" : "Send me a code"}
        </button>
      </div>
    </div>
  );
}
