# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login/user-login.spec.js >> User Login Page >> Super Admin link navigates to /admin/login
- Location: tests/login/user-login.spec.js:106:3

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - img "Kinko" [ref=e6]
  - heading "Admin Portal" [level=1] [ref=e7]
  - generic [ref=e8]:
    - generic [ref=e9]:
      - generic [ref=e10]: Email
      - textbox "Email" [active] [ref=e11]:
        - /placeholder: admin@hdw.in
        - text: o
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: Password
        - button "Forgot password?" [ref=e15] [cursor=pointer]
      - generic [ref=e16]:
        - textbox "Password" [ref=e17]:
          - /placeholder: ••••••••
        - button "👁️" [ref=e18] [cursor=pointer]
    - button "Sign in" [ref=e19] [cursor=pointer]
```