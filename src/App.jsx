import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { supabase } from './supabase.js'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Customers from './pages/Customers.jsx'
import CustomerDetail from './pages/CustomerDetail.jsx'
import Orders from './pages/Orders.jsx'
import Settings from './pages/Settings.jsx'

export default function App() {
  const [session, setSession] = useState(undefined)

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
          <span className="logo">Agrix CRM</span>
          <span className="spacer" />
          <button className="small" onClick={() => supabase.auth.signOut()}>יציאה</button>
        </header>
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <nav className="bottomnav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="icon">📊</span>ראשי
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="icon">👥</span>לקוחות
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="icon">🚚</span>משלוחים
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="icon">⚙️</span>הגדרות
          </NavLink>
        </nav>
      </div>
    </HashRouter>
  )
}
