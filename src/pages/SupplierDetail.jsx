import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase, fmtMoney, fmtDate } from '../supabase.js'
import Modal from '../components/Modal.jsx'
import { useRates } from '../rates.js'
import { SHIPMENT_STATUS, googleMapsLink } from '../logic.js'
import { SupplierForm } from './Import.jsx'
import { INCOTERMS, QuoteCalcForm, costPerUnitILS, salePriceILS } from './PriceBook.jsx'
import Attachments from '../components/Attachments.jsx'

export default function SupplierDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [supplier, setSupplier] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [shipments, setShipments] = useState([])
  const [editing, setEditing] = useState(false)
  const [addingPrice, setAddingPrice] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const { rates } = useRates()

  async function load() {
    const [s, q, sh] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', id).single(),
      supabase.from('supplier_quotes').select('*').eq('supplier_id', id).order('product_name'),
      supabase.from('import_shipments').select('*, import_items(id, quantity, unit_cost, currency, fx_rate, products(name, unit))').eq('supplier_id', id).order('created_at', { ascending: false }),
    ])
    setSupplier(s.data)
    setQuotes(q.data || [])
    setShipments(sh.data || [])
  }
  useEffect(() => { load() }, [id])

  if (supplier === null) return <div className="empty">טוען…</div>
  if (!supplier) return <div className="empty">הספק לא נמצא</div>

  async function del() {
    await supabase.from('suppliers').delete().eq('id', supplier.id)
    nav('/suppliers')
  }

  const wa = supplier.phone ? `https://wa.me/${supplier.phone.replace(/\D/g, '')}` : null
  const mapLink = googleMapsLink(supplier.location)

  return (
    <div>
      <div className="section-head">
        <div>
          <h1>{supplier.name}</h1>
          <div className="muted small-text">{supplier.country || '—'} · {supplier.currency}</div>
        </div>
        <div className="actions" style={{ margin: 0 }}>
          <button className="ghost small" onClick={() => nav('/suppliers')}>← חזרה לספקים</button>
          <button className="ghost small" onClick={() => setEditing(true)}>עריכה</button>
        </div>
      </div>

      <div className="card">
        <h2>פרטי קשר</h2>
        <div className="actions" style={{ marginTop: 0, marginBottom: 12, flexWrap: 'wrap' }}>
          {supplier.phone && <a className="btn small" href={`tel:${supplier.phone}`}>📞 חיוג</a>}
          {wa && <a className="btn small" style={{ background: '#25d366' }} href={wa} target="_blank" rel="noreferrer">💬 וואטסאפ</a>}
          {supplier.email && <a className="btn small" href={`mailto:${supplier.email}`}>✉️ מייל</a>}
          {mapLink && <a className="btn small" style={{ background: '#4285F4' }} href={mapLink} target="_blank" rel="noreferrer">🗺 מפה</a>}
        </div>
        <table>
          <tbody>
            <tr><th style={{ width: 160 }}>איש קשר</th><td>{supplier.contact_name || '—'}</td></tr>
            <tr><th>טלפון</th><td dir="ltr">{supplier.phone || '—'}</td></tr>
            <tr><th>אימייל</th><td dir="ltr">{supplier.email || '—'}</td></tr>
            <tr><th>מדינה</th><td>{supplier.country || '—'}</td></tr>
            <tr><th>מטבע</th><td>{supplier.currency}</td></tr>
            <tr><th>תנאי תשלום</th><td>{supplier.payment_terms || '—'}</td></tr>
            <tr><th>מיקום</th><td>{supplier.location || <span className="muted">לא הוזן</span>}</td></tr>
          </tbody>
        </table>
        {supplier.notes && (
          <div style={{ marginTop: 12 }}>
            <div className="small-text muted" style={{ marginBottom: 4 }}>הערות</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{supplier.notes}</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-head">
          <h2>מוצרים ומחירים אצל הספק</h2>
          <button className="small" onClick={() => setAddingPrice(true)}>+ מחיר מוצר</button>
        </div>
        {quotes.length === 0 && <div className="empty">אין מוצרים/מחירים רשומים תחת ספק זה</div>}
        {quotes.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>מוצר</th>
                  <th>מדינה</th>
                  <th>תנאי</th>
                  <th>מחיר ספק</th>
                  <th>עלות ₪</th>
                  <th>מכירה ₪</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link to={`/prices/${q.id}`} style={{ fontWeight: 700 }}>{q.product_name}</Link>
                      {(q.variant_name || q.product_code) && (
                        <div className="small-text muted">
                          {[q.variant_name, q.product_code ? `קוד ${q.product_code}` : null].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td>{q.country || '—'}</td>
                    <td>{q.incoterm}</td>
                    <td className="num" dir="ltr">{Number(q.unit_cost).toLocaleString('he-IL')} {q.currency}</td>
                    <td className="num">{fmtMoney(costPerUnitILS(q, rates))}</td>
                    <td className="num" style={{ color: 'var(--good-text)', fontWeight: 700 }}>{fmtMoney(salePriceILS(q, rates))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>מסמכים ותמונות</h2>
        <Attachments filterKey="supplier_id" filterId={supplier.id} pathPrefix="suppliers" />
      </div>

      <div className="card">
        <h2>משלוחי ייבוא מהספק</h2>
        {shipments.length === 0 && <div className="empty">אין משלוחי ייבוא רשומים מספק זה</div>}
        {shipments.map((sh) => {
          const goods = (sh.import_items || []).reduce((t, it) => t + Number(it.quantity) * Number(it.unit_cost) * Number(it.fx_rate), 0)
          const extras = Number(sh.freight_cost) + Number(sh.customs_cost) + Number(sh.agent_cost) + Number(sh.inland_cost)
          return (
            <div key={sh.id} className="list-item">
              <div className="grow">
                <div className="title">{sh.reference || 'ללא מספר'}</div>
                <div className="sub">
                  {(sh.import_items || []).map((it) => `${it.products?.name} ×${Number(it.quantity).toLocaleString('he-IL')}`).join(' · ') || 'ללא פריטים'}
                </div>
                <div className="sub num">
                  סחורה {fmtMoney(goods)} + עלויות {fmtMoney(extras)} = <b>{fmtMoney(goods + extras)}</b>
                  {sh.arrival_date ? ` · הגיע ${fmtDate(sh.arrival_date)}` : sh.eta ? ` · צפי הגעה ${fmtDate(sh.eta)}` : ''}
                </div>
              </div>
              <span className={`badge ${sh.status === 'released' ? 'delivered' : 'planned'}`}>{SHIPMENT_STATUS[sh.status]}</span>
            </div>
          )
        })}
        <div style={{ marginTop: 16 }}>
          {!confirmDel ? (
            <button className="ghost small" onClick={() => setConfirmDel(true)}>מחיקת ספק</button>
          ) : (
            <div className="actions">
              <span className="small-text">
                למחוק את הספק? {quotes.length > 0 ? 'שים לב — יש מוצרים/מחירים המקושרים לספק זה.' : ''}
              </span>
              <button className="danger small" onClick={del}>כן, מחק</button>
              <button className="ghost small" onClick={() => setConfirmDel(false)}>ביטול</button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <SupplierForm initial={supplier} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />
      )}
      {addingPrice && (
        <QuoteCalcForm
          prefill={{ supplier_id: supplier.id, supplier_name: supplier.name, country: supplier.country || '', currency: supplier.currency || 'USD' }}
          suppliers={[{ id: supplier.id, name: supplier.name, country: supplier.country }]}
          rates={rates}
          onClose={() => setAddingPrice(false)}
          onSaved={() => { setAddingPrice(false); load() }}
        />
      )}
    </div>
  )
}
