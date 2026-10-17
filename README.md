# ntc-survey-system

## Features and Changes

- Filter dashboard charts by the last 7 days, 30 days, 12 months, or all time.
- Require survey account credentials and a valid one-time QR code before loading or submitting the survey.
- Collect responses by selected NTC Region 2 division. Existing questions remain shared by default; admins can assign new questions to all divisions or a specific division.
- Create survey accounts and generate or reissue sign-in QR codes from the Survey Access tab.
- Change the admin password in Settings and request a one-use email reset link.
- Match the portal to the NTC navy-and-gold color scheme.
- Use a smaller NTC logo and align admin navigation, including the logout action.
- Fit the admin sign-in page to desktop and mobile viewports.
- Serve the public website and API from the same hosted application.

## Run Locally

```sh
cd backend
npm install
npm start
```

Open `http://localhost:4000` to access the public site. The demo admin account is `admin` / `ntc-admin`; change it before exposing a local instance publicly.

## Deploy to Render

1. Push this repository to GitHub and create a Render Blueprint from it. Render will read the root `render.yaml` file.
2. Set the required `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables when prompted. Use a unique, strong password; production login does not accept the checked-in demo credentials.
3. Configure `ADMIN_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` for password recovery. Keep secrets in Render environment variables, never in source control.
4. Deploy the web service. Render serves the site and API together over HTTPS and stores JSON data, admin credentials, and one-time tokens on the configured persistent disk.

For Gmail, enable 2-Step Verification and create an App Password. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, and use the Gmail address for `ADMIN_EMAIL`, `SMTP_USER`, and `SMTP_FROM`; put the App Password in `SMTP_PASS`. Do not use your regular Gmail password. In local development without SMTP, the recovery page displays a local-only preview link. SMS recovery is not configured and requires a separate SMS provider.

Generated QR links use the deployed request host and expire after 15 minutes. Reissuing a code invalidates any earlier unused code for that account. The JSON-file store is intended for a small, single-instance deployment; use a database before scaling to multiple instances or high traffic.

