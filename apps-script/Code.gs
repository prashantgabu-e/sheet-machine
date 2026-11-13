  const PROP = PropertiesService.getScriptProperties();
  const RESPONSE_SOURCE = 'sheet-machine-apps-script';
  const ALLOWED_EMAILS = ['prikstheprashant@gmail.com'];

  const EVENT_FIELDS = [
    { column: 'Event Name', type: 'text', required: true },
    { column: 'Event Description', type: 'textarea', required: false },
    { column: 'Event Category', type: 'choice', required: true, options: ['Family', 'Travel', 'Birthday', 'Celebration', 'Relationship', 'Health', 'Education', 'Career', 'Finance', 'Spiritual', 'Personal', 'Other'] },
    { column: 'Start Date', type: 'date', required: true },
    { column: 'End Date', type: 'date', required: false },
    { column: 'Duration (Days)', generated: true },
    { column: 'Location', type: 'text', required: false },
    { column: 'People Attended', type: 'text', required: false },
    { column: 'Event Type', type: 'choice', required: true, options: ['Personal', 'Family', 'Social', 'Professional'] },
    { column: 'Emotional Importance', type: 'choice', required: false, options: ['Low', 'Medium', 'High', 'Life-Changing'] },
    { column: 'Amount Spent (₹)', type: 'currency', required: false },
    { column: 'Event Status', type: 'choice', required: true, options: ['Planned', 'Ongoing', 'Completed', 'Cancelled'] },
    { column: 'Memories / Highlights', type: 'textarea', required: false },
    { column: 'Lessons Learned', type: 'textarea', required: false },
    { column: 'Photos / Videos Link', type: 'url', required: false },
    { column: 'Tags', type: 'text', required: false },
  ];

  const LOAN_FIELDS = [
    { column: 'Date Transferred', type: 'date', required: true },
    { column: 'Sender', type: 'text', required: true },
    { column: 'Receiver', type: 'text', required: true },
    { column: 'Loan Type', type: 'choice', required: true, options: ['Personal', 'Home', 'Vehicle', 'Business', 'Education', 'Medical', 'Other'] },
    { column: 'Status', type: 'choice', required: true, options: ['Active', 'Partially Paid', 'Paid', 'Overdue'] },
    { column: 'Total Amount', type: 'currency', required: true },
    { column: 'Amount Paid', type: 'currency', required: false },
    { column: 'Outstanding', generated: true },
    { column: 'Amount Paid On', type: 'date', required: false },
  ];

const LOAN_SERIAL_HEADER = 'Sr No.';
const LOAN_HEADERS = [LOAN_SERIAL_HEADER].concat(LOAN_FIELDS.map((field) => field.column));

  function doGet() { return HtmlService.createHtmlOutput('Sheet Machine event and loan submission endpoint.'); }

  function doPost(e) {
    const payload = e && e.parameter ? e.parameter : {};
    const requestId = String(payload.requestId || '');
    try {
      if (!requestId) throw new Error('Missing request identifier.');
      const user = identity_(payload.idToken);
      if (ALLOWED_EMAILS.indexOf(user.email) < 0) throw new Error('Your Google account is not allowed to access Sheet Machine.');
      if (payload.formId === 'auth-check') return postMessageResponse_({ source: RESPONSE_SOURCE, requestId, success: true });

      const values = JSON.parse(payload.values || '{}');
      if (payload.formId === 'event-register') appendEvent_(values);
      else if (payload.formId === 'loan-register') appendLoan_(values);
      else throw new Error('Unknown form.');
      return postMessageResponse_({ source: RESPONSE_SOURCE, requestId, success: true });
    } catch (error) {
      console.error(error && error.stack ? error.stack : error);
      return postMessageResponse_({ source: RESPONSE_SOURCE, requestId, success: false, message: error.message || 'Submission could not be saved.' });
    }
  }

  function appendEvent_(values) {
    validateEvent_(values);
    const target = eventDestination_(values.destination);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sheetName = sheetNameByIndex_(target.spreadsheetId, target.sheetIndex);
      const headers = headers_(target.spreadsheetId, sheetName);
      ensureEventHeaders_(headers);
      const serial = nextSerial_(target.spreadsheetId, sheetName, headers);
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMM yyyy HH:mm:ss');
      const generated = { 'Sr. No.': serial, 'Event ID': `EVT-${String(serial).padStart(5, '0')}`, 'Duration (Days)': duration_(values['Start Date'], values['End Date']), 'Created Date': now };
      const row = headers.map((header) => generated.hasOwnProperty(header) ? generated[header] : normalize_(EVENT_FIELDS.find((field) => field.column === header), values[header]));
      sheetsAppend_(target.spreadsheetId, sheetName, row);
    } finally { lock.releaseLock(); }
  }

  function appendLoan_(values) {
    validateLoan_(values);
    const spreadsheetId = required_('LOAN_SPREADSHEET_ID');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sheetName = sheetNameByIndex_(spreadsheetId, 0);
      const headers = headers_(spreadsheetId, sheetName);
      ensureLoanHeaders_(headers);
    const serial = nextSerial_(spreadsheetId, sheetName, headers, LOAN_SERIAL_HEADER);
      const outstanding = Number(values['Total Amount']) - Number(values['Amount Paid'] || 0);
    const generated = { [LOAN_SERIAL_HEADER]: serial, Outstanding: outstanding };
      const row = headers.map((header) => generated.hasOwnProperty(header) ? generated[header] : normalize_(LOAN_FIELDS.find((field) => field.column === header), values[header]));
    sheetsAppend_(spreadsheetId, sheetName, row, LOAN_SERIAL_HEADER);
    } finally { lock.releaseLock(); }
  }

  function eventDestination_(value) {
    const first = required_('FIRST_SPREADSHEET_ID'); const second = required_('SECOND_SPREADSHEET_ID');
    const destinations = { prashant: { spreadsheetId: first, sheetIndex: 2 }, khyati: { spreadsheetId: first, sheetIndex: 1 }, family: { spreadsheetId: first, sheetIndex: 0 }, others: { spreadsheetId: second, sheetIndex: 0 } };
    if (!destinations[value]) throw new Error('Choose a valid timeline.'); return destinations[value];
  }

  function validateEvent_(values) {
    validateFields_(EVENT_FIELDS, values);
    if (values['End Date'] && values['End Date'] < values['Start Date']) throw new Error('End Date cannot be earlier than Start Date.');
  }

  function validateLoan_(values) {
    validateFields_(LOAN_FIELDS.filter((field) => !field.generated), values);
    const total = Number(values['Total Amount']);
    const paid = Number(values['Amount Paid'] || 0);
    if (paid > total) throw new Error('Amount Paid cannot be greater than Total Amount.');
  }

  function validateFields_(fields, values) {
    fields.filter((field) => !field.generated).forEach((field) => {
      const value = values[field.column];
      if (field.required && (value === undefined || value === null || value === '')) throw new Error(`${field.column} is required.`);
      if (value && field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field.column} must be a valid date.`);
      if (value !== '' && value !== undefined && value !== null && field.type === 'currency' && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new Error(`${field.column} must be zero or greater.`);
      if (value && field.type === 'url' && !/^https:\/\/.+/i.test(value)) throw new Error(`${field.column} must be a valid HTTPS URL.`);
      if (field.type === 'choice' && field.options.length && value && field.options.indexOf(value) < 0) throw new Error(`${field.column} has an invalid selection.`);
    });
  }

function nextSerial_(spreadsheetId, sheetName, headers, serialHeader) {
  const header = serialHeader || 'Sr. No.';
  const column = headers.indexOf(header) + 1; if (!column) throw new Error(`The destination sheet must contain a ${header} header.`);
    const sheet = sheet_(spreadsheetId, sheetName); const rowCount = lastDataRow_(sheet, column) - 1;
    const values = rowCount > 0 ? sheet.getRange(2, column, rowCount, 1).getValues() : [];
    return values.reduce((maximum, row) => Math.max(maximum, Number(row[0]) || 0), 0) + 1;
  }

  function ensureEventHeaders_(headers) {
    const expected = ['Sr. No.', 'Event ID'].concat(EVENT_FIELDS.map((field) => field.column), ['Created Date']);
    const missing = expected.filter((header) => headers.indexOf(header) < 0);
    if (missing.length) throw new Error(`Destination sheet is missing: ${missing.join(', ')}`);
  }

  function ensureLoanHeaders_(headers) {
    if (headers.length !== LOAN_HEADERS.length || LOAN_HEADERS.some((header, index) => headers[index] !== header)) throw new Error(`Loan sheet headers must be exactly: ${LOAN_HEADERS.join(', ')}`);
  }

  function duration_(start, end) { if (!start) return ''; const endDate = end || start; return Math.round((Date.parse(endDate + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000) + 1; }
  function postMessageResponse_(response) {
    const message = JSON.stringify(JSON.stringify(response)).replace(/</g, '\\u003c');
    return HtmlService.createHtmlOutput(`<!doctype html><html><body><script>window.top.postMessage(${message}, '*');</script></body></html>`).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  function required_(name) { const value = PROP.getProperty(name); if (!value) throw new Error(`Missing Script Property: ${name}`); return value; }
  function normalize_(field, value) { if (value === undefined || value === null) return ''; return field && field.type === 'currency' ? Number(value) : String(value); }
