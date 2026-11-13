import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DayPicker } from 'react-day-picker';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { APP_NAVIGATION, FORMS } from './constants.js';
import { submitToAppsScript } from './services/form-submit.js';
import { calculateOutstanding, formatCurrency, validateValues } from './services/forms.js';
import './pwa.js';
import './styles.css';
import './date-picker.css';
import './pwa.css';
import 'react-day-picker/style.css';

const endpoint = import.meta.env.VITE_APPS_SCRIPT_URL;
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const AUTH_STORAGE_KEY = 'sheet-machine-google-identity';
const blankValues = (form) => Object.fromEntries(form.fields.flatMap((field) => field.type === 'date-range'
  ? [[field.startColumn, ''], [field.endColumn, '']]
  : [[field.column, field.defaultValue || '']]));

function decodeIdToken(token) {
  try {
    const value = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(value).split('').map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`).join('')));
  } catch { return null; }
}

function storedIdentity() {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
    const claims = stored?.token && decodeIdToken(stored.token);
    if (!claims?.email || !claims.exp || Number(claims.exp) * 1000 <= Date.now()) throw new Error('Expired identity.');
    return { token: stored.token, email: claims.email, expiresAt: Number(claims.exp) * 1000 };
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('sheet-machine-theme') || 'system');
  const [identity, setIdentity] = useState(null);
  const [authState, setAuthState] = useState('checking');
  const [authError, setAuthError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const googleButtonRef = useRef(null);

  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('sheet-machine-theme', theme);
  }, [theme]);

  const clearIdentity = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.google?.accounts?.id?.disableAutoSelect();
    setIdentity(null);
    setAuthState('signed-out');
  }, []);

  const authorizeIdentity = useCallback(async (nextIdentity) => {
    if (!endpoint) throw new Error('Missing VITE_APPS_SCRIPT_URL configuration.');
    await submitToAppsScript({ endpoint, formId: 'auth-check', idToken: nextIdentity.token, values: {} });
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextIdentity));
    setIdentity(nextIdentity);
    setAuthError('');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const saved = storedIdentity();
      if (!saved) {
        if (!cancelled) setAuthState('signed-out');
        return;
      }
      try {
        await authorizeIdentity(saved);
        if (!cancelled) setAuthState('authenticated');
      } catch (error) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        if (!cancelled) {
          setIdentity(null);
          setAuthError(error.message || 'Your saved session could not be verified.');
          setAuthState('signed-out');
        }
      }
    };
    restore();
    return () => { cancelled = true; };
  }, [authorizeIdentity]);

  useEffect(() => {
    if (!clientId) {
      setAuthError('Missing VITE_GOOGLE_CLIENT_ID configuration.');
      return undefined;
    }
    const initialize = () => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          const claims = decodeIdToken(credential);
          if (!claims?.email || !claims.exp) {
            setAuthError('Google Sign-In did not return a usable identity.');
            return;
          }
          setAuthState('authorizing');
          setAuthError('');
          try {
            await authorizeIdentity({ token: credential, email: claims.email, expiresAt: Number(claims.exp) * 1000 });
            setAuthState('authenticated');
          } catch (error) {
            clearIdentity();
            setAuthError(error.message || 'Your Google account is not authorized.');
          }
        },
      });
      setGoogleReady(true);
    };
    if (window.google?.accounts?.id) initialize();
    else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = initialize;
      document.head.append(script);
      return () => script.remove();
    }
    return undefined;
  }, [authorizeIdentity, clearIdentity]);

  useEffect(() => {
    if (!googleReady || authState !== 'signed-out' || !googleButtonRef.current || !window.google?.accounts?.id) return;
    googleButtonRef.current.replaceChildren();
    window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', text: 'signin_with', width: 280 });
  }, [authState, googleReady]);

  useEffect(() => {
    const capture = (event) => { event.preventDefault(); setInstallPrompt(event); };
    const installed = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return <>
    <iframe className="bridge" name="sheetMachineSubmitFrame" title="Sheet Machine submission target" />
    {identity
      ? <ApplicationShell identity={identity} theme={theme} setTheme={setTheme} onLogout={clearIdentity} installPrompt={installPrompt} onInstall={installApp} />
      : <LoginScreen authState={authState} error={authError} buttonRef={googleButtonRef} />}
  </>;
}

function LoginScreen({ authState, error, buttonRef }) {
  const waiting = authState === 'checking' || authState === 'authorizing';
  return <main className="login-page">
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-mark">S</div>
      <p className="eyebrow">SHEET MACHINE</p>
      <h1 id="login-title">Welcome back</h1>
      <p>Sign in with your authorized Google account to record events and loans.</p>
      {waiting ? <div className="auth-progress" role="status">Verifying your access…</div> : <div ref={buttonRef} className="google-signin" aria-label="Sign in with Google" />}
      {error && <div className="error" role="alert">{error}</div>}
    </section>
  </main>;
}

function ApplicationShell({ identity, theme, setTheme, onLogout, installPrompt, onInstall }) {
  const [activeFormId, setActiveFormId] = useState('event-register');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const form = FORMS[activeFormId];
  const navigate = (nextId) => { setActiveFormId(nextId); setSidebarOpen(false); };
  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Primary navigation">
      <a className="brand sidebar-brand" href={import.meta.env.BASE_URL}><span className="brand-mark">S</span><span>Sheet Machine</span></a>
      <nav className="sidebar-nav">
        <p>Workspace</p>
        {APP_NAVIGATION.map((item) => <button key={item.id} type="button" className={activeFormId === item.id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
      </nav>
      <div className="sidebar-account"><span className="presence" /><span title={identity.email}>{identity.email}</span></div>
    </aside>
    {sidebarOpen && <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <section className="app-content">
      <header className="topbar">
        <button type="button" className="menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>☰</button>
        <div className="top-actions">
          {installPrompt && <button className="install-button" type="button" onClick={onInstall}>Install app</button>}
          <select className="theme-select" aria-label="Color theme" value={theme} onChange={(event) => setTheme(event.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
          <button className="logout-button" type="button" onClick={onLogout}>Log out</button>
        </div>
      </header>
      <main className="page"><FormPage key={form.id} form={form} identity={identity} /></main>
    </section>
  </div>;
}

function FormPage({ form, identity }) {
  const [values, setValues] = useState(() => blankValues(form));
  const [destination, setDestination] = useState(form.destinations?.[0]?.id || '');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isLoanForm = form.id === 'loan-register';
  const setFieldValue = (field, value) => setValues((current) => ({ ...current, ...(typeof value === 'object' ? value : { [field.column]: value }) }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!endpoint) return setError('Missing VITE_APPS_SCRIPT_URL configuration.');
    const issues = validateValues(form.fields, values, form.id);
    if (Object.keys(issues).length) return setError(Object.values(issues)[0]);
    const submissionValues = { ...values, ...(form.destinations ? { destination } : {}) };
    if (isLoanForm) submissionValues.Outstanding = calculateOutstanding(values);
    setSubmitting(true);
    try {
      await submitToAppsScript({ endpoint, formId: form.id, idToken: identity.token, values: submissionValues });
      setValues(blankValues(form));
      setNotice(isLoanForm ? 'Loan saved successfully.' : 'Event saved successfully.');
    } catch (submissionError) {
      setError(submissionError.message);
    } finally { setSubmitting(false); }
  };

  return <>
    <div className="page-heading"><p className="eyebrow">{isLoanForm ? 'MONEY TRACKING' : 'MEMORY TIMELINE'}</p><h1>{form.label}</h1><p>{form.description}</p></div>
    <form className="panel" onSubmit={submit}>
      {form.destinations && <div className="destination-chips" role="radiogroup" aria-label="Event destination">{form.destinations.map((item) => <button type="button" role="radio" aria-checked={destination === item.id} className={destination === item.id ? 'chip active' : 'chip'} key={item.id} onClick={() => setDestination(item.id)}><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div>}
      <div className="field-grid">{form.fields.map((field) => <Field key={field.column} field={field} value={values[field.column]} values={values} onChange={(value) => setFieldValue(field, value)} />)}</div>
      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">✓ {notice}</div>}
      <div className="form-footer"><p>{isLoanForm ? 'Outstanding is calculated automatically.' : 'Your event is saved to the selected timeline.'}</p><button disabled={submitting}>{submitting ? 'Saving…' : `${form.submitLabel} →`}</button></div>
    </form>
  </>;
}

function Field({ field, value, onChange, values }) {
  const id = `field-${field.column.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const className = `input-field ${field.span === 2 ? 'wide' : ''}`;
  const choiceSelect = field.type === 'choice' && field.options.length > 0;
  if (field.type === 'date-range') return <DateRangeField field={field} values={values} onChange={onChange} />;
  if (field.type === 'choice' && field.control === 'chips') return <ChoiceChipField field={field} value={value} onChange={onChange} />;
  if (field.type === 'tags') return <TagsField field={field} value={value} onChange={onChange} />;
  if (field.type === 'people') return <PeopleField field={field} value={value} onChange={onChange} />;
  if (field.type === 'person') return <PersonField field={field} value={value} onChange={onChange} />;
  if (field.type === 'url') return <UrlField field={field} value={value} onChange={onChange} />;
  if (field.type === 'currency') return <CurrencyField field={field} value={value} onChange={onChange} />;
  if (field.type === 'calculated-currency') return <CalculatedCurrencyField field={field} values={values} />;
  return <label className={className} htmlFor={id}><FieldLabel field={field} />
    {field.type === 'textarea' ? <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
      : choiceSelect ? <Select inputId={id} classNamePrefix="search-select" isSearchable options={field.options.map((option) => ({ value: option, label: option }))} value={value ? { value, label: value } : null} onChange={(option) => onChange(option?.value || '')} placeholder="Search or select…" noOptionsMessage={() => 'No matching option'} />
        : <input id={id} type={field.type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />}
  </label>;
}

function FieldLabel({ field }) { return <span>{field.label}{field.required && <b> *</b>}</span>; }

function CurrencyField({ field, value, onChange }) {
  return <label className={`input-field ${field.span === 2 ? 'wide' : ''}`}><FieldLabel field={field} /><div className="currency-control"><span aria-hidden="true">₹</span><input type="number" min={field.min} step="0.01" value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /></div></label>;
}

function CalculatedCurrencyField({ field, values }) {
  return <div className={`input-field calculated-field ${field.span === 2 ? 'wide' : ''}`}><FieldLabel field={field} /><output>{formatCurrency(calculateOutstanding(values))}</output></div>;
}

function PersonField({ field, value, onChange }) {
  const options = [...new Set([...field.options, ...(value ? [value] : [])])].map((name) => ({ value: name, label: name }));
  return <label className={`input-field ${field.span === 2 ? 'wide' : ''}`}><FieldLabel field={field} /><CreatableSelect classNamePrefix="search-select" isSearchable options={options} value={value ? { value, label: value } : null} onChange={(selected) => onChange(selected?.value?.trim() || '')} placeholder={field.placeholder} noOptionsMessage={() => 'Type to add a person'} formatCreateLabel={(name) => `Add “${name}”`} /></label>;
}

function ChoiceChipField({ field, value, onChange }) {
  return <div className={`input-field choice-chips-field ${field.span === 2 ? 'wide' : ''}`}><FieldLabel field={field} /><div className="choice-chips" role="radiogroup" aria-label={field.label}>{field.options.map((option) => <button key={option} type="button" role="radio" aria-checked={value === option} className={`choice-chip ${field.chipTone} option-${option.toLowerCase().replaceAll(/[^a-z]+/g, '-')}${value === option ? ' active' : ''}`} onClick={() => onChange(option)}><ChoiceIcon field={field.column} option={option} />{option}</button>)}</div></div>;
}

const CHOICE_ICONS = {
  'Event Type': { Personal: '●', Family: '♡', Social: '◉', Professional: '▣' },
  'Emotional Importance': { Low: '↓', Medium: '−', High: '↑', 'Life-Changing': '✦' },
  'Event Status': { Planned: '◷', Ongoing: '◌', Completed: '✓', Cancelled: '×' },
};

function ChoiceIcon({ field, option }) { return <span className="choice-chip-icon" aria-hidden="true">{CHOICE_ICONS[field]?.[option] || '•'}</span>; }
function toLocalDate(value) { if (!value) return undefined; const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); }
function toDateValue(date) { if (!date) return ''; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

function DateRangeField({ field, values, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = { from: toLocalDate(values[field.startColumn]), to: toLocalDate(values[field.endColumn]) };
  const label = selected.from ? `${selected.from.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}${selected.to ? ` → ${selected.to.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ' → Select end date'}` : 'Select start and end dates';
  return <div className="input-field wide range-field"><FieldLabel field={field} /><button type="button" className="range-trigger" onClick={() => setOpen(!open)}>{label}<span>⌄</span></button>{open && <div className="calendar-popover"><DayPicker mode="range" min={0} selected={selected.from ? selected : undefined} onSelect={(range) => { onChange({ [field.startColumn]: toDateValue(range?.from), [field.endColumn]: toDateValue(range?.to) }); if (range?.from && range?.to) setOpen(false); }} numberOfMonths={2} captionLayout="dropdown" /><button type="button" className="clear-range" onClick={() => { onChange({ [field.startColumn]: '', [field.endColumn]: '' }); setOpen(false); }}>Clear dates</button></div>}</div>;
}

function TagsField({ field, value, onChange }) {
  const [draft, setDraft] = useState(''); const tags = value ? value.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
  const add = () => { const next = draft.trim().replace(/,/g, ''); if (!next || tags.includes(next)) return setDraft(''); onChange([...tags, next].join(', ')); setDraft(''); };
  return <label className="input-field wide"><FieldLabel field={field} /><div className="tags-box">{tags.map((tag) => <button type="button" className="tag" key={tag} onClick={() => onChange(tags.filter((item) => item !== tag).join(', '))}>{tag}<span>×</span></button>)}<input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Backspace' && !draft && tags.length) { onChange(tags.slice(0, -1).join(', ')); return; } if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(); } }} onBlur={add} placeholder={field.placeholder} /></div></label>;
}

function PeopleField({ field, value, onChange }) {
  const people = value ? value.split(',').map((name) => name.trim()).filter(Boolean) : [];
  const options = [...new Set([...field.options, ...people])].map((name) => ({ value: name, label: name }));
  return <label className="input-field"><FieldLabel field={field} /><CreatableSelect classNamePrefix="search-select" isMulti isSearchable options={options} value={people.map((name) => ({ value: name, label: name }))} onChange={(selected) => onChange((selected || []).map((option) => option.value.trim()).filter(Boolean).join(', '))} placeholder={field.placeholder} noOptionsMessage={() => 'Type to add a person'} formatCreateLabel={(name) => `Add “${name}”`} /></label>;
}

function UrlField({ field, value, onChange }) {
  const paste = async () => { try { onChange(await navigator.clipboard.readText()); } catch { /* Clipboard permission was not granted. */ } };
  return <label className="input-field wide"><FieldLabel field={field} /><div className="url-control"><input type="url" value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /><button type="button" onClick={paste} aria-label="Paste from clipboard" title="Paste from clipboard"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6v2H9zM7 6h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2v11h10V8H7zm3 3h4v2h-4zm0 4h4v2h-4z" /></svg></button></div></label>;
}

createRoot(document.getElementById('root')).render(<App />);
