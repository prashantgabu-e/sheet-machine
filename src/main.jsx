import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DatePicker from 'react-datepicker';
import Select, { components } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { APP_NAVIGATION, FORMS } from './constants.js';
import { submitToAppsScript } from './services/form-submit.js';
import { calculateOutstanding, formatCurrency, validateValues } from './services/forms.js';
import './pwa.js';
import './styles.css';
import './pwa.css';
import './ui.css';
import './ui-refinements.css';
import 'react-datepicker/dist/react-datepicker.css';

const endpoint = import.meta.env.VITE_APPS_SCRIPT_URL;
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const AUTH_STORAGE_KEY = 'sheet-machine-google-identity';
const AUTO_LOGIN_DISABLED_KEY = 'sheet-machine-auto-login-disabled';
const spring = { type: 'spring', stiffness: 420, damping: 30 };
const selectStyles = { menuPortal: (base) => ({ ...base, zIndex: 40 }) };
const localToday = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};
const fieldDefaultValue = (field) => field.defaultValue === 'today' ? localToday() : field.defaultValue || '';
const blankValues = (form) => Object.fromEntries(form.fields.flatMap((field) => field.type === 'date-range'
  ? [[field.startColumn, ''], [field.endColumn, '']]
  : [[field.column, fieldDefaultValue(field)]]));

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
  const [installed, setInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);
  const [installHint, setInstallHint] = useState('');
  const googleButtonRef = useRef(null);
  const autoLoginDisabled = useRef(sessionStorage.getItem(AUTO_LOGIN_DISABLED_KEY) === 'true');

  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('sheet-machine-theme', theme);
  }, [theme]);

  const clearIdentity = useCallback(() => {
    autoLoginDisabled.current = true;
    sessionStorage.setItem(AUTO_LOGIN_DISABLED_KEY, 'true');
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.google?.accounts?.id?.disableAutoSelect();
    setIdentity(null);
    setAuthState('signed-out');
  }, []);

  const authorizeIdentity = useCallback(async (nextIdentity) => {
    if (!endpoint) throw new Error('Missing VITE_APPS_SCRIPT_URL configuration.');
    await submitToAppsScript({ endpoint, formId: 'auth-check', idToken: nextIdentity.token, values: {} });
    autoLoginDisabled.current = false;
    sessionStorage.removeItem(AUTO_LOGIN_DISABLED_KEY);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextIdentity));
    setIdentity(nextIdentity);
    setAuthError('');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const saved = storedIdentity();
      if (!saved) return !cancelled && setAuthState('signed-out');
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
        auto_select: true,
        callback: async ({ credential }) => {
          const claims = decodeIdToken(credential);
          if (!claims?.email || !claims.exp) return setAuthError('Google Sign-In did not return a usable identity.');
          setAuthState('authorizing'); setAuthError('');
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
      script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.onload = initialize;
      document.head.append(script);
      return () => script.remove();
    }
    return undefined;
  }, [authorizeIdentity, clearIdentity]);

  useEffect(() => {
    if (!googleReady || authState !== 'signed-out' || autoLoginDisabled.current || !window.google?.accounts?.id) return;
    window.google.accounts.id.prompt();
  }, [authState, googleReady]);

  useEffect(() => {
    if (!identity) return undefined;
    const renewIn = Math.max(0, identity.expiresAt - Date.now() - (5 * 60 * 1000));
    const timer = window.setTimeout(() => {
      setIdentity(null);
      setAuthState('signed-out');
    }, renewIn);
    return () => window.clearTimeout(timer);
  }, [identity]);

  useEffect(() => {
    if (!googleReady || authState !== 'signed-out' || !googleButtonRef.current || !window.google?.accounts?.id) return;
    googleButtonRef.current.replaceChildren();
    window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', text: 'signin_with', width: 280 });
  }, [authState, googleReady]);

  useEffect(() => {
    const capture = (event) => { event.preventDefault(); setInstallPrompt(event); };
    const onInstalled = () => { setInstallPrompt(null); setInstalled(true); setInstallHint('Sheet Machine is installed.'); };
    window.addEventListener('beforeinstallprompt', capture); window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const installApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      setInstallHint(choice.outcome === 'accepted' ? 'Installing Sheet Machine…' : 'Install was cancelled.');
      return;
    }
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setInstallHint(isIos ? 'In Safari, tap Share, then choose “Add to Home Screen”.' : 'Use your browser menu and choose “Install Sheet Machine”.');
  };
  return <><iframe className="bridge" name="sheetMachineSubmitFrame" title="Sheet Machine submission target" />
    {identity ? <ApplicationShell identity={identity} theme={theme} setTheme={setTheme} onLogout={clearIdentity} canPromptInstall={Boolean(installPrompt)} installed={installed} installHint={installHint} onInstall={installApp} /> : <LoginScreen authState={authState} error={authError} buttonRef={googleButtonRef} />}
  </>;
}

function LoginScreen({ authState, error, buttonRef }) {
  const reduceMotion = useReducedMotion();
  const waiting = authState === 'checking' || authState === 'authorizing';
  return <main className="login-page"><motion.section className="login-card" aria-labelledby="login-title" initial={reduceMotion ? false : { opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .42, ease: [0.22, 1, 0.36, 1] }}>
    <div className="login-mark">S</div><p className="eyebrow">SHEET MACHINE</p><h1 id="login-title">Welcome back</h1>
    <p>Sign in with your authorized Google account to record events and loans.</p>
    {waiting ? <div className="auth-progress" role="status"><Spinner /> Verifying your access…</div> : <div ref={buttonRef} className="google-signin" aria-label="Sign in with Google" />}
    {error && <div className="error" role="alert">{error}</div>}
  </motion.section></main>;
}

function ApplicationShell({ identity, theme, setTheme, onLogout, canPromptInstall, installed, installHint, onInstall }) {
  const [activeFormId, setActiveFormId] = useState('event-register');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const form = FORMS[activeFormId];
  const navigate = (nextId) => { setActiveFormId(nextId); setSidebarOpen(false); };
  return <div className="app-shell"><aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Primary navigation">
    <a className="brand sidebar-brand" href={import.meta.env.BASE_URL}><span className="brand-mark">S</span><span>Sheet Machine</span></a>
    <nav className="sidebar-nav"><p>Workspace</p>{APP_NAVIGATION.map((item) => <motion.button key={item.id} type="button" className={activeFormId === item.id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.id)} whileTap={{ scale: .97 }}><span aria-hidden="true">{item.icon}</span>{item.label}</motion.button>)}</nav>
    <div className="sidebar-account"><span className="presence" /><span title={identity.email}>{identity.email}</span></div>
  </aside>{sidebarOpen && <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <section className="app-content">
      <header className="topbar">
        <button type="button" className="menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>☰</button>
        <div className="top-actions">
          {!installed && <button className="install-button" type="button" onClick={onInstall}>{canPromptInstall ? 'Install app' : 'Install help'}</button>}
          <select className="theme-select" aria-label="Color theme" value={theme} onChange={(event) => setTheme(event.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
          <button className="logout-button" type="button" onClick={onLogout}>Log out</button>
        </div>
      </header>
      {installHint && <div className="install-hint" role="status">{installHint}</div>}
      <main className="page"><FormPage key={form.id} form={form} identity={identity} /></main>
    </section>
  </div>;
}

function FormPage({ form, identity }) {
  const [values, setValues] = useState(() => blankValues(form));
  const [destination, setDestination] = useState(form.destinations?.[0]?.id || '');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);
  const reduceMotion = useReducedMotion();
  const isLoanForm = form.id === 'loan-register';
  useEffect(() => { const timer = setTimeout(() => setReady(true), reduceMotion ? 0 : 240); return () => clearTimeout(timer); }, [reduceMotion]);
  useEffect(() => { if (!toast) return undefined; const timer = setTimeout(() => setToast(null), 3400); return () => clearTimeout(timer); }, [toast]);
  const setFieldValue = (field, value) => {
    const errorKey = field.type === 'date-range' ? field.startColumn : field.column;
    setValues((current) => ({ ...current, ...(typeof value === 'object' ? value : { [field.column]: value }) }));
    setFieldErrors((current) => { const next = { ...current }; delete next[errorKey]; return next; });
  };
  const submit = async (event) => {
    event.preventDefault(); setError(''); setFieldErrors({});
    if (!endpoint) return setError('Missing VITE_APPS_SCRIPT_URL configuration.');
    const issues = validateValues(form.fields, values, form.id);
    if (Object.keys(issues).length) { const message = Object.values(issues)[0]; setFieldErrors(issues); setToast({ type: 'error', message }); return; }
    const submissionValues = { ...values, ...(form.destinations ? { destination } : {}) };
    if (isLoanForm) submissionValues.Outstanding = calculateOutstanding(values);
    setSaveState('saving');
    try {
      await submitToAppsScript({ endpoint, formId: form.id, idToken: identity.token, values: submissionValues });
      setValues(blankValues(form)); setSaveState('success'); setToast({ type: 'success', message: isLoanForm ? 'Loan saved successfully.' : 'Event saved successfully.' });
      setTimeout(() => setSaveState('idle'), 1200);
    } catch (submissionError) { setSaveState('idle'); setError(submissionError.message); setToast({ type: 'error', message: submissionError.message }); }
  };
  return <><AnimatePresence mode="wait">{ready ? <motion.div key="form" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .3 }}>
    <form className={`panel ${error ? 'has-error' : ''}`} onSubmit={submit}>
      {form.destinations && <DestinationTabs destinations={form.destinations} destination={destination} onChange={setDestination} />}
      <motion.div key={form.destinations ? destination : form.id} className="field-grid" initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: reduceMotion ? 0 : .04 } } }}>{form.fields.map((field) => { const fieldError = fieldErrors[field.type === 'date-range' ? field.startColumn : field.column]; return <motion.div key={field.column} variants={{ hidden: { opacity: 0, y: 7 }, visible: { opacity: 1, y: 0 } }}><Field field={field} value={values[field.column]} values={values} onChange={(value) => setFieldValue(field, value)} /><AnimatePresence>{fieldError && <motion.p className="field-error" role="alert" initial={{ opacity: 0, height: 0, y: -4 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0 }}>{fieldError}</motion.p>}</AnimatePresence></motion.div>; })}</motion.div>
      <AnimatePresence>{error && <motion.div className="error inline-error" role="alert" initial={{ opacity: 0, height: 0, y: -4 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0 }}>{error}</motion.div>}</AnimatePresence>
      <div className="form-footer"><p>{isLoanForm ? 'Outstanding is calculated automatically.' : 'Your event is saved to the selected timeline.'}</p><SaveButton state={saveState} label={form.submitLabel} /></div>
    </form>
  </motion.div> : <FormSkeleton />}</AnimatePresence><Toast toast={toast} /></>;
}

function DestinationTabs({ destinations, destination, onChange }) { return <div className="destination-chips" role="radiogroup" aria-label="Event destination">{destinations.map((item) => <motion.button type="button" role="radio" aria-checked={destination === item.id} className={destination === item.id ? 'chip active' : 'chip'} key={item.id} onClick={() => onChange(item.id)} whileHover={{ y: -1 }} whileTap={{ scale: .98 }}>{destination === item.id && <motion.span className="chip-indicator" layoutId="destination-indicator" transition={spring} />}<span className="chip-content"><strong>{item.label}</strong></span></motion.button>)}</div>; }

function SaveButton({ state, label }) { return <motion.button className={`save-button ${state}`} disabled={state !== 'idle'} whileTap={state === 'idle' ? { scale: .97 } : undefined} type="submit"><AnimatePresence mode="wait" initial={false}>{state === 'saving' ? <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Spinner /> Saving…</motion.span> : state === 'success' ? <motion.span key="success" initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>✓ Saved</motion.span> : <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{label} <b>→</b></motion.span>}</AnimatePresence></motion.button>; }
function Spinner() { return <i className="spinner" aria-hidden="true" />; }
function Toast({ toast }) { return <AnimatePresence>{toast && <motion.div className={`toast ${toast.type}`} role="status" initial={{ opacity: 0, y: 16, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .96 }} transition={{ duration: .22 }}><span>{toast.type === 'success' ? '✓' : '!'}</span>{toast.message}</motion.div>}</AnimatePresence>; }
function FormSkeleton() { return <div className="skeleton-wrap" aria-label="Loading form"><div className="skeleton heading" /><div className="skeleton subheading" /><div className="panel skeleton-panel"><div className="skeleton tabs" />{Array.from({ length: 8 }, (_, index) => <div key={index} className={`skeleton field field-${index}`} />)}</div></div>; }

function Field({ field, value, onChange, values }) {
  const id = `field-${field.column.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const className = `input-field ${field.span === 2 ? 'wide' : ''}`;
  const choiceSelect = field.type === 'choice' && field.options.length > 0;
  if (field.type === 'date-range') return <DateRangeField field={field} values={values} onChange={onChange} />;
  if (field.type === 'choice' && field.control === 'chips') return <ChoiceChipField field={field} value={value} onChange={onChange} />;
  if (field.type === 'tags') return <TagsField field={field} value={value} onChange={onChange} />;
  if (field.type === 'people') return <PeopleField field={field} value={value} onChange={onChange} />;
  if (field.type === 'person') return <PersonField field={field} value={value} onChange={onChange} />;
  if (field.type === 'location') return <LocationField field={field} value={value} onChange={onChange} />;
  if (field.type === 'url') return <UrlField field={field} value={value} onChange={onChange} />;
  if (field.type === 'currency') return <CurrencyField field={field} value={value} onChange={onChange} />;
  if (field.type === 'calculated-currency') return <CalculatedCurrencyField field={field} values={values} />;
  return <label className={className} htmlFor={id}><FieldLabel field={field} />{field.type === 'textarea' ? <AutoGrowTextarea id={id} value={value} onChange={onChange} placeholder={field.placeholder} /> : choiceSelect ? <AnimatedSelect inputId={id} field={field} value={value} onChange={onChange} /> : field.type === 'date' ? <DateTextField id={id} value={value} onChange={onChange} /> : <input id={id} type={field.type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />}</label>;
}

function FieldLabel({ field }) { return <span className="field-label">{field.label}{field.required && <b> *</b>}</span>; }
function DateTextField({ id, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selectDate = (date) => { onChange(toDateValue(date)); setOpen(false); };
  return <div className="date-control"><DatePicker id={id} selected={toLocalDate(value)} onChange={selectDate} open={open} onInputClick={() => setOpen(true)} onClickOutside={() => setOpen(false)} dateFormat="dd/MM/yyyy" placeholderText="DD/MM/YYYY" className="date-text-input" calendarClassName="sheet-datepicker" popperClassName="sheet-datepicker-popper" showPopperArrow={false} shouldCloseOnSelect /></div>;
}
function AnimatedSelect({ inputId, field, value, onChange }) { return <Select inputId={inputId} classNamePrefix="search-select" isSearchable options={field.options.map((option) => ({ value: option, label: option }))} value={value ? { value, label: value } : null} onChange={(option) => onChange(option?.value || '')} placeholder="Search or select…" noOptionsMessage={() => 'No matching option'} components={{ Option: SelectOption }} menuPortalTarget={document.body} menuPosition="fixed" styles={selectStyles} />; }
function SelectOption(props) { return <components.Option {...props}><span><HighlightMatch text={String(props.children)} query={props.selectProps.inputValue} /></span>{props.isSelected && <span className="select-check">✓</span>}</components.Option>; }
function HighlightMatch({ text, query }) { if (!query) return text; const pieces = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig')); return <>{pieces.map((piece, index) => piece.toLowerCase() === query.toLowerCase() ? <mark key={index}>{piece}</mark> : piece)}</>; }

function CurrencyField({ field, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const displayValue = focused || value === '' ? value : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value));
  return <label className={`input-field ${field.span === 2 ? 'wide' : ''}`}><FieldLabel field={field} /><div className="currency-control"><span aria-hidden="true">₹</span><input inputMode="decimal" value={displayValue} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(event) => onChange(event.target.value.replaceAll(',', ''))} placeholder={field.placeholder} /></div></label>;
}
function CalculatedCurrencyField({ field, values }) { return <div className={`input-field calculated-field ${field.span === 2 ? 'wide' : ''}`}><FieldLabel field={field} /><output>{formatCurrency(calculateOutstanding(values))}</output></div>; }
function PersonField({ field, value, onChange }) { const options = [...new Set([...field.options, ...(value ? [value] : [])])].map((name) => ({ value: name, label: name })); return <label className={`input-field ${field.span === 2 ? 'wide' : ''}`}><FieldLabel field={field} /><CreatableSelect classNamePrefix="search-select" isSearchable options={options} value={value ? { value, label: value } : null} onChange={(selected) => onChange(selected?.value?.trim() || '')} placeholder={field.placeholder} noOptionsMessage={() => 'Type to add a person'} formatCreateLabel={(name) => `Add “${name}”`} components={{ Option: SelectOption }} menuPortalTarget={document.body} menuPosition="fixed" styles={selectStyles} /></label>; }
function LocationField({ field, value, onChange }) {
  const id = `field-${field.column.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const listId = `${id}-suggestions`;
  return <label className={`input-field ${field.span === 2 ? 'wide' : ''}`} htmlFor={id}>
    <FieldLabel field={field} />
    <input id={id} type="text" list={listId} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
    <datalist id={listId}>{field.options.map((location) => <option key={location} value={location} />)}</datalist>
  </label>;
}

function ChoiceChipField({ field, value, onChange }) { return <div className={`input-field choice-chips-field ${field.span === 2 ? 'wide' : ''}`}><FieldLabel field={field} /><div className="choice-chips" role="radiogroup" aria-label={field.label}>{field.options.map((option) => <motion.button key={option} type="button" role="radio" aria-checked={value === option} className={`choice-chip ${field.chipTone} option-${option.toLowerCase().replaceAll(/[^a-z]+/g, '-')}${value === option ? ' active' : ''}`} onClick={() => onChange(option)} whileTap={{ scale: .96 }}>{value === option && <motion.span className="choice-active-pill" layoutId={`choice-${field.column}`} transition={spring} />}<span className="choice-content"><ChoiceIcon field={field.column} option={option} />{option}</span></motion.button>)}</div></div>; }
const CHOICE_ICONS = { 'Event Type': { Personal: '●', Family: '♡', Social: '◉', Professional: '▣' }, 'Emotional Importance': { Low: '↓', Medium: '−', High: '↑', 'Life-Changing': '✦' }, 'Event Status': { Planned: '◷', Ongoing: '◌', Completed: '✓', Cancelled: '×' } };
function ChoiceIcon({ field, option }) { return <span className="choice-chip-icon" aria-hidden="true">{CHOICE_ICONS[field]?.[option] || '•'}</span>; }

function useCompactCalendar() { const [compact, setCompact] = useState(() => window.innerWidth <= 680); useEffect(() => { const update = () => setCompact(window.innerWidth <= 680); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }, []); return compact; }
function toLocalDate(value) { if (!value) return undefined; const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); }
function toDateValue(date) { if (!date) return ''; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function DateRangeField({ field, values, onChange }) {
  const compact = useCompactCalendar();
  const [open, setOpen] = useState(false);
  const startDate = toLocalDate(values[field.startColumn]); const endDate = toLocalDate(values[field.endColumn]);
  const selectRange = ([start, end]) => { onChange({ [field.startColumn]: toDateValue(start), [field.endColumn]: toDateValue(end) }); if (end) setOpen(false); };
  return <label className="input-field wide range-field"><FieldLabel field={field} /><DatePicker selected={startDate} onChange={selectRange} startDate={startDate} endDate={endDate} selectsRange monthsShown={compact ? 1 : 2} open={open} onInputClick={() => setOpen(true)} onClickOutside={() => setOpen(false)} dateFormat="dd/MM/yyyy" placeholderText="Select a start and end date" className="range-picker-input" calendarClassName="sheet-datepicker sheet-range-datepicker" popperClassName="sheet-datepicker-popper" showPopperArrow={false} shouldCloseOnSelect /></label>;
}

function TagsField({ field, value, onChange }) { const [draft, setDraft] = useState(''); const tags = value ? value.split(',').map((tag) => tag.trim()).filter(Boolean) : []; const add = () => { const next = draft.trim().replace(/,/g, ''); if (!next || tags.includes(next)) return setDraft(''); onChange([...tags, next].join(', ')); setDraft(''); }; return <label className="input-field wide"><FieldLabel field={field} /><div className="tags-box"><AnimatePresence initial={false}>{tags.map((tag) => <motion.button type="button" className="tag" key={tag} onClick={() => onChange(tags.filter((item) => item !== tag).join(', '))} initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .8 }}>{tag}<span>×</span></motion.button>)}</AnimatePresence><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1).join(', ')); if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(); } }} onBlur={add} placeholder={field.placeholder} /></div></label>; }
function PeopleField({ field, value, onChange }) { const people = value ? value.split(',').map((name) => name.trim()).filter(Boolean) : []; const options = [...new Set([...field.options, ...people])].map((name) => ({ value: name, label: name })); return <label className="input-field"><FieldLabel field={field} /><CreatableSelect classNamePrefix="search-select" isMulti isSearchable options={options} value={people.map((name) => ({ value: name, label: name }))} onChange={(selected) => onChange((selected || []).map((option) => option.value.trim()).filter(Boolean).join(', '))} placeholder={field.placeholder} noOptionsMessage={() => 'Type to add a person'} formatCreateLabel={(name) => `Add “${name}”`} components={{ Option: SelectOption }} menuPortalTarget={document.body} menuPosition="fixed" styles={selectStyles} /></label>; }
function UrlField({ field, value, onChange }) { const [pasted, setPasted] = useState(false); const paste = async () => { try { onChange(await navigator.clipboard.readText()); setPasted(true); setTimeout(() => setPasted(false), 1200); } catch { /* Clipboard permission was not granted. */ } }; return <label className="input-field wide"><FieldLabel field={field} /><div className="url-control"><input type="url" value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /><button type="button" onClick={paste} aria-label="Paste from clipboard" title={pasted ? 'Pasted' : 'Paste from clipboard'}>{pasted ? '✓' : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6v2H9zM7 6h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2v11h10V8H7zm3 3h4v2h-4zm0 4h4v2h-4z" /></svg>}</button></div></label>; }
function AutoGrowTextarea({ id, value, onChange, placeholder }) { const ref = useRef(null); const resize = () => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = `${ref.current.scrollHeight}px`; } }; useEffect(resize, [value]); return <textarea ref={ref} id={id} value={value} onChange={(event) => { onChange(event.target.value); requestAnimationFrame(resize); }} placeholder={placeholder} />; }

createRoot(document.getElementById('root')).render(<App />);
