// These calls run as the Apps Script deployment owner. That Google account must
// have Editor access to both target spreadsheets; no service account is used.
function spreadsheet_(spreadsheetId) {
  try { return SpreadsheetApp.openById(spreadsheetId); }
  catch (error) { throw new Error(`Cannot open spreadsheet: ${spreadsheetId}`); }
}

function sheet_(spreadsheetId, sheetName) {
  const sheet = spreadsheet_(spreadsheetId).getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet tab not found: ${sheetName}`);
  return sheet;
}

function headers_(spreadsheetId, sheetName) {
  const sheet = sheet_(spreadsheetId, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map((value) => String(value).trim());
  if (!headers.length || headers.every((value) => !value)) throw new Error('Row 1 must contain column headers.');
  if (headers.some((value) => !value) || new Set(headers).size !== headers.length) throw new Error('Column headers must be non-empty and unique.');
  return headers;
}

function sheetsAppend_(spreadsheetId, sheetName, row) {
  const sheet = sheet_(spreadsheetId, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const serialColumn = headers.indexOf('Sr. No.') + 1;
  if (!serialColumn) throw new Error('The destination sheet must contain a Sr. No. header.');
  sheet.getRange(nextAppendRow_(sheet, serialColumn), 1, 1, row.length).setValues([row]);
}

function nextAppendRow_(sheet, keyColumn) {
  const maxRows = sheet.getMaxRows();
  const values = sheet.getRange(2, keyColumn, maxRows - 1, 1).getDisplayValues();
  for (let index = 0; index < values.length; index += 1) {
    if (!String(values[index][0]).trim()) return index + 2;
  }
  sheet.insertRowsAfter(maxRows, 1);
  return maxRows + 1;
}

function lastDataRow_(sheet, keyColumn) {
  const rowCount = sheet.getMaxRows() - 1;
  if (rowCount < 1) return 1;
  const values = sheet.getRange(2, keyColumn, rowCount, 1).getDisplayValues();
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (String(values[index][0]).trim()) return index + 2;
  }
  return 1;
}

function sheetNameByIndex_(spreadsheetId, index) {
  const sheet = spreadsheet_(spreadsheetId).getSheets()[index];
  if (!sheet) throw new Error(`Spreadsheet does not have sheet number ${index + 1}.`);
  return sheet.getName();
}
