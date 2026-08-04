import { useEffect, useState, useCallback } from 'react'

// Live FX rates, base ILS, from open.er-api.com (free, no key, CORS-enabled).
// Cached in localStorage for 6 hours so the app stays fast and works offline.

export const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP', 'CNY', 'TRY', 'INR', 'VND', 'THB']
export const CURRENCY_SYMBOL = { ILS: '₪', USD: '$', EUR: '€', GBP: '£', CNY: '¥', TRY: '₺', INR: '₹', VND: '₫', THB: '฿' }

const CACHE_KEY = 'agrix_fx_rates_v1'
const MAX_AGE_MS = 6 * 60 * 60 * 1000

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export async function fetchRates(force = false) {
  const cached = readCache()
  if (!force && cached && Date.now() - cached.time < MAX_AGE_MS) return cached
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/ILS')
    const data = await res.json()
    if (data && data.result === 'success' && data.rates) {
      const entry = { rates: data.rates, time: Date.now() }
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)) } catch { /* ignore */ }
      return entry
    }
  } catch { /* offline — fall through to cache */ }
  return cached // may be null
}

// Convert an amount in `currency` to ILS. rates: base-ILS table (1 ILS = rates[cur] units).
// fallbackRate: optional saved snapshot (units of ILS per 1 unit of currency).
export function toILS(amount, currency, rates, fallbackRate) {
  const a = Number(amount) || 0
  if (!a) return 0
  if (!currency || currency === 'ILS') return a
  const r = rates?.[currency]
  if (r) return a / r
  if (fallbackRate) return a * Number(fallbackRate)
  return a // last resort: treat as ILS so UI still renders
}

// Convert ILS amount into a display currency.
export function fromILS(amountILS, currency, rates) {
  if (!currency || currency === 'ILS') return amountILS
  const r = rates?.[currency]
  return r ? amountILS * r : amountILS
}

export function fmtCur(amount, currency) {
  try {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${(CURRENCY_SYMBOL[currency] || currency)}${Number(amount).toFixed(2)}`
  }
}

export function useRates() {
  const [state, setState] = useState(() => readCache())
  const refresh = useCallback(async (force = true) => {
    const entry = await fetchRates(force)
    if (entry) setState({ ...entry })
    return entry
  }, [])
  useEffect(() => { fetchRates(false).then((e) => e && setState({ ...e })) }, [])
  return { rates: state?.rates || null, updatedAt: state?.time || null, refresh }
}
