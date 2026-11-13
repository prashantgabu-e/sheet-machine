# Sheet Machine

A mobile-first, write-only register for personal events and loans. GitHub Pages hosts the React/Vite UI. A deployed Apps Script Web App receives form-encoded submissions in a hidden iframe and writes using the deployment owner's Google Sheets access. The app deliberately does not read or display Sheet rows.

## Access and navigation

The application opens on a full-page Google login. A token must pass a no-write Apps Script authorization check before the user can access the application; the server-side `ALLOWED_EMAILS` list is the authority. Valid, unexpired authorized sessions are retained in local storage.

After login, the left sidebar contains:

- **Event Logs**: the existing event-entry form and its four timeline destinations.
- **Loan Register**: a separate loan-entry form that writes to its own spreadsheet.

## Event form and destinations

The current form contains event information only; it does not show system-generated values. Apps Script generates `Sr. No.`, `Event ID`, `Duration`, `Created Date`, and `Last Updated` immediately before appending a row.

The destination chips route to:

- Prashant: third tab in the first spreadsheet
- Khyati: second tab in the first spreadsheet
- Family: first tab in the first spreadsheet
- Others: first tab in the second spreadsheet

Add master values for any choice field later in `src/constants.js` and the matching `options` array in `apps-script/Code.gs`.

## Loan register and destination

The Loan Register writes to the first tab of a separate spreadsheet. `Sr. No.` and `Outstanding` are generated server-side; Outstanding is always `Total Amount - Amount Paid`.

The loan spreadsheet's first tab must have these headers in exactly this order:

```text
Sr No., Date Transferred, Sender, Receiver, Loan Type, Status, Total Amount, Amount Paid, Outstanding, Amount Paid On
```

Configured field types and choices:

- Date Transferred and Amount Paid On: date inputs
- Sender and Receiver: creatable lists initially containing Mummy, Alpesh, Prashant, Darshita, Moira Nexus, Chotila Farm, and Prangadh Farm
- Loan Type: Personal, Home, Vehicle, Business, Education, Medical, Property related, Lawyer/Legal, Other
- Status: Active, Partially Paid, Paid, Overdue
- Total Amount and Amount Paid: INR currency inputs; Amount Paid cannot exceed Total Amount

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
3. Make sure the Google account that owns the Apps Script deployment has Editor access to all three destination spreadsheets.
4. Add these Apps Script Script Properties:
   - `GOOGLE_CLIENT_ID`: the browser OAuth client ID
   - `FIRST_SPREADSHEET_ID`: ID of the first spreadsheet
   - `SECOND_SPREADSHEET_ID`: ID of the second spreadsheet
   - `LOAN_SPREADSHEET_ID`: ID of the separate loan spreadsheet
5. Make sure all four event target tabs contain the 21 event headers documented in `apps-script/Code.gs`, and set up the loan sheet headers shown above.
6. Deploy as a Web app: **Execute as Me**, **Who has access Anyone**. Use its `/exec` URL as `VITE_APPS_SCRIPT_URL`.

After each Apps Script deployment, verify the exact `/exec` URL without writing a row:

```bash
npm run debug:apps-script -- https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

It must report `PASS`. A compile error such as `Identifier 'PROP' has already been declared` means the Apps Script project contains an old duplicate declaration; replace its `Sheets.gs` with this repository's `apps-script/Sheets.gs`, then redeploy.

## Deploy

Set `VITE_APPS_SCRIPT_URL` and `VITE_GOOGLE_CLIENT_ID` as GitHub Actions repository variables. Push `main`; the workflow tests, builds into the tracked `docs/` directory, and deploys it through GitHub Pages.

## Security

- The browser sends submissions through a normal HTML form targeted to a hidden iframe; it does not use cross-origin `fetch`.
- Each submission includes a Google ID token; Apps Script verifies its issuer, audience, expiry, and verified email before writing.
- The Apps Script response contains a random request ID and posts success/failure from the hidden iframe to its top-level parent page.
- The browser accepts responses only from Google Apps Script origins that match its pending request ID.
