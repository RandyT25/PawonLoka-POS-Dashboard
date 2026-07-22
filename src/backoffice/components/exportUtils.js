import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const BRAND_BLUE  = [0, 82, 204]
const GRAY_TEXT   = [80, 80, 80]

export const fmtIDR = n => "Rp " + Number(n || 0).toLocaleString("id-ID")

export function formatPeriodLabel(range, from, to) {
  const fmtD = d => d
    ? new Date(d + "T12:00:00").toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })
    : ""
  const now = new Date()
  if (range === "today") return "Hari ini, " + fmtD(now.toISOString().slice(0, 10))
  if (range === "week") {
    const dow = (now.getDay() + 6) % 7
    const mon = new Date(now); mon.setDate(now.getDate() - dow); mon.setHours(0, 0, 0, 0)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return fmtD(mon.toISOString().slice(0, 10)) + " — " + fmtD(sun.toISOString().slice(0, 10))
  }
  if (range === "month") return now.toLocaleDateString("id-ID", { month:"long", year:"numeric" })
  if (from && to && from !== to) return fmtD(from) + " — " + fmtD(to)
  if (from) return fmtD(from)
  return "—"
}

export function filenameSlug(range, from, to) {
  const now = new Date()
  if (range === "today") return now.toISOString().slice(0, 10)
  if (range === "week") {
    const dow = (now.getDay() + 6) % 7
    const mon = new Date(now); mon.setDate(now.getDate() - dow)
    return mon.toISOString().slice(0, 10)
  }
  if (range === "month") return now.toISOString().slice(0, 7)
  return (from || "") + (to && to !== from ? "_" + to : "")
}

// ── PDF ─────────────────────────────────────────────────────────────────────

let _logoDataUrl = null
async function loadLogo() {
  if (_logoDataUrl) return _logoDataUrl
  const res = await fetch("/logo.png")
  const blob = await res.blob()
  _logoDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
  return _logoDataUrl
}

async function pdfHeader(doc, title, periodLabel, filterLabel) {
  const W = doc.internal.pageSize.getWidth()

  doc.setFillColor(...BRAND_BLUE)
  doc.rect(0, 0, W, 24, "F")

  try {
    const logo = await loadLogo()
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(12, 3, 18, 18, 2, 2, "F")
    doc.addImage(logo, "PNG", 13, 4, 16, 16)
  } catch { /* logo optional — header still renders without it */ }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text("PawonLoka", 34, 13)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text(title, W - 14, 13, { align:"right" })

  doc.setTextColor(...GRAY_TEXT)
  doc.setFontSize(8)
  let y = 32
  doc.text("Periode: " + periodLabel, 14, y)
  doc.text("Dicetak: " + new Date().toLocaleDateString("id-ID"), W - 14, y, { align:"right" })
  if (filterLabel) { y += 5; doc.text("Filter: " + filterLabel, 14, y) }

  doc.setDrawColor(220, 220, 220)
  doc.line(14, y + 3, W - 14, y + 3)
  return y + 9
}

function pdfFooters(doc) {
  const n = doc.internal.getNumberOfPages()
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.text("PawonLoka POS System", 14, H - 8)
    doc.text("Hal " + i + " / " + n, W - 14, H - 8, { align:"right" })
  }
}

const TABLE_OPTS = {
  styles:             { fontSize: 8, cellPadding: 2.5 },
  headStyles:         { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontStyle:"bold" },
  alternateRowStyles: { fillColor: [248, 249, 250] },
  margin:             { left: 14, right: 14 },
}

/**
 * tables: [{ label?: string, head: string[], body: (string|number)[][] }]
 */
export async function exportPDF({ title, periodLabel, filterLabel, tables, filename }) {
  const doc = new jsPDF()
  let y = await pdfHeader(doc, title, periodLabel, filterLabel)

  tables.forEach((tbl, idx) => {
    if (tbl.label) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(40, 40, 40)
      doc.text(tbl.label, 14, y)
      y += 5
    }
    autoTable(doc, { startY: y, head: [tbl.head], body: tbl.body, ...TABLE_OPTS })
    y = doc.lastAutoTable.finalY + (idx < tables.length - 1 ? 10 : 0)
  })

  pdfFooters(doc)
  doc.save(filename)
}

// ── Excel ────────────────────────────────────────────────────────────────────

/**
 * sheets: [{ name: string, columns: string[], rows: any[][], colWidths?: number[] }]
 */
export function exportExcel({ title, periodLabel, filterLabel, sheets, filename }) {
  const wb = XLSX.utils.book_new()
  sheets.forEach(sheet => {
    const aoa = [
      ["PawonLoka — " + title],
      ["Periode: " + periodLabel],
      ...(filterLabel ? [["Filter: " + filterLabel]] : []),
      [],
      sheet.columns,
      ...sheet.rows,
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws["!cols"] = sheet.columns.map((_, i) => ({ wch: sheet.colWidths?.[i] ?? 18 }))
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
  })
  XLSX.writeFile(wb, filename)
}
