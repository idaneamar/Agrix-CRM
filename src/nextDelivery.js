import { FREQ_DAYS } from './supabase.js'

// Compute next expected delivery date for a customer, based on
// planned orders, last delivered order + frequency.
export function nextDeliveryFor(customer, orders) {
  const mine = orders.filter((o) => o.customer_id === customer.id)
  const planned = mine
    .filter((o) => o.status === 'planned' && o.delivery_date)
    .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date))
  if (planned.length) return { date: planned[0].delivery_date, source: 'planned' }

  const days = FREQ_DAYS[customer.delivery_frequency]
  if (!days) return null
  const delivered = mine
    .filter((o) => o.status === 'delivered' && o.delivery_date)
    .sort((a, b) => b.delivery_date.localeCompare(a.delivery_date))
  if (!delivered.length) return null
  const last = new Date(delivered[0].delivery_date)
  last.setDate(last.getDate() + days)
  return { date: last.toISOString().slice(0, 10), source: 'estimated' }
}

export function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}
