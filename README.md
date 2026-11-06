# Sheet Machine

One mobile-first event form that routes each submission into one of four sheet destinations. GitHub Pages hosts the React/Vite UI. A deployed Apps Script Web App receives form-encoded submissions in a hidden iframe and writes using the deployment owner's Google Sheets access. The app deliberately does not read or display Sheet rows.

## Event form and destinations

The current form contains event information only; it does not show system-generated values. Apps Script generates `Sr. No.`, `Event ID`, `Duration`, `Created Date`, and `Last Updated` immediately before appending a row.

The destination chips route to:

- Prashant: third tab in the first spreadsheet
- Khyati: second tab in the first spreadsheet
- Family: first tab in the first spreadsheet
- Others: first tab in the second spreadsheet

Add master values for any choice field later in `src/constants.js` and the matching `options` array in `apps-script/Code.gs`.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Set the public `.env` values:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

## Apps Script setup

1. Create a standalone project at [script.new](https://script.new/).
2. In the editor, create and paste these files from `apps-script/`: `Code.gs`, `Auth.gs`, `Sheets.gs`, and `appsscript.json`. Enable **Show "appsscript.json" manifest file in editor** in Project Settings first.
3. Make sure the Google account that owns the Apps Script deployment has Editor access to both destination spreadsheets.
4. Add these Apps Script Script Properties:
   - `PARENT_ORIGINS`: `https://prashantgabu-e.github.io,http://localhost:5173,http://127.0.0.1:5173`
   - `GOOGLE_CLIENT_ID`: the browser OAuth client ID
   - `FIRST_SPREADSHEET_ID`: ID of the first spreadsheet
   - `SECOND_SPREADSHEET_ID`: ID of the second spreadsheet
5. Make sure all four target tabs contain the 21 event headers documented in `apps-script/Code.gs`.
6. Deploy as a Web app: **Execute as Me**, **Who has access Anyone**. Use its `/exec` URL as `VITE_APPS_SCRIPT_URL`.

## Deploy

Set `VITE_APPS_SCRIPT_URL` and `VITE_GOOGLE_CLIENT_ID` as GitHub Actions repository variables. Push `main`; the workflow tests, builds into the tracked `docs/` directory, and deploys it through GitHub Pages.

## Security

- The browser sends submissions through a normal HTML form targeted to a hidden iframe; it does not use cross-origin `fetch`.
- Each submission includes a Google ID token; Apps Script verifies its issuer, audience, expiry, and verified email before writing.
- The Apps Script response contains a random request ID and posts success/failure only to the configured parent origins.
- The browser accepts responses only from Google Apps Script origins that match its pending request ID.
