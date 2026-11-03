# Sheet Machine

Private, mobile-first forms backed by existing Google Sheets tabs. The React/Vite client deploys to GitHub Pages; Apps Script is the protected bridge and uses a dedicated service account to call the Sheets API.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

The app needs a deployed Apps Script bridge before protected flows can work.

## Apps Script setup (manual deployment)

1. Create a standalone Apps Script project at [script.new](https://script.new/).
2. In the Apps Script editor, create files with the same names as the contents of `apps-script/` and paste each file's contents:
   - `Code.gs`
   - `Auth.gs`
   - `Sheets.gs`
   - `Bridge.html`
   - `appsscript.json` (open Project Settings and enable **Show "appsscript.json" manifest file in editor** first)
3. Save the project, then continue with Google Cloud and Script Properties configuration below.
4. Create a standard Google Cloud project, OAuth web client, and service account. Enable the Google Sheets API.
5. Configure these **Apps Script Script Properties** — never put them in the repository:
   - `PARENT_ORIGIN`: the exact Pages site origin, e.g. `https://owner.github.io`.
   - `GOOGLE_CLIENT_ID`: OAuth web-client ID used by the browser.
   - `ADMIN_EMAIL`: the single form administrator's Google email.
   - `SERVICE_ACCOUNT_JSON`: complete service-account JSON, stored as one value.
6. Deploy the Apps Script project as a Web app executing as you, with public access. The bridge authenticates and authorizes every request itself.
7. Put its `/exec` URL and the OAuth client ID in GitHub repository **Actions variables** named `VITE_APPS_SCRIPT_URL` and `VITE_GOOGLE_CLIENT_ID`.
8. Share every form destination spreadsheet with the service account's `client_email` as an Editor.

Add the deployed Pages URL and localhost development URL to the OAuth client's Authorized JavaScript origins.

## Deploy

Push `main`. The included workflow runs tests, builds with the repository Pages base path, and deploys `dist`. Enable GitHub Pages with **GitHub Actions** as its source.

## Security notes

- The browser only receives public configuration: OAuth client ID and bridge URL.
- Service-account credentials live only in Apps Script Script Properties.
- The bridge accepts messages only from `PARENT_ORIGIN`; the browser accepts bridge messages only from its embedded Google frame.
- Google ID tokens are checked server-side for audience, issuer, expiry, verified email, and a stable Google account subject before authorization.
