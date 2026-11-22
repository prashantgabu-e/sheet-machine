/**
 * Command-line-only bulk event import.
 *
 * This path deliberately bypasses Google Identity authentication because it is
 * designed for a trusted automation client. It is protected by the temporary
 * BULK_IMPORT_API_KEY Script Property and is permanently scoped to Prashant.
 */
function assertBulkImportKey_(apiKey) {
  const expected = required_('BULK_IMPORT_API_KEY');
  if (!apiKey || String(apiKey) !== expected) {
    throw new Error('Invalid bulk import API key.');
  }
}

function appendBulkPrashantEvents_(events) {
  if (!Array.isArray(events) || !events.length) {
    throw new Error('At least one event is required.');
  }
  if (events.length > 100) {
    throw new Error('A bulk import can contain at most 100 events.');
  }

  // The endpoint is explicitly limited to the Prashant timeline.
  const target = eventDestination_('prashant');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const sheetName = sheetNameByIndex_(target.spreadsheetId, target.sheetIndex);
    const headers = headers_(target.spreadsheetId, sheetName);
    ensureEventHeaders_(headers);

    const initialSerial = nextSerial_(target.spreadsheetId, sheetName, headers);
    const createdDate = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'dd MMM yyyy HH:mm:ss'
    );

    const rows = events.map((values, index) => {
      validateEvent_(values);

      const serial = initialSerial + index;
      const generated = {
        'Sr. No.': serial,
        'Event ID': `EVT-${String(serial).padStart(5, '0')}`,
        'Duration (Days)': duration_(values['Start Date'], values['End Date']),
        'Created Date': createdDate,
      };

      return headers.map((header) =>
        Object.prototype.hasOwnProperty.call(generated, header)
          ? generated[header]
          : normalize_(
              EVENT_FIELDS.find((field) => field.column === header),
              values[header]
            )
      );
    });

    const sheet = sheet_(target.spreadsheetId, sheetName);
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length)
      .setValues(rows);
  } finally {
    lock.releaseLock();
  }
}
