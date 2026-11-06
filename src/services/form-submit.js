const TIMEOUT_MS = 45_000;
const RESPONSE_SOURCE = 'sheet-machine-apps-script';
function isAppsScriptOrigin(origin) { try { const host = new URL(origin).hostname; return host === 'script.google.com' || host === 'script.googleusercontent.com' || host.endsWith('.googleusercontent.com'); } catch { return false; } }
function parseMessage(value) { if (typeof value === 'string') { try { return JSON.parse(value); } catch { return null; } } return value && typeof value === 'object' ? value : null; }
export function submitToAppsScript({ endpoint, formId, idToken, values }) {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    let form;
    const cleanup = () => { clearTimeout(timeout); window.removeEventListener('message', receive); form?.remove(); };
    const receive = (event) => { if (!isAppsScriptOrigin(event.origin)) return; const message = parseMessage(event.data); if (message?.source !== RESPONSE_SOURCE || message.requestId !== requestId) return; cleanup(); message.success ? resolve(message) : reject(new Error(message.message || 'Submission failed.')); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('The submission timed out. Please try again.')); }, TIMEOUT_MS);
    window.addEventListener('message', receive);
    form = document.createElement('form'); form.method = 'POST'; form.action = endpoint; form.target = 'sheetMachineSubmitFrame'; form.hidden = true;
    Object.entries({ formId, requestId, idToken, values: JSON.stringify(values) }).forEach(([name, value]) => { const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.append(input); });
    document.body.append(form); form.submit();
  });
}
