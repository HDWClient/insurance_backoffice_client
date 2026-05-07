import { useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import * as verifyService from "../../services/verifyService";
import kinkoLogo from "../../assets/kinkologo1.png";
import "./styles.css";

const OTP_ERROR_MAP = {
  INVALID_OTP:           "The code you entered is incorrect. Please try again.",
  OTP_EXPIRED:           "This code has expired. Please request a new one.",
  OTP_LOCKED:            "Too many incorrect attempts. Please contact your administrator.",
  INVALID_TOKEN:         "This verification link is invalid. Please use the link from your invitation email.",
  ALREADY_VERIFIED:      "This invitation has already been verified.",
  OTP_RATE_LIMITED:      "Please wait before requesting another code.",
};

function getErrorText(err) {
  const code = err?.response?.data?.error?.errorCode ?? err?.response?.data?.errorCode;
  const msg  = err?.response?.data?.error?.message   ?? err?.response?.data?.message;
  return OTP_ERROR_MAP[code] ?? msg ?? "Something went wrong. Please try again.";
}

export default function VerifyPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || null;

  const [otpSent, setOtpSent]         = useState(false);   // show OTP input after send
  const [success, setSuccess]         = useState(false);    // navigate to success screen
  const [otp, setOtp]                 = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const otpInputRef = useRef(null);

  // ── Send OTP ────────────────────────────────────────────────
  const handleSendOtp = async () => {
    setSendLoading(true);
    setVerifyError("");
    setOtpSent(true); // show OTP field immediately, no error shown on send
    try {
      await verifyService.sendOtp(token);
      setOtp("");
      setTimeout(() => otpInputRef.current?.focus(), 80);
    } catch {
      // silently ignore send errors — user can still enter OTP
    } finally {
      setSendLoading(false);
    }
  };

  // ── Verify OTP ──────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      setVerifyError("Please enter the 6-digit code.");
      return;
    }
    setVerifyLoading(true);
    setVerifyError("");
    try {
      await verifyService.confirmOtp(token, otp.trim());
      setSuccess(true);
    } catch (err) {
      setVerifyError(getErrorText(err));
      setOtp("");
      otpInputRef.current?.focus();
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── No token in URL — show invalid link screen ─────────────
  if (!token) {
    return (
      <div className="vp-page">
        <div className="vp-blob vp-blob--1" />
        <div className="vp-blob vp-blob--2" />
        <div className="vp-blob vp-blob--3" />
        <div className="vp-card">
          <div className="vp-logo-wrap">
            <img src={kinkoLogo} alt="Kinko" className="vp-logo" />
          </div>
          <div className="vp-step-icon vp-step-icon--warn">⚠</div>
          <h1 className="vp-title">Invalid Link</h1>
          <p className="vp-body">
            This verification link is invalid or has expired. Please use the link from your invitation email.
          </p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  //  SUCCESS SCREEN
  // ══════════════════════════════════════════════════════════
  if (success) {
    return (
      <div className="vp-page">
        <div className="vp-blob vp-blob--1" />
        <div className="vp-blob vp-blob--2" />
        <div className="vp-blob vp-blob--3" />
        <div className="vp-card">
          <div className="vp-logo-wrap">
            <img src={kinkoLogo} alt="Kinko" className="vp-logo" />
          </div>

          <div className="vp-success-icon">✓</div>
          <h1 className="vp-title">Verification Successful!</h1>
          <p className="vp-body">
            Your identity has been verified. You're all set to get started with Kinko.
          </p>

          <div className="vp-divider" />

          <p className="vp-download-heading">Download the Kinko app</p>
          <p className="vp-download-sub">
            Manage your insurance, track claims, and stay covered — all from your phone.
          </p>

          <div className="vp-store-buttons">
            <a
              href="https://play.google.com/store"
              target="_blank"
              rel="noopener noreferrer"
              className="vp-store-btn vp-store-btn--play"
            >
              <span className="vp-store-btn__icon">▶</span>
              <span className="vp-store-btn__text">
                <span className="vp-store-btn__sub">GET IT ON</span>
                <span className="vp-store-btn__name">Google Play</span>
              </span>
            </a>
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="vp-store-btn vp-store-btn--apple"
            >
              <span className="vp-store-btn__icon">⌘</span>
              <span className="vp-store-btn__text">
                <span className="vp-store-btn__sub">DOWNLOAD ON THE</span>
                <span className="vp-store-btn__name">App Store</span>
              </span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  //  MAIN SCREEN — Send OTP → OTP input → Verify OTP
  // ══════════════════════════════════════════════════════════
  return (
    <div className="vp-page">
      <div className="vp-blob vp-blob--1" />
      <div className="vp-blob vp-blob--2" />
      <div className="vp-blob vp-blob--3" />
      <div className="vp-card">
        <div className="vp-logo-wrap">
          <img src={kinkoLogo} alt="Kinko" className="vp-logo" />
        </div>

        <div className="vp-step-icon vp-step-icon--shield">🔐</div>
        <h1 className="vp-title">Verify Your Identity</h1>
        <p className="vp-body">
          {otpSent
            ? "We've sent a 6-digit code to your registered email / mobile number. Enter it below."
            : "To complete your enrollment, we'll send a one-time password to your registered email address or mobile number."}
        </p>

        {/* OTP input — appears after Send OTP is clicked */}
        {otpSent && (
          <div className="vp-field">
            <input
              ref={otpInputRef}
              className={`vp-otp-input ${verifyError ? "vp-otp-input--err" : ""}`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="— — — — — —"
              maxLength={6}
              value={otp}
              onChange={e => {
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                if (verifyError) setVerifyError("");
              }}
            />
            {verifyError && <p className="vp-field-error">{verifyError}</p>}
          </div>
        )}

        {/* Send OTP button — hidden once OTP is sent */}
        {!otpSent && (
          <button
            type="button"
            className="vp-btn vp-btn--primary"
            onClick={handleSendOtp}
            disabled={sendLoading}
          >
            {sendLoading
              ? <span className="vp-btn-loading"><span className="vp-spinner" /> Sending OTP…</span>
              : "Send OTP"}
          </button>
        )}

        {/* Verify OTP button — shown after OTP is sent */}
        {otpSent && (
          <button
            type="button"
            className="vp-btn vp-btn--primary"
            onClick={handleVerifyOtp}
            disabled={verifyLoading || otp.length !== 6}
          >
            {verifyLoading
              ? <span className="vp-btn-loading"><span className="vp-spinner" /> Verifying…</span>
              : "Verify OTP"}
          </button>
        )}

        {/* Resend link */}
        {otpSent && (
          <div className="vp-resend-row">
            <span className="vp-resend-label">Didn't receive the code?</span>
            <button
              type="button"
              className="vp-link-btn"
              onClick={handleSendOtp}
              disabled={sendLoading || verifyLoading}
            >
              {sendLoading ? "Sending…" : "Resend OTP"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
