import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DayPicker } from 'react-day-picker';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { EVENT_FORM } from './constants.js';
import { submitToAppsScript } from './services/form-submit.js';
import { validateValues } from './services/forms.js';
import './pwa.js';
import './styles.css';
import './pwa.css';
import 'react-day-picker/style.css';

const endpoint = import.meta.env.VITE_APPS_SCRIPT_URL;
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const blankValues = () => Object.fromEntries(EVENT_FORM.fields.flatMap((field) => field.type === 'date-range' ? [[field.startColumn, ''], [field.endColumn, '']] : [[field.column, '']]));
const AUTH_STORAGE_KEY = 'sheet-machine-google-identity';

function decodeIdToken(token) { try { const value = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(atob(value).split('').map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`).join(''))); } catch { return null; } }
function storedIdentity() {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
    const claims = stored?.token && decodeIdToken(stored.token);
    if (!claims?.email || !claims.exp || Number(claims.exp) * 1000 <= Date.now()) throw new Error('Expired identity.');
    return { token: stored.token, email: claims.email, expiresAt: Number(claims.exp) * 1000 };
  } catch { localStorage.removeItem(AUTH_STORAGE_KEY); return null; }
}

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('sheet-machine-theme') || 'system');
  const [identity, setIdentity] = useState(storedIdentity); const [destination, setDestination] = useState(EVENT_FORM.destinations[0].id); const [values, setValues] = useState(blankValues); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false); const [installPrompt, setInstallPrompt] = useState(null);
  useEffect(() => { const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('sheet-machine-theme', theme); }, [theme]);
  const clearIdentity = () => { localStorage.removeItem(AUTH_STORAGE_KEY); setIdentity(null); };
  const renderGoogleButton = () => { const target = document.getElementById('google-signin'); if (target && window.google?.accounts?.id) { target.replaceChildren(); window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', text: 'signin_with' }); } };
  useEffect(() => { window.handleGoogleCredential = ({ credential }) => { const claims = decodeIdToken(credential); if (!claims?.email || !claims.exp) return setError('Google Sign-In did not return a usable identity.'); const next = { token: credential, email: claims.email, expiresAt: Number(claims.exp) * 1000 }; localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next)); setIdentity(next); setError(''); }; if (!clientId) return setError('Missing VITE_GOOGLE_CLIENT_ID configuration.'); const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.onload = () => { window.google.accounts.id.initialize({ client_id: clientId, callback: window.handleGoogleCredential }); renderGoogleButton(); }; document.head.append(script); return () => script.remove(); }, []);
  useEffect(() => { if (!identity) renderGoogleButton(); }, [identity]);
  useEffect(() => { const capture = (event) => { event.preventDefault(); setInstallPrompt(event); }; const installed = () => setInstallPrompt(null); window.addEventListener('beforeinstallprompt', capture); window.addEventListener('appinstalled', installed); return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installed); }; }, []);
  const installApp = async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); };
  const submit = async (event) => { event.preventDefault(); setError(''); setNotice(''); if (!endpoint) return setError('Missing VITE_APPS_SCRIPT_URL configuration.'); if (!identity) return setError('Sign in with your allowed Google account before submitting.'); const issues = validateValues(EVENT_FORM.fields, values); if (Object.keys(issues).length) return setError(Object.values(issues)[0]); setSubmitting(true); try { await submitToAppsScript({ endpoint, formId: EVENT_FORM.id, idToken: identity.token, values: { ...values, destination } }); setValues(blankValues()); setNotice('Event saved successfully.'); } catch (submissionError) { if (/token|sign in|expired|verified/i.test(submissionError.message)) clearIdentity(); setError(submissionError.message); } finally { setSubmitting(false); } };
  return <><iframe className="bridge" name="sheetMachineSubmitFrame" title="Sheet Machine submission target" /><header className="topbar"><a className="brand" href={import.meta.env.BASE_URL}><span className="brand-mark">S</span><span>Sheet Machine</span></a><div className="top-actions">{installPrompt && <button className="install-button" type="button" onClick={installApp}>Install app</button>}<select className="theme-select" aria-label="Color theme" value={theme} onChange={(event) => setTheme(event.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>{identity ? <span className="identity"><span className="presence" />{identity.email}</span> : <div id="google-signin" aria-label="Sign in with Google" />}</div></header><main className="page"><form className="panel" onSubmit={submit}><div className="destination-chips" role="radiogroup" aria-label="Event destination">{EVENT_FORM.destinations.map((item) => <button type="button" role="radio" aria-checked={destination === item.id} className={destination === item.id ? 'chip active' : 'chip'} key={item.id} onClick={() => setDestination(item.id)}><strong>{item.label}</strong></button>)}</div><div className="field-grid">{EVENT_FORM.fields.map((field) => <Field key={field.column} field={field} value={values[field.column]} values={values} onChange={(value) => setValues({ ...values, ...(typeof value === 'object' ? value : { [field.column]: value }) })} />)}</div>{error && <div className="error" role="alert">{error}</div>}{notice && <div className="notice" role="status">✓ {notice}</div>}<div className="form-footer"><button disabled={submitting || !identity}>{submitting ? 'Saving…' : 'Save event →'}</button></div></form></main></>;
}

function Field({ field, value, onChange, values }) {
  const id = `field-${field.column}`; const className = `input-field ${field.span === 2 ? 'wide' : ''}`;
  const choiceSelect = field.type === 'choice' && field.options.length > 0;
  const inputType = field.type === 'currency' ? 'number' : field.type === 'choice' ? 'text' : field.type;
  if (field.type === 'date-range') return <DateRangeField field={field} values={values} onChange={onChange} />;
  if (field.type === 'choice' && field.control === 'chips') return <ChoiceChipField field={field} value={value} onChange={onChange} />;
  if (field.type === 'tags') return <TagsField field={field} value={value} onChange={onChange} />;
  if (field.type === 'people') return <PeopleField field={field} value={value} onChange={onChange} />;
  if (field.type === 'url') return <UrlField field={field} value={value} onChange={onChange} />;
  if (field.type === 'currency') return <CurrencyField field={field} value={value} onChange={onChange} />;
  return <label className={className} htmlFor={id}><span>{field.label}{field.required && <b> *</b>}</span>{field.type === 'textarea' ? <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /> : choiceSelect ? <Select inputId={id} classNamePrefix="search-select" isSearchable options={field.options.map((option) => ({ value: option, label: option }))} value={value ? { value, label: value } : null} onChange={(option) => onChange(option?.value || '')} placeholder="Search or select…" noOptionsMessage={() => 'No matching option'} /> : <input id={id} type={inputType} min={field.min} step={field.type === 'currency' ? '0.01' : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />}{field.type === 'choice' && !choiceSelect && <small>Master choices will be added later.</small>}</label>;
}

function CurrencyField({ field, value, onChange }) {
  return <label className={`input-field ${field.span === 2 ? 'wide' : ''}`}><span>{field.label}</span><div className="currency-control"><span aria-hidden="true">₹</span><input type="number" min={field.min} step="0.01" value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /></div></label>;
}

function ChoiceChipField({ field, value, onChange }) {
  return <div className={`input-field choice-chips-field ${field.span === 2 ? 'wide' : ''}`}><span>{field.label}{field.required && <b> *</b>}</span><div className="choice-chips" role="radiogroup" aria-label={field.label}>{field.options.map((option) => <button key={option} type="button" role="radio" aria-checked={value === option} className={`choice-chip ${field.chipTone} option-${option.toLowerCase().replaceAll(/[^a-z]+/g, '-')}${value === option ? ' active' : ''}`} onClick={() => onChange(option)}><ChoiceIcon field={field.column} option={option} />{option}</button>)}</div></div>;
}

const CHOICE_ICONS = {
  'Event Type': { Personal: '●', Family: '♡', Social: '◉', Professional: '▣' },
  'Emotional Importance': { Low: '↓', Medium: '−', High: '↑', 'Life-Changing': '✦' },
  'Event Status': { Planned: '◷', Ongoing: '◌', Completed: '✓', Cancelled: '×' },
};

function ChoiceIcon({ field, option }) {
  return <span className="choice-chip-icon" aria-hidden="true">{CHOICE_ICONS[field]?.[option] || '•'}</span>;
}

function toLocalDate(value) { if (!value) return undefined; const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); }
function toDateValue(date) { if (!date) return ''; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

function DateRangeField({ field, values, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = { from: toLocalDate(values[field.startColumn]), to: toLocalDate(values[field.endColumn]) };
  const label = selected.from ? `${selected.from.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}${selected.to ? ` → ${selected.to.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ' → Select end date'}` : 'Select start and end dates';
  return <div className="input-field wide range-field"><span>{field.label}{field.required && <b> *</b>}</span><button type="button" className="range-trigger" onClick={() => setOpen(!open)}>{label}<span>⌄</span></button>{open && <div className="calendar-popover"><DayPicker mode="range" min={1} selected={selected.from ? selected : undefined} onSelect={(range) => { onChange({ [field.startColumn]: toDateValue(range?.from), [field.endColumn]: toDateValue(range?.to) }); if (range?.from && range?.to) setOpen(false); }} numberOfMonths={2} captionLayout="dropdown" /><button type="button" className="clear-range" onClick={() => { onChange({ [field.startColumn]: '', [field.endColumn]: '' }); setOpen(false); }}>Clear dates</button></div>}</div>;
}

function TagsField({ field, value, onChange }) {
  const [draft, setDraft] = useState(''); const tags = value ? value.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
  const add = () => { const next = draft.trim().replace(/,/g, ''); if (!next || tags.includes(next)) return setDraft(''); onChange([...tags, next].join(', ')); setDraft(''); };
  return <label className="input-field wide"><span>{field.label}</span><div className="tags-box">{tags.map((tag) => <button type="button" className="tag" key={tag} onClick={() => onChange(tags.filter((item) => item !== tag).join(', '))}>{tag}<span>×</span></button>)}<input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Backspace' && !draft && tags.length) { onChange(tags.slice(0, -1).join(', ')); return; } if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(); } }} onBlur={add} placeholder={field.placeholder} /></div></label>;
}

function PeopleField({ field, value, onChange }) {
  const people = value ? value.split(',').map((name) => name.trim()).filter(Boolean) : [];
  const options = [...new Set([...field.options, ...people])].map((name) => ({ value: name, label: name }));
  return <label className="input-field"><span>{field.label}</span><CreatableSelect classNamePrefix="search-select" isMulti isSearchable options={options} value={people.map((name) => ({ value: name, label: name }))} onChange={(selected) => onChange((selected || []).map((option) => option.value.trim()).filter(Boolean).join(', '))} placeholder={field.placeholder} noOptionsMessage={() => 'Type to add a person'} formatCreateLabel={(name) => `Add “${name}”`} /></label>;
}

function UrlField({ field, value, onChange }) {
  const paste = async () => { try { onChange(await navigator.clipboard.readText()); } catch { /* Clipboard permission was not granted. */ } };
  return <label className="input-field wide"><span>{field.label}</span><div className="url-control"><input type="url" value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /><button type="button" onClick={paste} aria-label="Paste from clipboard" title="Paste from clipboard"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6v2H9zM7 6h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2v11h10V8H7zm3 3h4v2h-4zm0 4h4v2h-4z" /></svg></button></div></label>;
}

createRoot(document.getElementById('root')).render(<App />);
