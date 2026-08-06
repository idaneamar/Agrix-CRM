import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, FREQ_LABELS, STATUS_LABELS } from '../supabase.js'
import Modal from '../components/Modal.jsx'

export const EMPTY_CUSTOMER = {
  name: '', contact_name: '', phone: '', email: '',
  city: '', street: '', address_notes: '',
  delivery_frequency: 'weekly', status: 'active', payment_terms: '', notes: '',
}

export function CustomerForm({ initial, onSaved, onClose }) {
  const [f, setF] = useState(initial || EMPTY_CUSTOMER)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    const row = { ...f }
    delete row.id; delete row.created_at; delete row.updated_at
    // Leave customer_code out of a brand-new insert when left blank, so the DB's
    // auto-numbering (customer_code_seq) assigns it. Editing sends whatever is typed.
    if (!row.customer_code) {
      if (initial?.id) row.customer_code = null
      else delete row.customer_code
    }
    let res
    if (initial?.id) res = await supabase.from('customers').update(row).eq('id', initial.id).select().single()
    else res = await supabase.from('customers').insert(row).select().single()
    setBusy(false)
    if (res.error) return setErr(res.error.message)
    onSaved(res.data)
  }

  return (
    <form onSubmit={save}>
      <div className="formrow">
        <div><label>שם העסק *</label><input value={f.name} onChange={set('name')} required /></div>
        <div>
          <label>מספר לקוח</label>
          <input value={f.customer_code || ''} onChange={set('customer_code')} placeholder={initial?.id ? '' : 'ריק = יוקצה מספר אוטומטי'} />
        </div>
      </div>
      <div className="formrow">
        <div><label>איש קשר</label><input value={f.contact_name || ''} onChange={set('contact_name')} /></div>
        <div><label>טלפון</label><input dir="ltr" value={f.phone || ''} onChange={set('phone')} /></div>
      </div>
      <label>אימייל</label>
      <input dir="ltr" type="email" value={f.email || ''} onChange={set('email')} />
      <div className="formrow">
        <div><label>עיר</label><input value={f.city || ''} onChange={set('city')} /></div>
        <div><label>רחוב ומספר</label><input value={f.street || ''} onChange={set('street')} /></div>
      </div>
      <label>הערות לכתובת (קומה, כניסה, שעות קבלה…)</label>
      <input value={f.address_notes || ''} onChange={set('address_notes')} />
      <div className="formrow">
        <div>
          <label>תדירות אספקה</label>
          <select value={f.delivery_frequency} onChange={set('delivery_frequency')}>
            {Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label>סטטוס</label>
          <select value={f.status} onChange={set('status')}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <label>תנאי תשלום (מזומן, שוטף+30…)</label>
      <input value={f.payment_terms || ''} onChange={set('payment_terms')} />
      <label>הערות כלליות</label>
      <textarea value={f.notes || ''} onChange={set('notes')} />
      {err && <div className="error">{err}</div>}
      <div className="actions">
        <button disabled={busy}>{busy ? 'שומר…' : 'שמירה'}</button>
        <button type="button" className="ghost" onClick={onClose}>ביטול</button>
      </div>
    </form>
  )
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('customers').select('*').order('name')
    setCustomers(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = customers.filter((c) =>
    [c.name, c.contact_name, c.phone, c.city].join(' ').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div>
      <div className="section-head">
        <h1>לקוחות</h1>
        <button onClick={() => setAdding(true)}>+ לקוח חדש</button>
      </div>
      <input placeholder="חיפוש לפי שם, איש קשר, טלפון, עיר…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      <div className="card">
        {loading && <div className="empty">טוען…</div>}
        {!loading && filtered.length === 0 && <div className="empty">אין לקוחות עדיין — הוסף את הלקוח הראשון</div>}
        {filtered.map((c) => (
          <Link key={c.id} to={`/customers/${c.id}`} className="list-item">
            <div className="grow">
              <div className="title">{c.name}{c.customer_code && <span className="muted small-text"> · #{c.customer_code}</span>}</div>
              <div className="sub">
                {[c.contact_name, c.phone, c.city].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <span className={`badge ${c.status}`}>{STATUS_LABELS[c.status]}</span>
            <span className="badge">{FREQ_LABELS[c.delivery_frequency]}</span>
          </Link>
        ))}
      </div>
      {adding && (
        <Modal title="לקוח חדש" onClose={() => setAdding(false)}>
          <CustomerForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
        </Modal>
      )}
    </div>
  )
}
