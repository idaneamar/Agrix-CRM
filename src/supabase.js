import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://efbsagtokdstcaxvtqan.supabase.co'
const SUPABASE_KEY = 'sb_publishable_we8h-VICqhBqg_jfEm9vFQ_Qteb3_IB'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export const FREQ_LABELS = {
  weekly: 'שבועי',
  biweekly: 'דו־שבועי',
  monthly: 'חודשי',
  on_demand: 'לפי דרישה',
}

export const FREQ_DAYS = { weekly: 7, biweekly: 14, monthly: 30 }

export const STATUS_LABELS = { lead: 'ליד', active: 'פעיל', inactive: 'לא פעיל' }
export const ORDER_STATUS_LABELS = { planned: 'מתוכנן', delivered: 'סופק', canceled: 'בוטל' }
export const KIND_LABELS = { invoice: 'חשבונית', contract: 'חוזה', photo: 'תמונה', certificate: 'תעודה/אישור', catalog: 'קטלוג', other: 'אחר' }
export const IMPORT_KIND_LABELS = { bl: 'שטר מטען (BL)', customs: 'מסמכי מכס', supplier_invoice: 'חשבונית ספק', other: 'אחר' }

export const fmtMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(n)

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('he-IL') : '—')
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '—')
