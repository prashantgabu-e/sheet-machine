export function validateValues(fields, values) {
  const issues = {};
  fields.filter((field) => field.visible).forEach((field) => {
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
    if (value && field.type === 'currency' && (!Number.isFinite(Number(value)) || Number(value) < 0)) issues[field.column] = `${field.label} must be zero or greater.`;
    if (value && field.type === 'url' && !/^https:\/\/.+/i.test(value)) issues[field.column] = `${field.label} must be an HTTPS URL.`;
  });
  if (values['Start Date'] && values['End Date'] && values['End Date'] < values['Start Date']) issues['End Date'] = 'End date cannot be earlier than Start date.';
  return issues;
}
