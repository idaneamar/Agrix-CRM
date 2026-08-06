import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, fmtMoney, fmtDate } from '../supabase.js'
import Modal from '../components/Modal.jsx'
import { useRates, fmtCur } from '../rates.js'
import {
  INCOTERMS, QuoteCalcForm, MoneyRow,
  costPerUnitILS, salePriceILS,
} from './PriceBook.jsx'
import Attachments from '../components/Attachments.jsx'

const UNIT_LABEL = { kg: 'ק״ג', unit: 'יחידה', carton: 'קרטון' }

export default function ProductDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [row, setRow] = useState(null)
  const [history, setHistory] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [editing, setEditing] = useState(false)
  const [addingPrice, setAddingPrice] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const { rates } = useRates()

  async function load() {
    const [r, h, s] = await Promise.all([
      supabase.from('supplier_quotes').select('*').eq('id', id).single(),
      supabase.from('price_history').select('*').eq('supplier_quote_id', id).order('effective_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id, name, country').order('name'),
    ])
    setRow(r.data)
    setHistory(h.data || [])
    setSuppliers(s.data || [])
  }
  useEffect(() => { load() }, [id])

  if (row === null) return <div className="empty">טוען…</div>
  if (!row) return <div className="empty">המוצר לא נמצא</div>

  const cost = costPerUnitILS(row, rates)
  const sale = salePriceILS(row, rates)

  async function del() {
    await supabase.from('supplier_quotes').delete().eq('id', row.id)
    nav('/prices')
  }

  return (
    <div>
      <div className="section-head">
        <div>
          <h1>{row.product_name}{row.variant_name ? ` — ${row.variant_name}` : ''}</h1>
          <div className="muted small-text">
            {row.supplier_name || 'ללא ספק'} · {row.country || '—'} · {INCOTERMS[row.incoterm] || row.incoterm}
          </div>
        </div>
        <div className="actions" style={{ margin: 0 }}>
          <button className="ghost small" onClick={() => nav('/prices')}>← חזרה למחירון</button>
          <button className="ghost small" onClick={() => setEditing(true)}>עריכה</button>
        </div>
      </div>

      <div className="card">
        <h2>פרטי המוצר</h2>
        <table>
          <tbody>
            <tr><th style={{ width: 160 }}>שם מוצר (אב)</th><td>{row.product_name}</td></tr>
            <tr><th>תת-מוצר / זן</th><td>{row.variant_name || <span className="muted">לא הוזן</span>}</td></tr>
            <tr><th>ספק</th><td>{row.supplier_name || '—'}</td></tr>
            <tr><th>מדינה</th><td>{row.country || '—'}</td></tr>
            <tr><th>תנאי מכר</th><td>{INCOTERMS[row.incoterm] || row.incoterm}</td></tr>
            <tr><th>יחידת מחיר</th><td>{UNIT_LABEL[row.unit] || row.unit}</td></tr>
            <tr><th>דרך אריזה</th><td>{row.packaging_type || <span className="muted">לא הוזן</span>}</td></tr>
            <tr>
              <th>משקל באריזה</th>
              <td>{row.package_weight_kg ? `${Number(row.package_weight_kg).toLocaleString('he-IL')} ק״ג` : <span className="muted">לא הוזן</span>}</td>
            </tr>
            <tr><th>עודכן לאחרונה</th><td>{fmtDate(row.updated_at || row.quote_date)}</td></tr>
          </tbody>
        </table>
        {row.notes && (
          <div style={{ marginTop: 12 }}>
            <div className="small-text muted" style={{ marginBottom: 4 }}>הערות</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{row.notes}</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-head">
          <h2>תמחור נוכחי</h2>
        </div>
        <table>
          <tbody>
            <tr><th style={{ width: 160 }}>מחיר ספק</th><td className="num" dir="ltr">{fmtCur(Number(row.unit_cost), row.currency)}</td></tr>
            <tr>
              <th>הובלה</th>
              <td className="num" dir="ltr">
                {Number(row.freight_unit_cost) > 0 ? fmtCur(Number(row.freight_unit_cost), row.freight_currency || 'ILS') : <span className="muted">לא הוזן ⚠️</span>}
              </td>
            </tr>
            <tr>
              <th>עלויות נוספות</th>
              <td className="num" dir="ltr">
                {Number(row.extra_unit_cost) > 0 ? fmtCur(Number(row.extra_unit_cost), row.extra_currency || 'ILS') : <span className="muted">לא הוזן</span>}
              </td>
            </tr>
            <tr><th>% רווח</th><td className="num">{Number(row.margin_pct)}%</td></tr>
            <tr><th>סה״כ עלות</th><td className="num"><b>{fmtMoney(cost)}</b></td></tr>
            <tr>
              <th>מחיר מכירה מומלץ</th>
              <td className="num" style={{ color: 'var(--good-text)' }}><b>{fmtMoney(sale)}</b></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="section-head">
          <h2>היסטוריית מחירים</h2>
          <button className="small" onClick={() => setAddingPrice(true)}>+ עדכון מחיר</button>
        </div>
        {history.length === 0 && <div className="empty">אין היסטוריית מחירים</div>}
        {history.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>תאריך</th>
                <th>מחיר ספק</th>
                <th>הובלה</th>
                <th>נוספות</th>
                <th>% רווח</th>
                <th>הערה</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{fmtDate(h.effective_date)}</td>
                  <td className="num" dir="ltr">{fmtCur(Number(h.unit_cost), h.currency)}</td>
                  <td className="num" dir="ltr">{Number(h.freight_unit_cost) > 0 ? fmtCur(Number(h.freight_unit_cost), h.freight_currency || 'ILS') : '—'}</td>
                  <td className="num" dir="ltr">{Number(h.extra_unit_cost) > 0 ? fmtCur(Number(h.extra_unit_cost), h.extra_currency || 'ILS') : '—'}</td>
                  <td className="num">{h.margin_pct != null ? `${Number(h.margin_pct)}%` : '—'}</td>
                  <td>{h.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 16 }}>
          {!confirmDel ? (
            <button className="ghost small" onClick={() => setConfirmDel(true)}>מחיקת מוצר</button>
          ) : (
            <div className="actions">
              <span className="small-text">למחוק את המוצר וכל היסטוריית המחירים שלו?</span>
              <button className="danger small" onClick={del}>כן, מחק</button>
              <button className="ghost small" onClick={() => setConfirmDel(false)}>ביטול</button>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>מסמכים ותמונות</h2>
        <Attachments filterKey="supplier_quote_id" filterId={row.id} pathPrefix="products" />
      </div>

      {editing && (
        <QuoteCalcForm
          initial={row}
          suppliers={suppliers}
          rates={rates}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load() }}
        />
      )}
      {addingPrice && (
        <PriceUpdateForm
          row={row}
          rates={rates}
          onClose={() => setAddingPrice(false)}
          onSaved={() => { setAddingPrice(false); load() }}
        />
      )}
    </div>
  )
}

// Focused form for logging a price change over time — updates the row's
// current price AND appends a dated snapshot to price_history.
function PriceUpdateForm({ row, rates, onClose, onSaved }) {
  const [f, setF] = useState({
    unit_cost: row.unit_cost, currency: row.currency,
    freight_unit_cost: row.freight_unit_cost || 0, freight_currency: row.freight_currency || 'ILS',
    extra_unit_cost: row.extra_unit_cost || 0, extra_currency: row.extra_currency || 'ILS',
    margin_pct: row.margin_pct,
    effective_date: new Date().toISOString().slice(0, 10),
    note: '',
  })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save(e) {
    e.preventDefault(); setErr('')
    const snap = f.currency === 'ILS' ? 1 : (rates?.[f.currency] ? 1 / rates[f.currency] : Number(row.fx_rate) || 1)
    const upd = {
      unit_cost: Number(f.unit_cost),
      currency: f.currency,
      fx_rate: Math.round(snap * 10000) / 10000,
      freight_unit_cost: Number(f.freight_unit_cost) || 0,
      freight_currency: f.freight_currency || 'ILS',
      extra_unit_cost: Number(f.extra_unit_cost) || 0,
      extra_currency: f.extra_currency || 'ILS',
      margin_pct: Number(f.margin_pct) || 0,
      quote_date: f.effective_date,
    }
    const res = await supabase.from('supplier_quotes').update(upd).eq('id', row.id)
    if (res.error) return setErr(res.error.message)
    const res2 = await supabase.from('price_history').insert({
      supplier_quote_id: row.id,
      unit_cost: upd.unit_cost, currency: upd.currency, fx_rate: upd.fx_rate,
      freight_unit_cost: upd.freight_unit_cost, freight_currency: upd.freight_currency,
      extra_unit_cost: upd.extra_unit_cost, extra_currency: upd.extra_currency,
      margin_pct: upd.margin_pct, effective_date: f.effective_date,
      note: f.note || 'עדכון מחיר',
    })
    if (res2.error) return setErr(res2.error.message)
    onSaved()
  }

  return (
    <Modal title="עדכון מחיר" onClose={onClose}>
      <form onSubmit={save}>
        <div className="small-text muted" style={{ marginBottom: 8 }}>
          העדכון ישנה את המחיר הנוכחי של המוצר (כפי שמופיע במחירון) וגם יישמר בהיסטוריה.
        </div>
        <MoneyRow label="מחיר הספק (ליחידה) *" required value={f.unit_cost} onValue={set('unit_cost')} currency={f.currency} onCurrency={set('currency')} />
        <MoneyRow label="הובלה ליחידה" value={f.freight_unit_cost} onValue={set('freight_unit_cost')} currency={f.freight_currency} onCurrency={set('freight_currency')} />
        <MoneyRow label="עלויות נוספות ליחידה" value={f.extra_unit_cost} onValue={set('extra_unit_cost')} currency={f.extra_currency} onCurrency={set('extra_currency')} />
        <label>אחוז רווח רצוי (%)</label>
        <input type="number" step="0.1" min="0" value={f.margin_pct} onChange={set('margin_pct')} />
        <label>תאריך תוקף המחיר</label>
        <input type="date" value={f.effective_date} onChange={set('effective_date')} required />
        <label>הערה (למשל: "עדכון מחירי 2027")</label>
        <input value={f.note} onChange={set('note')} placeholder="עדכון מחיר" />
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button>שמירה</button>
          <button type="button" className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  )
}
