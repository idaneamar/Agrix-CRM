import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { supabase } from './supabase.js'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Customers from './pages/Customers.jsx'
import CustomerDetail from './pages/CustomerDetail.jsx'
import Orders from './pages/Orders.jsx'
import ImportPage from './pages/Import.jsx'
import Finance from './pages/Finance.jsx'
import PriceBook from './pages/PriceBook.jsx'
import Suppliers from './pages/Suppliers.jsx'
import Settings from './pages/Settings.jsx'

const NAV = [
  ['/', '📊', 'ראשי', true],
  ['/customers', '👥', 'לקוחות', false],
  ['/orders', '🚚', 'משלוחים', false],
  ['/import', '📦', 'ייבוא', false],
  ['/suppliers', '🤝', 'ספקים', false],
  ['/prices', '🏷️', 'מחירון', false],
  ['/finance', '💰', 'כספים', false],
  ['/settings', '⚙️', 'הגדרות', false],
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="empty">טוען…</div>
  if (!session) return <Login />

  return (
    <HashRouter>
      <div className="app">
        <header className="topbar">
          <button className="hamburger" aria-label="תפריט" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          <span className="logo">Agrix CRM</span>
          <span className="spacer" />
          <button className="small" onClick={() => supabase.auth.signOut()}>יציאה</button>
        </header>
        <div className="layout">
          <nav className={`sidenav${menuOpen ? ' open' : ''}`}>
            {NAV.map(([to, icon, label, end]) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={() => setMenuOpen(false)}
              >
                <span className="icon">{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} />}
          <main className="main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/prices" element={<PriceBook />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  )
}
