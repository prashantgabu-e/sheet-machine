import { describe, expect, it } from 'vitest';
import { validateValues } from './forms.js';

describe('form validation', () => {
  it('rejects missing required values and malformed emails', () => {
    const fields = [
      { column: 'Name', label: 'Name', required: true, visible: true, type: 'text' },
      { column: 'Email', label: 'Email', required: true, visible: true, type: 'email' },
      { column: 'Amount', label: 'Amount', required: false, visible: true, type: 'currency' },
    ];
    expect(Object.keys(validateValues(fields, { Email: 'not-an-email', Amount: '-1' }))).toHaveLength(3);
  });
});
