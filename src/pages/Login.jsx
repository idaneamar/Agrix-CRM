import React, { useState } from 'react'
import { supabase } from '../supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setErr('פרטי התחברות שגויים')
    setBusy(false)
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-logo">
          <div className="mark">A</div>
          <h1>Agrix CRM</h1>
          <div className="muted small-text">ניהול לקוחות — ייבוא פיצוחים ומזון</div>
        </div>
        <form onSubmit={submit}>
          <label>אימייל</label>
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          <label>סיסמה</label>
          <input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          {err && <div className="error">{err}</div>}
          <div style={{ marginTop: 16 }}>
            <button disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? 'מתחבר…' : 'כניסה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
