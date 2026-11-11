import { readFile } from 'node:fs/promises';

const RESPONSE_SOURCE = 'sheet-machine-apps-script';

async function endpointFromEnvFile() {
  try {
    const contents = await readFile('.env', 'utf8');
    return contents.match(/^VITE_APPS_SCRIPT_URL=(.+)$/m)?.[1].trim();
  } catch {
    return undefined;
  }
}

const endpoint = process.argv[2] || process.env.VITE_APPS_SCRIPT_URL || await endpointFromEnvFile();
if (!endpoint) {
  console.error('Usage: npm run debug:apps-script -- https://script.google.com/macros/s/DEPLOYMENT_ID/exec');
  process.exit(2);
}

const requestId = `probe-${Date.now()}`;
const body = new URLSearchParams({ formId: '__bridge_probe__', requestId });

console.log(`Probing ${new URL(endpoint).origin} (no sheet row will be written)…`);
const response = await fetch(endpoint, {
  method: 'POST',
  body,
  redirect: 'follow',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
});
const html = await response.text();
const hasSource = html.includes(RESPONSE_SOURCE);
const hasRequestId = html.includes(requestId);
const usesTopBridge = html.includes('window.top.postMessage');

console.log(`HTTP ${response.status}; final host: ${new URL(response.url).hostname}`);
console.log(`Bridge source: ${hasSource ? 'yes' : 'NO'}; request ID: ${hasRequestId ? 'yes' : 'NO'}; window.top.postMessage: ${usesTopBridge ? 'yes' : 'NO'}`);

if (!response.ok || !hasSource || !hasRequestId || !usesTopBridge) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/\s+/g, ' ').trim();
  const visibleText = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (title) console.error(`Response title: ${title}`);
  if (visibleText) console.error(`Response text: ${visibleText.slice(0, 500)}`);
  console.error(`Response preview: ${html.replace(/\s+/g, ' ').slice(0, 500)}`);
  console.error('FAIL: this deployment cannot produce the confirmation expected by the app. Paste the current apps-script/Code.gs into this Apps Script project and redeploy its /exec URL.');
  process.exitCode = 1;
} else {
  console.log('PASS: this deployment returns a compatible iframe confirmation.');
}
