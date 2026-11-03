function headers_(spreadsheetId, sheetName) {
  const values = sheetsValues_(spreadsheetId, quoteSheet_(sheetName) + '!1:1');
  const headers = values[0] || [];
  if (!headers.length || headers.every((value) => !String(value).trim())) throw new Error('Row 1 must contain at least one column header.');
  const normalized = headers.map((value) => String(value).trim());
  if (normalized.some((value) => !value) || new Set(normalized).size !== normalized.length) throw new Error('Column headers must be non-empty and unique.');
  return normalized;
}
function ensureTimestamp_(form) {
  const headers = headers_(form.spreadsheetId, form.sheetName);
  if (headers.indexOf('Submitted At') < 0) sheetsUpdate_(form.spreadsheetId, `${quoteSheet_(form.sheetName)}!${columnName_(headers.length + 1)}1`, [['Submitted At']]);
}
function sheetsValues_(spreadsheetId, range) { return sheetsRequest_(spreadsheetId, 'values/' + encodeURIComponent(range), 'get').values || []; }
function sheetsAppend_(spreadsheetId, sheetName, row) { sheetsRequest_(spreadsheetId, 'values/' + encodeURIComponent(quoteSheet_(sheetName)) + ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', 'post', { values: [row] }); }
function sheetsUpdate_(spreadsheetId, range, values) { sheetsRequest_(spreadsheetId, 'values/' + encodeURIComponent(range) + '?valueInputOption=USER_ENTERED', 'put', { values }); }
function sheetsRequest_(spreadsheetId, endpoint, method, payload) {
  const response = UrlFetchApp.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/${endpoint}`, { method, contentType: 'application/json', headers: { Authorization: 'Bearer ' + serviceToken_() }, payload: payload ? JSON.stringify(payload) : undefined, muteHttpExceptions: true });
  if (response.getResponseCode() >= 300) { const body = response.getContentText(); throw new Error(`Google Sheets request failed (${response.getResponseCode()}): ${body.slice(0, 250)}`); }
  return response.getContentText() ? JSON.parse(response.getContentText()) : {};
}
function serviceToken_() {
  const cached = CacheService.getScriptCache().get('service-token'); if (cached) return cached;
  const account = JSON.parse(required_('SERVICE_ACCOUNT_JSON')); const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Utilities.base64EncodeWebSafe(typeof value === 'string' ? value : JSON.stringify(value)).replace(/=+$/, '');
  const header = encode({ alg: 'RS256', typ: 'JWT' }); const claim = encode({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3500 });
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(`${header}.${claim}`, account.private_key)).replace(/=+$/, '');
  const result = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${signature}` }, muteHttpExceptions: true });
  if (result.getResponseCode() !== 200) throw new Error('Could not authorize the Sheets service account.');
  const token = JSON.parse(result.getContentText()).access_token; CacheService.getScriptCache().put('service-token', token, 3300); return token;
}
function quoteSheet_(name) { return `'${String(name).replace(/'/g, "''")}'`; }
function columnName_(number) { let result = ''; while (number > 0) { const remainder = (number - 1) % 26; result = String.fromCharCode(65 + remainder) + result; number = Math.floor((number - 1) / 26); } return result; }
