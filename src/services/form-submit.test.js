import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitToAppsScript } from './form-submit.js';

describe('Apps Script submissions', () => {
  beforeEach(() => {
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('uses the no-write auth-check form before entering the app', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'auth-request' });
    const pending = submitToAppsScript({ endpoint: 'https://script.google.com/macros/s/example/exec', formId: 'auth-check', idToken: 'token', values: {} });
    const form = document.querySelector('form');
    expect(form.action).toBe('https://script.google.com/macros/s/example/exec');
    expect(form.querySelector('input[name="formId"]').value).toBe('auth-check');
    expect(form.querySelector('input[name="values"]').value).toBe('{}');
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://script.google.com', data: JSON.stringify({ source: 'sheet-machine-apps-script', requestId: 'auth-request', success: true }) }));
    await expect(pending).resolves.toMatchObject({ success: true });
  });

  it('submits loan-register values through the existing bridge', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'loan-request' });
    const pending = submitToAppsScript({ endpoint: 'https://script.google.com/macros/s/example/exec', formId: 'loan-register', idToken: 'token', values: { 'Total Amount': '100000' } });
    expect(document.querySelector('input[name="formId"]').value).toBe('loan-register');
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://script.googleusercontent.com', data: { source: 'sheet-machine-apps-script', requestId: 'loan-request', success: true } }));
    await expect(pending).resolves.toMatchObject({ success: true });
  });
});
