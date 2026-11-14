import { describe, expect, it } from 'vitest';
import { APP_NAVIGATION, EVENT_FORM, LOAN_FORM } from '../constants.js';
import { calculateOutstanding, validateValues } from './forms.js';

describe('form validation', () => {
  it('rejects missing required values and malformed emails', () => {
    const fields = [
      { column: 'Name', label: 'Name', required: true, visible: true, type: 'text' },
      { column: 'Email', label: 'Email', required: true, visible: true, type: 'email' },
      { column: 'Amount', label: 'Amount', required: false, visible: true, type: 'currency' },
    ];
    expect(Object.keys(validateValues(fields, { Email: 'not-an-email', Amount: '-1' }))).toHaveLength(3);
  });

  it('validates loan choices and prevents overpayment', () => {
    const values = {
      'Date Transferred': '2026-01-05',
      Sender: 'Mummy',
      Receiver: 'Alpesh',
      'Loan Type': 'Personal',
      Status: 'Active',
      'Total Amount': '100000',
      'Amount Paid': '100001',
      'Amount Paid On': '2026-01-06',
    };
    expect(validateValues(LOAN_FORM.fields, values, LOAN_FORM.id)['Amount Paid']).toBe('Amount paid cannot be greater than total amount.');
    expect(calculateOutstanding({ 'Total Amount': '100000', 'Amount Paid': '8885' })).toBe(91115);
    expect(validateValues(LOAN_FORM.fields, { ...values, 'Loan Type': 'Invalid', 'Amount Paid': '0' }, LOAN_FORM.id)['Loan Type']).toBe('Loan type has an invalid selection.');
  });

  it('starts the sidebar with Event Logs and has no dashboard item', () => {
    expect(APP_NAVIGATION.map((item) => item.label)).toEqual(['Event Logs', 'Loan Register']);
  });

  it('defines the requested initial choices for new forms', () => {
    expect(EVENT_FORM.fields.find((field) => field.column === 'Event Type').defaultValue).toBe('Personal');
    expect(EVENT_FORM.fields.find((field) => field.column === 'Event Status').defaultValue).toBe('Completed');
    expect(LOAN_FORM.fields.find((field) => field.column === 'Loan Type').defaultValue).toBe('Personal');
    expect(LOAN_FORM.fields.find((field) => field.column === 'Status').defaultValue).toBe('Active');
    expect(LOAN_FORM.fields.find((field) => field.column === 'Date Transferred').defaultValue).toBe('today');
  });
});
