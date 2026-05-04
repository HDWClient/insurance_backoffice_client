---
description: Build the app and deploy to S3 + invalidate CloudFront cache
allowed-tools: Bash(npm run build:*), Bash(aws s3 sync:*), Bash(aws cloudfront create-invalidation:*), Bash(aws cloudfront get-invalidation:*), Bash(aws sts get-caller-identity:*), Read
argument-hint: ""
---

# Deploy to S3 + CloudFront

## Step 1 — Load credentials from .env.deploy

Read the file `.env.deploy` in the project root and export every key as an environment variable for subsequent Bash calls. The file contains:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`
- `AWS_REGION`
- `S3_BUCKET`
- `S3_FOLDER`
- `CLOUDFRONT_DISTRIBUTION_ID`

## Step 2 — Verify AWS credentials are valid

Run:
```
aws sts get-caller-identity
```
with the credentials from `.env.deploy` exported as env vars.

If the output contains `"ExpiredTokenException"` or any error, stop immediately and tell the user:
> "Your AWS credentials in `.env.deploy` have expired. Please update `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN` with fresh values and run `/deploy` again."

If valid, continue.

## Step 3 — Production build

Run:
```
npm run build
```

If the build fails, show the error and stop. Do not proceed to upload.

## Step 4 — Sync dist/ to S3

Run (with credentials exported as env vars):
```
aws s3 sync dist/ s3://<S3_BUCKET>/<S3_FOLDER>/ --region <AWS_REGION> --delete
```

Replace `<S3_BUCKET>`, `<S3_FOLDER>`, and `<AWS_REGION>` with the values from `.env.deploy`.

Show each uploaded file as confirmation.

## Step 5 — Invalidate CloudFront cache

Run:
```
aws cloudfront create-invalidation \
  --distribution-id <CLOUDFRONT_DISTRIBUTION_ID> \
  --paths "/<S3_FOLDER>/*"
```

Replace `<CLOUDFRONT_DISTRIBUTION_ID>` and `<S3_FOLDER>` with values from `.env.deploy`.

## Step 6 — Report result

Print a summary:
```
✓ Build complete
✓ Uploaded to s3://<S3_BUCKET>/<S3_FOLDER>/
✓ CloudFront invalidation <INVALIDATION_ID> created (InProgress — ready in ~1-2 min)
```

Remind the user that the credentials in `.env.deploy` are temporary SSO tokens and will expire. When they do, update the three AWS_* credential lines with fresh values.
