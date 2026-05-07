import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import * as verifyService from "../../services/verifyService";
import kinkoLogo from "../../assets/kinkologo1.png";
import "./styles.css";

// ─── Error map ────────────────────────────────────────────────
const OTP_ERROR_MAP = {
  INVALID_OTP:      "The code you entered is incorrect. Please try again.",
  OTP_EXPIRED:      "This code has expired. Please request a new one.",
  OTP_LOCKED:       "Too many incorrect attempts. Please contact your administrator.",
  INVALID_TOKEN:    "This verification link is invalid. Please use the link from your invitation email.",
  ALREADY_VERIFIED: "This invitation has already been verified.",
  OTP_RATE_LIMITED: "Please wait before requesting another code.",
};

function getErr(err) {
  const code = err?.response?.data?.error?.errorCode ?? err?.response?.data?.errorCode;
  const msg  = err?.response?.data?.error?.message   ?? err?.response?.data?.message;
  return OTP_ERROR_MAP[code] ?? msg ?? "Something went wrong. Please try again.";
}

// ─── Helpers ──────────────────────────────────────────────────
function fmtDob(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function fmtTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

const GENDER = { M: "Male", F: "Female", O: "Other" };

const DETAIL_FIELDS = [
  { key: "name",         label: "Full Name",    fmt: v => v },
  { key: "email",        label: "Email",         fmt: v => v },
  { key: "mobile",       label: "Mobile",        fmt: v => v },
  { key: "dob",          label: "Date of Birth", fmt: fmtDob },
  { key: "gender",       label: "Gender",        fmt: v => GENDER[v] ?? v },
  { key: "pincode",      label: "Pincode",       fmt: v => v },
  { key: "city",         label: "City",          fmt: v => v },
  { key: "state",        label: "State",         fmt: v => v },
  { key: "panNumber",    label: "PAN Number",    fmt: v => v },
  { key: "aadhaarLast4", label: "Aadhaar",       fmt: v => `Aadhaar ending **** ${v}` },
  { key: "employeeId",   label: "Employee ID",   fmt: v => v },
];

const REJECT_CHIPS = ["Wrong name", "Wrong DOB", "Wrong mobile", "Wrong email", "Other"];

// ─── Page wrapper ─────────────────────────────────────────────
function Page({ children, wide }) {
  return (
    <div className="vp-page">
      <div className="vp-blob vp-blob--1" />
      <div className="vp-blob vp-blob--2" />
      <div className="vp-blob vp-blob--3" />
      <div className={`vp-card${wide ? " vp-card--wide" : ""}`}>
        <div className="vp-logo-wrap">
          <img src={kinkoLogo} alt="Kinko" className="vp-logo" />
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function VerifyPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || null;

  // screen: "send" | "reviewing" | "rejecting" | "enrolled" | "rejected"
  const [screen, setScreen] = useState("send");

  // OTP sub-state
  const [otpSent, setOtpSent]           = useState(false);
  const [otp, setOtp]                   = useState("");
  const [sendLoading, setSendLoading]   = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError]   = useState("");
  const otpRef = useRef(null);

  // Review data (from confirmOtp response)
  const [orgName, setOrgName]           = useState("");
  const [details, setDetails]           = useState(null);
  const [timeLeft, setTimeLeft]         = useState(null);
  const reviewExpiryRef                 = useRef(null);

  // Reject sub-state
  const [rejectChips, setRejectChips]   = useState([]);   // multi-select
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectError, setRejectError]   = useState("");

  // Promote
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promoteError, setPromoteError]     = useState("");

  // ── Review countdown ───────────────────────────────────────
  useEffect(() => {
    if (screen !== "reviewing" || !reviewExpiryRef.current) return;
    const tick = () => {
      const left = Math.max(0, Math.round((reviewExpiryRef.current - Date.now()) / 1000));
      setTimeLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [screen]);

  // ── Handlers ───────────────────────────────────────────────
  const handleSendOtp = async () => {
    setSendLoading(true);
    setVerifyError("");
    setOtpSent(true);
    try {
      await verifyService.sendOtp(token);
      setOtp("");
      setTimeout(() => otpRef.current?.focus(), 80);
    } catch {
      // silently ignore — user can still enter OTP
    } finally {
      setSendLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) { setVerifyError("Please enter the 6-digit code."); return; }
    setVerifyLoading(true);
    setVerifyError("");
    try {
      const data = await verifyService.confirmOtp(token, otp.trim());
      setOrgName(data?.orgName ?? "your organization");
      setDetails(data?.details ?? {});
      const expiry = new Date(data?.verifiedAt ?? Date.now()).getTime()
        + (data?.reviewWindowSeconds ?? 900) * 1000;
      reviewExpiryRef.current = expiry;
      setTimeLeft(data?.reviewWindowSeconds ?? 900);
      setScreen("reviewing");
    } catch (err) {
      setVerifyError(getErr(err));
      setOtp("");
      otpRef.current?.focus();
    } finally {
      setVerifyLoading(false);
    }
  };

  const handlePromote = async () => {
    setPromoteLoading(true);
    setPromoteError("");
    try {
      await verifyService.promote(token);
      setScreen("enrolled");
    } catch (err) {
      setPromoteError(getErr(err));
    } finally {
      setPromoteLoading(false);
    }
  };

  const handleReject = async () => {
    const parts = [...rejectChips];
    if (rejectReason.trim()) parts.push(rejectReason.trim());
    const reason = parts.join(", ");
    setRejectLoading(true);
    setRejectError("");
    try {
      await verifyService.reject(token, reason);
      setScreen("rejected");
    } catch (err) {
      setRejectError(getErr(err));
    } finally {
      setRejectLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════
  //  INVALID LINK
  // ══════════════════════════════════════════════════════════
  if (!token) {
    return (
      <Page>
        <div className="vp-step-icon vp-step-icon--warn">⚠</div>
        <h1 className="vp-title">Invalid Link</h1>
        <p className="vp-body">
          This verification link is invalid or has expired. Please use the link from your invitation email.
        </p>
      </Page>
    );
  }

  // ══════════════════════════════════════════════════════════
  //  ENROLLED (success)
  // ══════════════════════════════════════════════════════════
  if (screen === "enrolled") {
    return (
      <Page>
        <div className="vp-success-icon">✓</div>
        <h1 className="vp-title">You're Enrolled!</h1>
        <p className="vp-body">
          Welcome! You have been successfully enrolled with <strong>{orgName}</strong>.
        </p>
        <div className="vp-divider" />
        <p className="vp-download-heading">Download the Kinko app</p>
        <p className="vp-download-sub">
          Manage your insurance, track claims, and stay covered — all from your phone.
        </p>
        <div className="vp-store-buttons">
          <a href="https://play.google.com/store" target="_blank" rel="noopener noreferrer"
            className="vp-store-btn vp-store-btn--play">
            <span className="vp-store-btn__icon">▶</span>
            <span className="vp-store-btn__text">
              <span className="vp-store-btn__sub">GET IT ON</span>
              <span className="vp-store-btn__name">Google Play</span>
            </span>
          </a>
          <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer"
            className="vp-store-btn vp-store-btn--apple">
            <span className="vp-store-btn__icon">⌘</span>
            <span className="vp-store-btn__text">
              <span className="vp-store-btn__sub">DOWNLOAD ON THE</span>
              <span className="vp-store-btn__name">App Store</span>
            </span>
          </a>
        </div>
      </Page>
    );
  }

  // ══════════════════════════════════════════════════════════
  //  REJECTED
  // ══════════════════════════════════════════════════════════
  if (screen === "rejected") {
    return (
      <Page>
        <div className="vp-step-icon vp-step-icon--info">✉</div>
        <h1 className="vp-title">Thank you for letting us know</h1>
        <p className="vp-body">
          Your HR team has been notified about the incorrect information. <strong>HR will get back to you</strong> with a corrected invitation shortly.
        </p>
      </Page>
    );
  }

  // ══════════════════════════════════════════════════════════
  //  REJECT REASON FORM
  // ══════════════════════════════════════════════════════════
  if (screen === "rejecting") {
    return (
      <Page wide>
        <div className="vp-step-icon vp-step-icon--warn">✎</div>
        <h1 className="vp-title">What's incorrect?</h1>
        <p className="vp-body">
          Select what's wrong and optionally describe the issue. Your HR team will be notified.
        </p>

        <div className="vp-chips">
          {REJECT_CHIPS.map(chip => (
            <button
              key={chip}
              type="button"
              className={`vp-chip${rejectChips.includes(chip) ? " vp-chip--active" : ""}`}
              aria-pressed={rejectChips.includes(chip)}
              onClick={() =>
                setRejectChips(prev =>
                  prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
                )
              }
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="vp-field" style={{ marginTop: 16 }}>
          <textarea
            className="vp-reject-textarea"
            placeholder="Describe the issue (optional)…"
            maxLength={500}
            value={rejectReason}
            rows={3}
            onChange={e => setRejectReason(e.target.value)}
          />
          <p className="vp-char-count">{rejectReason.length}/500</p>
        </div>

        {rejectError && <div className="vp-error-banner"><span>⚠</span>{rejectError}</div>}

        <div className="vp-btn-group">
          <button
            type="button"
            className="vp-btn vp-btn--danger"
            onClick={handleReject}
            disabled={rejectLoading || (rejectChips.length === 0 && !rejectReason.trim())}
          >
            {rejectLoading
              ? <span className="vp-btn-loading"><span className="vp-spinner vp-spinner--light" /> Submitting…</span>
              : "Submit"}
          </button>
          <button
            type="button"
            className="vp-btn vp-btn--outline"
            onClick={() => { setScreen("reviewing"); setRejectError(""); setRejectChips([]); setRejectReason(""); }}
            disabled={rejectLoading}
          >
            Cancel
          </button>
        </div>
      </Page>
    );
  }

  // ══════════════════════════════════════════════════════════
  //  REVIEW SCREEN
  // ══════════════════════════════════════════════════════════
  if (screen === "reviewing") {
    const reviewItems = DETAIL_FIELDS
      .map(f => ({ label: f.label, value: details?.[f.key] ? f.fmt(details[f.key]) : null }))
      .filter(i => i.value);

    const expired = timeLeft !== null && timeLeft <= 0;
    const urgent  = timeLeft !== null && timeLeft <= 60 && timeLeft > 0;

    return (
      <Page wide>
        <div className="vp-step-icon vp-step-icon--shield">🛡</div>
        <h1 className="vp-title">Review Your Details</h1>
        <p className="vp-body">
          <strong>{orgName}</strong> wants to enrol you. Please confirm the information below is correct.
        </p>

        {/* Countdown */}
        {timeLeft !== null && (
          <div className={`vp-countdown${urgent ? " vp-countdown--urgent" : ""}${expired ? " vp-countdown--expired" : ""}`}>
            <span>⏱</span>
            {expired
              ? "Session expired — please request a new code"
              : <>You have <strong>{fmtTime(timeLeft)}</strong> to confirm</>}
          </div>
        )}

        {/* Details list */}
        <div className="vp-details">
          {reviewItems.map(item => (
            <div key={item.label} className="vp-details__row">
              <span className="vp-details__label">{item.label}</span>
              <span className="vp-details__value">{item.value}</span>
            </div>
          ))}
        </div>

        {promoteError && (
          <div className="vp-error-banner" style={{ marginTop: 16 }}>
            <span>⚠</span>{promoteError}
          </div>
        )}

        <div className="vp-btn-group" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="vp-btn vp-btn--primary"
            onClick={handlePromote}
            disabled={promoteLoading || expired}
          >
            {promoteLoading
              ? <span className="vp-btn-loading"><span className="vp-spinner" /> Enrolling…</span>
              : "Accept & Enrol"}
          </button>
          <button
            type="button"
            className="vp-btn vp-btn--outline"
            onClick={() => { setScreen("rejecting"); setPromoteError(""); }}
            disabled={promoteLoading || expired}
          >
            Wrong Info
          </button>
        </div>
      </Page>
    );
  }

  // ══════════════════════════════════════════════════════════
  //  SEND OTP / ENTER OTP (default)
  // ══════════════════════════════════════════════════════════
  return (
    <Page>
      <div className="vp-step-icon vp-step-icon--shield">🔐</div>
      <h1 className="vp-title">Verify Your Identity</h1>
      <p className="vp-body">
        {otpSent
          ? "We've sent a 6-digit code to your registered email / mobile number. Enter it below."
          : "To complete your enrollment, we'll send a one-time password to your registered email address or mobile number."}
      </p>

      {otpSent && (
        <div className="vp-field">
          <input
            ref={otpRef}
            className={`vp-otp-input${verifyError ? " vp-otp-input--err" : ""}`}
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

      {!otpSent && (
        <button type="button" className="vp-btn vp-btn--primary"
          onClick={handleSendOtp} disabled={sendLoading}>
          {sendLoading
            ? <span className="vp-btn-loading"><span className="vp-spinner" /> Sending OTP…</span>
            : "Send OTP"}
        </button>
      )}

      {otpSent && (
        <button type="button" className="vp-btn vp-btn--primary"
          onClick={handleVerifyOtp} disabled={verifyLoading || otp.length !== 6}>
          {verifyLoading
            ? <span className="vp-btn-loading"><span className="vp-spinner" /> Verifying…</span>
            : "Verify OTP"}
        </button>
      )}

      {otpSent && (
        <div className="vp-resend-row">
          <span className="vp-resend-label">Didn't receive the code?</span>
          <button type="button" className="vp-link-btn"
            onClick={handleSendOtp} disabled={sendLoading || verifyLoading}>
            {sendLoading ? "Sending…" : "Resend OTP"}
          </button>
        </div>
      )}
    </Page>
  );
}
