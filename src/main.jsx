import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AppsScriptBridge } from './services/bridge.js';
import { inferFieldType, validateValues } from './services/forms.js';
import './styles.css';

const bridge = new AppsScriptBridge(import.meta.env.VITE_APPS_SCRIPT_URL);
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const storedTheme = localStorage.getItem('sheet-machine-theme');

function useTheme() {
  const [theme, setTheme] = useState(storedTheme || 'system');
  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('sheet-machine-theme', theme);
  }, [theme]);
  return [theme, setTheme];
}

function App() {
  const [theme, setTheme] = useTheme();
  const [identity, setIdentity] = useState(null);
  const [status, setStatus] = useState('Loading secure connection…');

  useEffect(() => {
    bridge.ready().then(() => setStatus('')).catch((error) => setStatus(error.message));
    window.handleGoogleCredential = ({ credential }) => {
      bridge.authenticate(credential).then(setIdentity).catch((error) => setStatus(error.message));
    };
    if (clientId) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
      script.onload = () => window.google.accounts.id.initialize({ client_id: clientId, callback: window.handleGoogleCredential });
      document.head.append(script);
      return () => script.remove();
    }
  }, []);

  return <>
    <iframe ref={bridge.setFrame} className="bridge" title="Secure Sheet Machine connection" src={bridge.url} />
    <header className="topbar"><Link className="brand" to="/">Sheet <em>Machine</em></Link><div className="top-actions">
      <select aria-label="Color theme" value={theme} onChange={(e) => setTheme(e.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
      {identity ? <span className="identity">{identity.email}</span> : <button onClick={() => window.google?.accounts.id.prompt()}>Sign in with Google</button>}
    </div></header>
    {status && <div className="notice">{status}</div>}
    <main><Routes>
      <Route path="/" element={<Dashboard identity={identity} />} />
      <Route path="/admin/new" element={<FormEditor identity={identity} />} />
      <Route path="/admin/:formId" element={<FormEditor identity={identity} />} />
      <Route path="/admin/:formId/entries" element={<Entries identity={identity} />} />
      <Route path="/f/:formId" element={<Submission identity={identity} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></main>
  </>;
}

function RequireOwner({ identity, children }) {
  if (!identity) return <Empty title="Sign in required" text="Sign in with the configured Google account to manage forms." />;
  if (!identity.isAdmin) return <Empty title="Administrator access required" text="This workspace is administered by its configured owner." />;
  return children;
}

function Dashboard({ identity }) {
  const [forms, setForms] = useState([]); const [error, setError] = useState('');
  useEffect(() => { if (identity) bridge.call('listForms').then(setForms).catch((e) => setError(e.message)); }, [identity]);
  return <section className="page"><div className="hero"><p className="eyebrow">PRIVATE FORM WORKSPACE</p><h1>Collect clean data, directly into Sheets.</h1><p>Build controlled forms from the columns your team already uses.</p>{identity?.isAdmin && <Link className="button" to="/admin/new">Create a form</Link>}</div>
    {error && <div className="error">{error}</div>}
    <div className="section-heading"><h2>Your forms</h2><span>{forms.length} total</span></div>
    <div className="card-grid">{forms.map((form) => <article className="card" key={form.id}><div className={'status '+form.status}>{form.status}</div><h3>{form.name}</h3><p>{form.fields.filter((field) => field.visible).length} fields · {form.allowedEmails.length} people allowed</p><div className="card-actions"><Link to={`/f/${form.id}`}>Open form</Link>{identity?.isAdmin && <Link to={`/admin/${form.id}`}>Manage</Link>}</div></article>)}</div>
    {identity && !forms.length && <Empty title="No forms yet" text={identity.isAdmin ? 'Connect a spreadsheet tab to create your first form.' : 'Ask an administrator to add you to a form.'} />}
  </section>;
}

function FormEditor({ identity }) {
  const { formId } = useParams(); const navigate = useNavigate();
  const [form, setForm] = useState(null); const [sheet, setSheet] = useState(''); const [tab, setTab] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (formId && identity?.isAdmin) bridge.call('getForm', { formId }).then(setForm).catch((e) => setError(e.message)); }, [formId, identity]);
  const imported = async () => { try { const draft = await bridge.call('importSheet', { spreadsheetId: sheet.trim(), sheetName: tab.trim() }); setForm(draft); } catch (e) { setError(e.message); } };
  const save = async () => { setSaving(true); try { const saved = await bridge.call('saveForm', { form }); setForm(saved); navigate(`/admin/${saved.id}`, { replace: true }); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  const update = (index, change) => setForm({ ...form, fields: form.fields.map((field, i) => i === index ? { ...field, ...change } : field) });
  return <RequireOwner identity={identity}><section className="page narrow"><Link className="back" to="/">← Forms</Link><h1>{form ? `Configure ${form.name}` : 'Connect a sheet'}</h1>{error && <div className="error">{error}</div>}
    {!form ? <div className="panel"><p>Paste the spreadsheet ID and exact tab name. Row 1 must contain unique headers.</p><label>Spreadsheet ID<input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="1Abc…" /></label><label>Tab name<input value={tab} onChange={(e) => setTab(e.target.value)} placeholder="Responses" /></label><button onClick={imported}>Import columns</button></div> : <>
      <div className="panel"><label>Form name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Allowed Google emails <textarea value={form.allowedEmails.join('\n')} onChange={(e) => setForm({ ...form, allowedEmails: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} placeholder="one@email.com" /></label><div className="row"><button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button><button className="secondary" onClick={() => { setForm({ ...form, status: form.status === 'published' ? 'closed' : 'published' }); }}>Set {form.status === 'published' ? 'closed' : 'published'} then save</button></div></div>
      <div className="section-heading"><h2>Fields</h2><button className="text-button" onClick={async () => { try { setForm(await bridge.call('refreshFormSchema', { formId: form.id })); } catch (e) { setError(e.message); } }}>Refresh from sheet</button></div>
      <div className="fields">{form.fields.map((field, index) => <div className="field-row" key={field.column}><input aria-label="Field label" value={field.label} onChange={(e) => update(index, { label: e.target.value })} /><select value={field.type} onChange={(e) => update(index, { type: e.target.value })}>{['text','textarea','number','email','phone','date','checkbox','select'].map((type) => <option key={type}>{type}</option>)}</select><label className="checkbox"><input type="checkbox" checked={field.required} onChange={(e) => update(index, { required: e.target.checked })} /> Required</label><label className="checkbox"><input type="checkbox" checked={field.visible} onChange={(e) => update(index, { visible: e.target.checked })} /> Visible</label>{field.type === 'select' && <input aria-label="Choices" value={(field.options || []).join(', ')} onChange={(e) => update(index, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="Choice A, Choice B" />}</div>)}</div>
      <Link className="button secondary" to={`/admin/${form.id}/entries`}>View entries</Link></>}
  </section></RequireOwner>;
}

function Submission({ identity }) {
  const { formId } = useParams(); const [form, setForm] = useState(null); const [values, setValues] = useState({}); const [error, setError] = useState(''); const [done, setDone] = useState(false);
  useEffect(() => { if (identity) bridge.call('getPublicForm', { formId }).then(setForm).catch((e) => setError(e.message)); }, [formId, identity]);
  const submit = async (event) => { event.preventDefault(); const issues = validateValues(form.fields, values); if (Object.keys(issues).length) return setError(Object.values(issues)[0]); try { await bridge.call('submitForm', { formId, values }); setDone(true); } catch (e) { setError(e.message); } };
  if (!identity) return <Empty title="Sign in to continue" text="This is a private team form. Use your allowed Google account." />;
  if (done) return <Empty title="Submission received" text="Your data has been added to the team spreadsheet." />;
  return <section className="page form-page">{error && <div className="error">{error}</div>}{form && <form className="panel" onSubmit={submit}><p className="eyebrow">PRIVATE FORM</p><h1>{form.name}</h1>{form.fields.filter((field) => field.visible).map((field) => <Input key={field.column} field={field} value={values[field.column]} onChange={(value) => setValues({ ...values, [field.column]: value })} />)}<button>Submit securely</button></form>}</section>;
}

function Input({ field, value, onChange }) { const id = `field-${field.column}`; return <label htmlFor={id}>{field.label}{field.required && <span className="required"> *</span>}{field.type === 'textarea' ? <textarea id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} /> : field.type === 'select' ? <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)}><option value="">Select…</option>{(field.options || []).map((option) => <option key={option}>{option}</option>)}</select> : field.type === 'checkbox' ? <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> : <input id={id} type={field.type === 'phone' ? 'tel' : field.type} value={value || ''} onChange={(e) => onChange(e.target.value)} />}</label>; }

function Entries({ identity }) { const { formId } = useParams(); const [data, setData] = useState(null); const [query, setQuery] = useState(''); const [error, setError] = useState(''); useEffect(() => { if (identity?.isAdmin) bridge.call('listEntries', { formId }).then(setData).catch((e) => setError(e.message)); }, [identity, formId]); const rows = useMemo(() => (data?.rows || []).filter((row) => Object.values(row).join(' ').toLowerCase().includes(query.toLowerCase())), [data, query]); return <RequireOwner identity={identity}><section className="page"><Link className="back" to={`/admin/${formId}`}>← Form settings</Link><div className="section-heading"><h1>Entries</h1><input aria-label="Search entries" placeholder="Search entries" value={query} onChange={(e) => setQuery(e.target.value)} /></div>{error && <div className="error">{error}</div>}{data && <div className="table-wrap"><table><thead><tr>{data.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{data.headers.map((header) => <td key={header}>{String(row[header] ?? '')}</td>)}</tr>)}</tbody></table></div>}</section></RequireOwner>; }
function Empty({ title, text }) { return <section className="empty"><h1>{title}</h1><p>{text}</p></section>; }
createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
