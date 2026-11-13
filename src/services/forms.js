export function calculateOutstanding(values) {
  const rawTotal = values['Total Amount'];
  if (rawTotal === '' || rawTotal === undefined || rawTotal === null) return '';
  const total = Number(rawTotal);
  const paid = Number(values['Amount Paid'] || 0);
  if (!Number.isFinite(total) || !Number.isFinite(paid)) return '';
  return total - paid;
}

export function formatCurrency(value) {
  if (value === '' || value === undefined || value === null || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value));
}

export function validateValues(fields, values, formId = '') {
  const issues = {};
  fields.filter((field) => field.visible !== false && field.type !== 'calculated-currency').forEach((field) => {
    if (field.type === 'date-range') {
      const start = values[field.startColumn];
      const end = values[field.endColumn];
      if (field.required && !start) issues[field.startColumn] = `${field.label} is required.`;
      if (end && !start) issues[field.startColumn] = 'Choose a start date before the end date.';
      return;
    }
    const value = values[field.column];
    if (field.required && (value === undefined || value === '')) issues[field.column] = `${field.label} is required.`;
    if (value && field.type === 'email' && !/^\S+@\S+\.\S+$/.test(value)) issues[field.column] = 'Enter a valid email address.';
    if (value && field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) issues[field.column] = `${field.label} must be a valid date.`;
    if (value !== '' && value !== undefined && field.type === 'currency' && (!Number.isFinite(Number(value)) || Number(value) < 0)) issues[field.column] = `${field.label} must be zero or greater.`;
    if (value && field.type === 'url' && !/^https:\/\/.+/i.test(value)) issues[field.column] = `${field.label} must be an HTTPS URL.`;
    if (value && field.type === 'choice' && field.options?.length && !field.options.includes(value)) issues[field.column] = `${field.label} has an invalid selection.`;
  });
  if (values['Start Date'] && values['End Date'] && values['End Date'] < values['Start Date']) issues['End Date'] = 'End date cannot be earlier than Start date.';
  if (formId === 'loan-register') {
    const total = Number(values['Total Amount']);
    const paid = Number(values['Amount Paid'] || 0);
    if (Number.isFinite(total) && Number.isFinite(paid) && paid > total) issues['Amount Paid'] = 'Amount paid cannot be greater than total amount.';
  }
  return issues;
}
