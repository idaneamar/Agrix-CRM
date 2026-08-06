import React, { useEffect, useState } from 'react'
import { supabase, fmtDate, KIND_LABELS } from '../supabase.js'

// Generic documents/photos list + uploader, reused on customer, supplier and
// product cards. `filterKey` is the attachments column to match (e.g.
// "supplier_id"), `filterId` its value, `pathPrefix` the storage folder.
export default function Attachments({ filterKey, filterId, pathPrefix }) {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState('photo')
  const [err, setErr] = useState('')

  async function load() {
    const { data } = await supabase.from('attachments').select('*').eq(filterKey, filterId).order('created_at', { ascending: false })
    setFiles(data || [])
  }
  useEffect(() => { load() }, [filterKey, filterId])

  async function upload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr('')
    const path = `${pathPrefix}/${filterId}/${Date.now()}-${file.name}`
    const up = await supabase.storage.from('attachments').upload(path, file)
    if (up.error) { setErr(up.error.message); setBusy(false); return }
    const ins = await supabase.from('attachments').insert({
      [filterKey]: filterId, kind, title: file.name, file_path: path,
      file_size: file.size, mime_type: file.type,
    })
    if (ins.error) setErr(ins.error.message)
    setBusy(false)
    e.target.value = ''
    load()
  }

  async function open(f) {
    const { data, error } = await supabase.storage.from('attachments').createSignedUrl(f.file_path, 3600)
    if (!error) window.open(data.signedUrl, '_blank')
  }

  async function del(f) {
    await supabase.storage.from('attachments').remove([f.file_path])
    await supabase.from('attachments').delete().eq('id', f.id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label>סוג</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <label className="btn" style={{ marginBottom: 0 }}>
          {busy ? 'מעלה…' : '📎 העלאת קובץ / תמונה'}
          <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={upload} disabled={busy} />
        </label>
      </div>
      {err && <div className="error">{err}</div>}
      <div style={{ marginTop: 12 }}>
        {files.length === 0 && <div className="empty">אין מסמכים או תמונות</div>}
        {files.map((f) => (
          <div key={f.id} className="list-item">
            <div className="grow">
              <div className="title">{f.title}</div>
              <div className="sub">{KIND_LABELS[f.kind] || f.kind} · {fmtDate(f.created_at)}</div>
            </div>
            <button className="ghost small" onClick={() => open(f)}>פתיחה</button>
            <button className="ghost small" onClick={() => del(f)}>🗑</button>
          </div>
        ))}
      </div>
    </div>
  )
}
