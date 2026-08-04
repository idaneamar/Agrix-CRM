// Weekly backup: export every table to JSON via Supabase REST (service role).
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY
import { mkdirSync, writeFileSync } from 'node:fs'

const URL_BASE = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!URL_BASE || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const TABLES = [
  'customers', 'products', 'customer_products', 'calls', 'orders', 'order_items',
  'attachments', 'suppliers', 'import_shipments', 'import_items', 'stock_adjustments',
  'payments', 'supplier_quotes', 'quotes', 'quote_items',
]

const day = new Date().toISOString().slice(0, 10)
const dir = `backups/${day}`
mkdirSync(dir, { recursive: true })

const PAGE = 1000
let grand = 0
for (const table of TABLES) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${URL_BASE}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Range: `${from}-${from + PAGE - 1}`,
        Prefer: 'count=exact',
      },
    })
    if (!res.ok) {
      console.error(`FAILED ${table}: ${res.status} ${await res.text()}`)
      process.exit(1)
    }
    const chunk = await res.json()
    rows.push(...chunk)
    if (chunk.length < PAGE) break
  }
  writeFileSync(`${dir}/${table}.json`, JSON.stringify(rows, null, 1))
  console.log(`${table}: ${rows.length} rows`)
  grand += rows.length
}
writeFileSync(`${dir}/_meta.json`, JSON.stringify({ backed_up_at: new Date().toISOString(), tables: TABLES.length, total_rows: grand }, null, 1))
console.log(`Backup complete: ${grand} rows across ${TABLES.length} tables → ${dir}`)
