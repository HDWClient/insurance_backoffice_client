# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login/super-admin-login.spec.js >> Super Admin Login Page >> Forgot Password >> back to sign in from done view returns to login
- Location: tests/login/super-admin-login.spec.js:221:5

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - img "Kinko" [ref=e6]
  - heading "Enter OTP" [level=1] [ref=e7]
  - paragraph [ref=e8]:
    - text: A 6-digit code was sent to
    - strong [ref=e9]: admin@hdw.in
    - text: . Enter it below.
  - generic [ref=e10]:
    - generic [ref=e11]: ⚠
    - text: Invalid or expired OTP. Try again.
  - generic [ref=e12]:
    - generic [ref=e13]:
      - generic [ref=e14]: One-Time Code
      - textbox "One-Time Code" [ref=e15]:
        - /placeholder: ••••••
        - text: "123456"
    - button "Verify OTP" [ref=e16] [cursor=pointer]
  - button "← Resend / change email" [ref=e17] [cursor=pointer]
```