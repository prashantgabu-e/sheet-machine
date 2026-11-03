const PROP = PropertiesService.getScriptProperties();
const FORM_PREFIX = 'form:';

function doGet() {
  const template = HtmlService.createTemplateFromFile('Bridge');
  template.parentOrigin = required_('PARENT_ORIGIN');
  return template.evaluate().setTitle('Sheet Machine bridge').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function dispatch(action, payload) {
  const actions = { authenticate, listForms, getForm, getPublicForm, importSheet, saveForm, refreshFormSchema, submitForm, listEntries };
  if (!actions[action]) throw new Error('Unsupported request.');
  return actions[action](payload || {});
}

function authenticate({ idToken }) { return identity_(idToken); }
function listForms({ idToken } = {}) { const user = identity_(idToken); const forms = allForms_(); return user.isAdmin ? forms : forms.filter((form) => form.allowedEmails.includes(user.email)); }
function getForm({ idToken, formId }) { const user = requireAdmin_(idToken); return form_(formId); }
function getPublicForm({ idToken, formId }) { const user = identity_(idToken); const form = requireAllowed_(user, formId); if (form.status !== 'published') throw new Error('This form is not accepting submissions.'); return publicForm_(form); }

function importSheet({ idToken, spreadsheetId, sheetName }) { requireAdmin_(idToken); if (!spreadsheetId || !sheetName) throw new Error('Spreadsheet ID and tab name are required.'); const headers = headers_(spreadsheetId, sheetName); const alreadyUsed = allForms_().some((form) => form.spreadsheetId === spreadsheetId && form.sheetName === sheetName); if (alreadyUsed) throw new Error('This sheet tab is already connected to a form.'); return { id: Utilities.getUuid(), name: sheetName, spreadsheetId, sheetName, status: 'draft', allowedEmails: [], fields: fieldsFromHeaders_(headers) }; }
function saveForm({ idToken, form }) { requireAdmin_(idToken); validateForm_(form); if (!form.id) form.id = Utilities.getUuid(); if (form.status === 'published') ensureTimestamp_(form); form.updatedAt = new Date().toISOString(); PROP.setProperty(FORM_PREFIX + form.id, JSON.stringify(form)); return form; }
function refreshFormSchema({ idToken, formId }) { requireAdmin_(idToken); const form = form_(formId); const headers = headers_(form.spreadsheetId, form.sheetName); const old = new Map(form.fields.map((field) => [field.column, field])); form.fields = fieldsFromHeaders_(headers).map((field) => old.get(field.column) || field); form.status = 'draft'; form.updatedAt = new Date().toISOString(); PROP.setProperty(FORM_PREFIX + form.id, JSON.stringify(form)); return form; }
function submitForm({ idToken, formId, values }) { const user = identity_(idToken); const form = requireAllowed_(user, formId); if (form.status !== 'published') throw new Error('This form is closed.'); const headers = headers_(form.spreadsheetId, form.sheetName); validateSubmission_(form, values || {}); const row = headers.map((header) => header === 'Submitted At' ? new Date().toISOString() : normalize_(form.fields.find((field) => field.column === header), values[header])); sheetsAppend_(form.spreadsheetId, form.sheetName, row); return { accepted: true }; }
function listEntries({ idToken, formId }) { requireAdmin_(idToken); const form = form_(formId); const values = sheetsValues_(form.spreadsheetId, quoteSheet_(form.sheetName)); const headers = values.shift() || []; return { headers, rows: values.filter((row) => row.some((cell) => cell !== '')).map((row) => Object.fromEntries(headers.map((header, i) => [header, row[i] || '']))) }; }

function form_(id) { const raw = PROP.getProperty(FORM_PREFIX + id); if (!raw) throw new Error('Form not found.'); return JSON.parse(raw); }
function allForms_() { return Object.entries(PROP.getProperties()).filter(([key]) => key.indexOf(FORM_PREFIX) === 0).map(([, value]) => JSON.parse(value)); }
function publicForm_(form) { return { id: form.id, name: form.name, fields: form.fields }; }
function required_(name) { const value = PROP.getProperty(name); if (!value) throw new Error(`Missing Script Property: ${name}`); return value; }
function requireAdmin_(idToken) { const user = identity_(idToken); if (!user.isAdmin) throw new Error('Administrator access required.'); return user; }
function requireAllowed_(user, formId) { const form = form_(formId); if (!form.allowedEmails.includes(user.email)) throw new Error('Your Google account is not permitted to use this form.'); return form; }
function inferType_(header) { const value = header.toLowerCase(); if (value.indexOf('email') >= 0) return 'email'; if (value.indexOf('phone') >= 0 || value.indexOf('mobile') >= 0) return 'phone'; if (value.indexOf('date') >= 0) return 'date'; if (/age|amount|count/.test(value)) return 'number'; if (/comment|note|description/.test(value)) return 'textarea'; return 'text'; }
function fieldsFromHeaders_(headers) { return headers.filter((column) => column !== 'Submitted At').map((column) => ({ column, label: column, type: inferType_(column), required: false, visible: true, options: [] })); }
function validateForm_(form) { if (!form.name || !form.spreadsheetId || !form.sheetName || !Array.isArray(form.fields)) throw new Error('Form configuration is incomplete.'); if (new Set(form.fields.map((field) => field.column)).size !== form.fields.length) throw new Error('Fields must map to unique sheet columns.'); }
function validateSubmission_(form, values) { form.fields.filter((field) => field.visible).forEach((field) => { const value = values[field.column]; if (field.required && (value === undefined || value === '' || value === false)) throw new Error(`${field.label} is required.`); if (value && field.type === 'email' && !/^\S+@\S+\.\S+$/.test(value)) throw new Error(`${field.label} is not valid.`); if (field.type === 'select' && value && field.options.indexOf(value) < 0) throw new Error(`${field.label} has an invalid selection.`); }); }
function normalize_(field, value) { if (value === undefined || value === null) return ''; return field && field.type === 'checkbox' ? (value ? 'Yes' : 'No') : String(value); }
