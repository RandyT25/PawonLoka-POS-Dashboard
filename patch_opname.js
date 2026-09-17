import fs from 'fs'

let code = fs.readFileSync('src/backoffice/components/inventory/InvOpname.jsx', 'utf-8')

if (!code.includes('DateRangePicker')) {
  code = code.replace(
    'import { useState, useEffect } from "react"',
    'import { useState, useEffect, useCallback } from "react"\nimport DateRangePicker, { buildDateRange } from "../DateRangePicker"\n\nconst today = () => new Date().toISOString().slice(0, 10)'
  )
}

const stateBlock = `
  const [range,        setRange]        = useState("month")
  const [customDate,   setCustomDate]   = useState(today())
  const [customDateTo, setCustomDateTo] = useState(today())
  const [lastUpdated,  setLastUpdated]  = useState(null)
`
if (!code.includes('setRange')) {
  code = code.replace(
    /const \[loading,\s+setLoading\]\s*=\s*useState\(true\)/,
    `const [loading,       setLoading]       = useState(true)\n${stateBlock}`
  )
}

code = code.replace(
  'async function load() {',
  `const load = useCallback(async () => {
    const { fromStr, toStr } = buildDateRange(range, customDate, customDateTo)
    const fromDate = fromStr.slice(0, 10)
    const toDate   = toStr ? toStr.slice(0, 10) : today()
`
)

code = code.replace(
  /supabase\.from\("stock_opname"\)\.select\("\*"\)\.order\("created_at",\s*\{\s*ascending:false\s*\}\)/,
  'supabase.from("stock_opname").select("*").gte("date", fromDate).lte("date", toDate).order("created_at", { ascending:false })'
)

code = code.replace(
  /setSessions\(s\|\|\[\]\);\s*setIngredients\(i\|\|\[\]\)/,
  'setSessions(s||[]); setIngredients(i||[])\n    setLastUpdated(new Date())'
)

code = code.replace(
  /setLoading\(false\)\n  \}/,
  'setLoading(false)\n  }, [range, customDate, customDateTo])'
)

code = code.replace(
  /useEffect\(\(\) => \{ load\(\) \}, \[\]\)/,
  'useEffect(() => { load() }, [load])'
)

code = code.replace(
  /<div style={{ display:"flex", justifyContent:"space-between"/,
  `<DateRangePicker range={range} setRange={setRange} customDate={customDate} setCustomDate={setCustomDate}
        customDateTo={customDateTo} setCustomDateTo={setCustomDateTo}
        loading={loading} lastUpdated={lastUpdated} onRefresh={load} />\n\n      <div style={{ display:"flex", justifyContent:"space-between"`
)

fs.writeFileSync('src/backoffice/components/inventory/InvOpname.jsx', code)
console.log('patched InvOpname.jsx')
