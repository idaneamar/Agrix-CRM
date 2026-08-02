import React, { useEffect, useState } from 'react'
import { supabase, fmtMoney } from '../supabase.js'
import Modal from '../components/Modal.jsx'

export default function Settings() {
  return (
    <div>
      <h1>הגדרות</h1>
      <ProductsCard />
      <PasswordCard />
      <div className="card small-text muted">
        Agrix CRM · הנתונים נשמרים בענן (Supabase) · ניתן להתקין כאפליקציה מהדפדפן
        (בנייד: שיתוף ← הוספה למסך הבית / התקנה)
      </div>
    </div>
  )
}

function ProductsCard() {
  const [products, setProducts] = useState([])
  const [editRow, setEditRow] = useState(null)

  async function load() {
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
  }
  useEffect(() => { load() }, [])

  return (
    <div className="card">
      <div className="section-head">
        <h2>מוצרים</h2>
        <button className="small" onClick={() => setEditRow({})}>+ מוצר</button>
      </div>
      {products.length === 0 && <div className="empty">אין מוצרים</div>}
      {products.length > 0 && (
        <table>
          <thead><tr><th>שם</th><th>יחידה</th><th>מחיר בסיס</th><th>פעיל</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.unit}</td>
                <td className="num">{fmtMoney(p.default_price)}</td>
                <td>{p.active ? '✓' : '—'}</td>
                <td><button className="ghost small" onClick={() => setEditRow(p)}>עריכה</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editRow && (
        <ProductForm initial={editRow.id ? editRow : null} onClose={() => setEditRow(null)} onSaved={() => { setEditRow(null); load() }} />
      )}
    </div>
  )
}

function ProductForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial || { name: '', unit: 'kg', default_price: '', active: true, notes: '' })
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault(); setErr('')
    const row = {
      name: f.name, unit: f.unit,
      default_price: f.default_price === '' || f.default_price == null ? null : Number(f.default_price),
      active: !!f.active, notes: f.notes || null,
    }
    const res = initial
      ? await supabase.from('products').update(row).eq('id', initial.id)
      : await supabase.from('products').insert(row)
    if (res.error) return setErr(res.error.message)
    onSaved()
  }

  return (
    <Modal title={initial ? 'עריכת מוצר' : 'מוצר חדש'} onClose={onClose}>
      <form onSubmit={save}>
        <label>שם המוצר *</label>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <div className="formrow">
          <div>
            <label>יחידת מידה</label>
            <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
              <option value="kg">ק״ג</option>
              <option value="unit">יחידה</option>
              <option value="carton">קרטון</option>
              <option value="sack">שק</option>
            </select>
          </div>
          <div>
            <label>מחיר בסיס (₪)</label>
            <input type="number" step="0.01" min="0" value={f.default_price ?? ''} onChange={(e) => setF({ ...f, default_price: e.target.value })} />
          </div>
        </div>
        <label>
          <input type="checkbox" style={{ width: 'auto', marginLeft: 8 }} checked={!!f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          מוצר פעיל
        </label>
        <label>הערות</label>
        <input value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button>שמירה</button>
          <button type="button" className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  )
}

function PasswordCard() {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState(null)

  async function change(e) {
    e.preventDefault()
    if (pw.length < 8) return setMsg({ t: 'err', v: 'סיסמה חייבת להיות באורך 8 תווים לפחות' })
    if (pw !== pw2) return setMsg({ t: 'err', v: 'הסיסמאות אינן תואמות' })
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) return setMsg({ t: 'err', v: error.message })
    setMsg({ t: 'ok', v: 'הסיסמה עודכנה בהצלחה' })
    setPw(''); setPw2('')
  }

  return (
    <div className="card">
      <h2>החלפת סיסמה</h2>
      <form onSubmit={change}>
        <div className="formrow">
          <div><label>סיסמה חדשה</label><input dir="ltr" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
          <div><label>אימות סיסמה</label><input dir="ltr" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
        </div>
        {msg && <div className={msg.t === 'ok' ? 'success' : 'error'}>{msg.v}</div>}
        <div style={{ marginTop: 12 }}>
          <button>עדכון סיסמה</button>
        </div>
      </form>
    </div>
  )
}
