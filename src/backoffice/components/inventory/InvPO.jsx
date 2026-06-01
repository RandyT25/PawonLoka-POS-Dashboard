import { useState, useEffect } from "react"
import { supabase } from "../../../lib/supabase"
import SearchSelect from "../../components/SearchSelect"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("id-ID") }
const UNITS = ["gr","kg","ml","L","Galon","pcs","Ekor","butir","biji","buah","ikat","lembar","bungkus","pack","sachet","botol","tsp","tbsp","cup","porsi","portion"]

function toBaseUnit(ing, qty, purchaseUnit) {
  if (purchaseUnit === ing.unit) return qty
  const conv = (ing.conversions||[]).find(c => c.unit === purchaseUnit)
  if (conv && parseFloat(conv.qty) > 0) return qty * parseFloat(conv.qty)
  const fallbacks = { kg:1000, L:1000, Galon:19000 }
  if (ing.unit==="gr" && fallbacks[purchaseUnit]) return qty * fallbacks[purchaseUnit]
  if (ing.unit==="ml" && fallbacks[purchaseUnit]) return qty * fallbacks[purchaseUnit]
  return qty
}

async function recalcWAC(ing, qtyBase, totalCostForBatch) {
  const oldStock     = parseFloat(ing.stock) || 0
  const oldCost      = parseFloat(ing.cost_per_unit) || 0
  const newTotalCost = (oldStock * oldCost) + totalCostForBatch
  const newStock     = oldStock + qtyBase
  const newWAC       = newStock > 0 ? newTotalCost / newStock : oldCost
  await supabase.from("ingredients").update({ stock:newStock, cost_per_unit:newWAC }).eq("id", ing.id)
  return newWAC
}

const UNIT_TO_BASE = {
  gr:1,g:1,kg:1000,ml:1,mL:1,L:1000,Galon:19000,
  pcs:1,butir:1,biji:1,buah:1,lembar:1,ekor:1,Ekor:1,
  tsp:5,tbsp:15,cup:240,portion:1,porsi:1,slice:1,
  bungkus:1,pack:1,sachet:1,ikat:1,botol:1,
}
function toBaseQty(qty, unit) { return qty * (UNIT_TO_BASE[unit] ?? 1) }

async function cascadeRecalc(updatedIngIds) {
  if (!updatedIngIds.length) return
  const { data: allIngs } = await supabase.from("ingredients").select("id,cost_per_unit,unit,conversions")
  const ingMap = {}
  for (const i of allIngs||[]) ingMap[i.id] = i

  const { data: subLines } = await supabase
    .from("sub_recipe_ingredients").select("sub_recipe_id,ingredient_id,qty,unit")
    .in("ingredient_id", updatedIngIds)
  const affectedSubIds = [...new Set((subLines||[]).map(l => l.sub_recipe_id))]
  const updatedSubIngIds = []

  for (const subId of affectedSubIds) {
    const { data: allSubLines } = await supabase.from("sub_recipe_ingredients").select("*").eq("sub_recipe_id", subId)
    let totalCost = 0
    for (const line of allSubLines||[]) {
      const ing = ingMap[line.ingredient_id]
      if (!ing) continue
      totalCost += toBaseQty(parseFloat(line.qty)||0, line.unit) * (ing.cost_per_unit||0)
    }
    const { data: sub } = await supabase.from("sub_recipes").select("id,ingredient_id,yield_qty").eq("id", subId).single()
    if (sub?.ingredient_id) {
      const costPerYield = totalCost / (parseFloat(sub.yield_qty)||1)
      await supabase.from("ingredients").update({ cost_per_unit:costPerYield }).eq("id", sub.ingredient_id)
      ingMap[sub.ingredient_id] = { ...ingMap[sub.ingredient_id], cost_per_unit:costPerYield }
      updatedSubIngIds.push(sub.ingredient_id)
    }
  }

  const allChangedIds = [...new Set([...updatedIngIds, ...updatedSubIngIds])]
  const { data: dishLines } = await supabase.from("recipes").select("product_id,ingredient_id,qty,unit").in("ingredient_id", allChangedIds)
  const affectedProductIds = [...new Set((dishLines||[]).map(l => l.product_id).filter(Boolean))]

  for (const productId of affectedProductIds) {
    const { data: allDishLines } = await supabase.from("recipes").select("*").eq("product_id", productId)
    let totalCost = 0
    for (const line of allDishLines||[]) {
      const ing = ingMap[line.ingredient_id]
      if (!ing) continue
      totalCost += toBaseQty(parseFloat(line.qty)||0, line.unit) * (ing.cost_per_unit||0)
    }
    const { data: product } = await supabase.from("products").select("price").eq("id", productId).single()
    const price = product?.price || 0
    const margin = price > 0 ? Math.round(((price - totalCost) / price) * 100) : 0
    await supabase.from("products").update({ cogs:Math.round(totalCost), margin }).eq("id", productId)
  }

  if (updatedSubIngIds.length) await cascadeRecalc(updatedSubIngIds)
}

async function processPaidPO(po, ingMap) {
  const updatedIngIds = []
  for (const item of po.po_items||[]) {
    const ing = ingMap[item.ingredient_id]
    if (!ing) continue
    const qtyBase = toBaseUnit(ing, parseFloat(item.qty), item.unit)
    const costPerBase = qtyBase > 0 ? (parseFloat(item.unit_cost)||0) * parseFloat(item.qty) / qtyBase : 0
    const newWAC = await recalcWAC(ing, qtyBase, qtyBase * costPerBase)
    const updatedConvs = (ing.conversions||[]).map(c => c.unit===item.unit ? {...c,last_price:item.unit_cost} : c)
    await supabase.from("ingredients").update({ last_purchase_price:item.unit_cost, last_purchase_unit:item.unit, conversions:updatedConvs }).eq("id", ing.id)
    await supabase.from("stock_movements").insert({
      id:"MOV-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),
      type:"Purchase", ingredient_id:ing.id, ingredient_name:ing.name,
      qty:qtyBase, unit:ing.unit, ref:po.id,
      note:`Received: ${item.qty} ${item.unit} @ ${fmt(item.unit_cost)} → WAC: ${fmt(newWAC)}/${ing.unit}`,
      date:new Date().toISOString().slice(0,10),
      time:new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
    })
    ingMap[ing.id] = { ...ing, stock:(ing.stock||0)+qtyBase, cost_per_unit:newWAC }
    updatedIngIds.push(ing.id)
  }
  await supabase.from("purchase_orders").update({ status:"Paid" }).eq("id", po.id)
  return updatedIngIds
}

export default function InvPO() {
  const [pos,         setPOs]         = useState([])
  const [ingredients, setIngredients] = useState([])
  const [suppliers,   setSuppliers]   = useState([])
  const [filter,      setFilter]      = useState("all")
  const [viewModal,   setViewModal]   = useState(null)
  const [editModal,   setEditModal]   = useState(null)
  const [newPO,       setNewPO]       = useState(false)
  const [selected,    setSelected]    = useState(new Set())
  const [poForm,      setPOForm]      = useState({ supplier_id:"", invoice_no:"", order_date:new Date().toISOString().slice(0,10), due_date:"", notes:"" })
  const [poItems,     setPOItems]     = useState([{ ingredient_id:"", qty:"", unit:"gr", unit_cost:"" }])
  const [saving,      setSaving]      = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [openMenu,    setOpenMenu]    = useState(null)
  const [bayarConfirm,setBayarConfirm]= useState(null)
  const [coaAccounts, setCoaAccounts] = useState([])
  const [payForm,     setPayForm]     = useState({
    payment_account_id: "",
    payment_account_name: "",
    transaction_type: "no_ref",
    transaction_date: new Date().toISOString().slice(0,10),
    transaction_no: "",
    notes: ""
  })
  const [payLines,    setPayLines]    = useState([])

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!openMenu) return
    const handler = () => setOpenMenu(null)
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [openMenu])

  async function load() {
    setLoading(true)
    const [{ data:p }, { data:i }, { data:s }] = await Promise.all([
      supabase.from("purchase_orders").select("*").order("created_at", { ascending:false }),
      supabase.from("ingredients").select("*"),
      supabase.from("suppliers").select("*").eq("active", true),
    ])
    const posNorm = (p||[]).map(po => ({
      ...po,
      supplier_name: po.supplierName || po.supplier_name || "",
      supplier_id:   po.supplierId   || po.supplier_id   || "",
      invoice_no:    po.invoiceNo    || po.invoice_no    || "",
      order_date:    po.date         || po.order_date    || "",
      due_date:      po.dueDate      || po.due_date      || "",
      po_items:      po.items        || po.po_items      || [],
    }))
    setPOs(posNorm); setIngredients(i||[]); setSuppliers(s||[])
    setLoading(false)
  }

  const unpaid  = pos.filter(p => p.status==="Unpaid")
  const paid    = pos.filter(p => p.status==="Paid")
  const overdue = pos.filter(p => p.status==="Unpaid" && p.due_date && new Date(p.due_date)<new Date())
  const voided  = pos.filter(p => p.status==="Void")
  const filtered = filter==="all" ? pos : filter==="unpaid" ? unpaid : filter==="paid" ? paid : filter==="overdue" ? overdue : voided

  const selectedUnpaid = [...selected].filter(id => pos.find(p=>p.id===id&&p.status==="Unpaid"))
  const allFilteredUnpaid = filtered.filter(p=>p.status==="Unpaid")
  const allUnpaidSelected = allFilteredUnpaid.length > 0 && allFilteredUnpaid.every(p=>selected.has(p.id))

  function toggleSelect(id) {
    setSelected(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s })
  }
  function toggleSelectAll() {
    if (allUnpaidSelected) setSelected(prev => { const s=new Set(prev); allFilteredUnpaid.forEach(p=>s.delete(p.id)); return s })
    else setSelected(prev => { const s=new Set(prev); allFilteredUnpaid.forEach(p=>s.add(p.id)); return s })
  }

  async function bulkMarkPaid() {
    const targets = pos.filter(p => selected.has(p.id) && p.status==="Unpaid")
    if (!targets.length) return
    if (!confirm(`Mark ${targets.length} PO(s) as paid?`)) return
    setBulkLoading(true)
    const { data: freshIngs } = await supabase.from("ingredients").select("*")
    const ingMap = {}
    for (const i of freshIngs||[]) ingMap[i.id] = i
    const allUpdatedIds = []
    for (const po of targets) {
      const ids = await processPaidPO(po, ingMap)
      allUpdatedIds.push(...ids)
    }
    if (allUpdatedIds.length) await cascadeRecalc([...new Set(allUpdatedIds)])
    setSelected(new Set())
    await load()
    setBulkLoading(false)
    alert(`✅ ${targets.length} PO(s) marked paid. WAC + COGS updated.`)
  }

  async function bulkVoid() {
    const targets = pos.filter(p => selected.has(p.id) && p.status==="Unpaid")
    if (!targets.length) return
    if (!confirm(`Void ${targets.length} PO(s)?`)) return
    setBulkLoading(true)
    for (const po of targets) {
      await supabase.from("purchase_orders").update({ status:"Void" }).eq("id", po.id)
    }
    setSelected(new Set())
    await load()
    setBulkLoading(false)
  }

  async function loadCoa() {
    const { data } = await supabase.from("chart_of_accounts")
      .select("*")
      .eq("is_active", true)
      .in("category", ["Kas & Bank", "Ayat Silang"])
      .order("sort_order")
    setCoaAccounts(data || [])
  }

  async function genTransactionNo() {
    const today = new Date()
    const yy = String(today.getFullYear()).slice(2)
    const mm = String(today.getMonth()+1).padStart(2,"0")
    const dd = String(today.getDate()).padStart(2,"0")
    const prefix = `PFA/${yy}${mm}${dd}/`
    const { data } = await supabase.from("invoice_payments")
      .select("transaction_no")
      .like("transaction_no", prefix+"%")
      .order("transaction_no", { ascending:false })
      .limit(1)
    const last = data?.[0]?.transaction_no
    const seq = last ? parseInt(last.split("/").pop()) + 1 : 1
    return prefix + String(seq).padStart(4,"0")
  }

  async function openBayarFaktur(po) {
    await loadCoa()
    const txNo = await genTransactionNo()
    setPayForm({
      payment_account_id: "",
      payment_account_name: "",
      transaction_type: "no_ref",
      transaction_date: new Date().toISOString().slice(0,10),
      transaction_no: txNo,
      notes: ""
    })
    setPayLines([{
      po_id: po.id,
      invoice_no: po.invoice_no || po.id?.slice(0,12) || "—",
      due_date: po.due_date || "—",
      billed: po.total || 0,
      discount: 0,
      payment: 0,
      po_ref: po
    }])
    setBayarConfirm(po)
  }

  async function submitBayar() {
    if (!payForm.payment_account_id) { alert("Pilih Jenis Pembayaran terlebih dahulu"); return }
    const totalPaid = payLines.reduce((a,l)=>a+(parseFloat(l.payment)||0),0)
    if (totalPaid <= 0) { alert("Jumlah pembayaran harus lebih dari 0"); return }
    setSaving(true)
    try {
      const { data: freshIngs } = await supabase.from("ingredients").select("*")
      const ingMap = {}
      for (const i of freshIngs||[]) ingMap[i.id] = i
      const allUpdatedIds = []
      for (const line of payLines) {
        const paid = parseFloat(line.payment) || 0
        const billed = parseFloat(line.billed) || 0
        const newStatus = paid >= billed ? "Paid" : paid > 0 ? "Partial" : "Unpaid"
        if (paid > 0) {
          const updatedIds = await processPaidPO(line.po_ref, ingMap)
          allUpdatedIds.push(...updatedIds)
          await supabase.from("purchase_orders").update({
            status: newStatus,
            paid_at: new Date().toISOString(),
            paid_amount: paid,
            discount_amount: parseFloat(line.discount)||0
          }).eq("id", line.po_id)
        }
      }
      if (allUpdatedIds.length) await cascadeRecalc(allUpdatedIds)
      await supabase.from("invoice_payments").insert({
        transaction_no: payForm.transaction_no,
        outlet: "PawonLoka",
        payment_account_id: payForm.payment_account_id,
        payment_account_name: payForm.payment_account_name,
        transaction_type: payForm.transaction_type,
        transaction_date: payForm.transaction_date,
        invoices: payLines.map(l=>({ po_id:l.po_id, invoice_no:l.invoice_no, billed:l.billed, discount:l.discount, payment:l.payment })),
        total_billed: payLines.reduce((a,l)=>a+(parseFloat(l.billed)||0),0),
        total_discount: payLines.reduce((a,l)=>a+(parseFloat(l.discount)||0),0),
        total_paid: totalPaid,
        notes: payForm.notes
      })
      await load()
      setBayarConfirm(null)
      alert("Pembayaran berhasil disimpan")
    } catch(e) {
      alert("Error: " + e.message)
    }
    setSaving(false)
  }

  async function voidPO(po) {
    if (!confirm('Void this PO? Stock changes will NOT be reversed automatically.')) return
    await supabase.from('purchase_orders').update({ status:'Void' }).eq('id', po.id)
    await load()
  }
  async function markPaid(po) {
    if (!confirm(`Mark ${po.id} as paid?`)) return
    const { data: freshIngs } = await supabase.from("ingredients").select("*")
    const ingMap = {}
    for (const i of freshIngs||[]) ingMap[i.id] = i
    const updatedIds = await processPaidPO(po, ingMap)
    if (updatedIds.length) await cascadeRecalc(updatedIds)
    await load(); setViewModal(null)
    alert(`✅ Paid. WAC + COGS updated.`)
  }

  async function voidPO(po) {
    if (!confirm(`Void ${po.id}?`)) return
    await supabase.from("purchase_orders").update({ status:"Void" }).eq("id", po.id)
    await load(); setViewModal(null)
  }

  async function deletePO(po) {
    if (!confirm(`Delete ${po.id}? Cannot be undone.`)) return
    await supabase.from("purchase_orders").delete().eq("id", po.id)
    await load(); setViewModal(null)
  }

  function addPOItem()     { setPOItems(items => [...items, { ingredient_id:"", qty:"", unit:"gr", unit_cost:"" }]) }
  function removePOItem(i) { setPOItems(items => items.filter((_,idx)=>idx!==i)) }
  function updatePOItem(i,k,v) {
    setPOItems(items => items.map((x,idx) => {
      if (idx!==i) return x
      const updated = {...x,[k]:v}
      if (k==="ingredient_id") {
        const ing = ingredients.find(ing=>ing.id===v)
        if (ing) { updated.unit=ing.unit; updated.unit_cost=String(ing.cost_per_unit||0) }
      }
      return updated
    }))
  }
  function getUnits(ingId) {
    const ing = ingredients.find(i=>i.id===ingId)
    if (!ing) return UNITS
    return [ing.unit, ...(ing.conversions||[]).map(c=>c.unit).filter(u=>u!==ing.unit)]
  }
  const grandTotal = poItems.reduce((a,item) => a+(parseFloat(item.qty)||0)*(parseFloat(item.unit_cost)||0), 0)

  async function submitPO(isEdit=false) {
    const sup = suppliers.find(s=>s.id===poForm.supplier_id)
    if (!sup) { alert("Select a supplier"); return }
    const validItems = poItems.filter(i=>i.ingredient_id&&parseFloat(i.qty)>0)
    if (!validItems.length) { alert("Add at least one item"); return }
    setSaving(true)
    const poItems_json = validItems.map(item => {
      const ing = ingredients.find(i=>i.id===item.ingredient_id)
      return { ingredient_id:item.ingredient_id, name:ing?.name||"", qty:parseFloat(item.qty), unit:item.unit, unit_cost:parseFloat(item.unit_cost)||0, total_cost:(parseFloat(item.qty)||0)*(parseFloat(item.unit_cost)||0) }
    })
    const payload = {
      supplierId:sup.id, supplierName:sup.name,
      invoiceNo:poForm.invoice_no, date:poForm.order_date,
      dueDate:poForm.due_date||null, notes:poForm.notes||null,
      status:"Unpaid", subtotal:grandTotal, total:grandTotal, items:poItems_json
    }
    if (isEdit) {
      await supabase.from("purchase_orders").update(payload).eq("id", editModal.id)
    } else {
      await supabase.from("purchase_orders").insert({ id:"PO-"+Date.now(), ...payload })
    }
    await load()
    setNewPO(false); setEditModal(null)
    setPOForm({ supplier_id:"", invoice_no:"", order_date:new Date().toISOString().slice(0,10), due_date:"", notes:"" })
    setPOItems([{ ingredient_id:"", qty:"", unit:"gr", unit_cost:"" }])
    setSaving(false)
  }

  function openEdit(po) {
    setPOForm({ supplier_id:po.supplier_id||"", invoice_no:po.invoice_no||"", order_date:po.order_date||"", due_date:po.due_date||"", notes:po.notes||"" })
    setPOItems((po.po_items||[]).map(i=>({ ingredient_id:i.ingredient_id, qty:String(i.qty), unit:i.unit, unit_cost:String(i.unit_cost) })))
    setEditModal(po)
  }


  return (
    <div>
      <div className="bo-metrics" style={{ gridTemplateColumns:"repeat(5,1fr)", marginBottom:16 }}>
        <div className="bo-met blue"><div className="bo-met-label">Faktur Pembelian</div><div className="bo-met-val">{fmt(pos.reduce((a,p)=>a+(p.total||0),0))}</div><div className="bo-met-sub">{pos.length} faktur</div></div>
        <div className="bo-met amber"><div className="bo-met-label">Belum Dibayar</div><div className="bo-met-val">{fmt(unpaid.reduce((a,p)=>a+(p.total||0),0))}</div><div className="bo-met-sub">{unpaid.length} faktur</div></div>
        <div className="bo-met green"><div className="bo-met-label">Sudah Dibayar</div><div className="bo-met-val">{fmt(paid.reduce((a,p)=>a+(p.total||0),0))}</div><div className="bo-met-sub">{paid.length} faktur</div></div>
        <div className="bo-met red"><div className="bo-met-label">Jatuh Tempo</div><div className="bo-met-val">{fmt(overdue.reduce((a,p)=>a+(p.total||0),0))}</div><div className="bo-met-sub">{overdue.length} faktur</div></div>
        <div className="bo-met" style={{ borderTop:"3px solid #DE350B" }}><div className="bo-met-label">Void</div><div className="bo-met-val">{fmt(voided.reduce((a,p)=>a+(p.total||0),0))}</div><div className="bo-met-sub">{voided.length} faktur</div></div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {[["all",`Semua (${pos.length})`],["unpaid",`Belum Lunas (${unpaid.length})`],["paid",`Lunas (${paid.length})`],["overdue",`Jatuh Tempo (${overdue.length})`],["voided",`Void (${voided.length})`]].map(([f,l])=>(
            <button key={f} onClick={()=>setFilter(f)} className={"bo-btn bo-btn-sm "+(filter===f?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
          ))}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          {selectedUnpaid.length > 0 && <>
            <span style={{ fontSize:12, color:"var(--ink4)" }}>{selectedUnpaid.length} selected</span>
            <button onClick={bulkMarkPaid} disabled={bulkLoading} className="bo-btn bo-btn-sm" style={{ background:"var(--green-lt)", color:"var(--green)", border:"none", cursor:"pointer", borderRadius:"var(--r)", padding:"5px 11px", fontSize:12, fontWeight:600 }}>
              {bulkLoading?"Processing...":"✓ Pay Selected"}
            </button>
            <button onClick={bulkVoid} disabled={bulkLoading} className="bo-btn bo-btn-danger bo-btn-sm">Void Selected</button>
          </>}
          <button onClick={()=>setNewPO(true)} className="bo-btn bo-btn-primary">+ New PO</button>
        </div>
      </div>

      <div className="bo-card" style={{ padding:0, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
          <table className="bo-table">
            <thead>
              <tr>
                <th style={{ width:36 }}>
                  <input type="checkbox" checked={allUnpaidSelected} onChange={toggleSelectAll} style={{ width:15, height:15, accentColor:"var(--brand)", cursor:"pointer" }} />
                </th>
                <th>TANGGAL</th><th>NAMA PEMASOK</th><th>NO FAKTUR</th><th>JENIS PEMBELIAN</th><th>PRODUK</th><th>JUMLAH</th><th>JATUH TEMPO</th><th>STATUS</th><th style={{ width:48 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(po => {
                const isOverdue = po.status==="Unpaid" && po.due_date && new Date(po.due_date)<new Date()
                const isUnpaid = po.status==="Unpaid"
                const statusLabel = po.status==="Paid" ? "Lunas" : po.status==="Void" ? "Void" : isOverdue ? "Jatuh Tempo" : "Belum Lunas"
                const statusColor = po.status==="Paid" ? "#00875A" : po.status==="Void" ? "#97A0AF" : isOverdue ? "#DE350B" : "#FF8B00"
                const items = po.po_items || []
                const itemNames = items.slice(0,2).map(i=>i.name).filter(Boolean)
                const extraCount = items.length - 2
                return (
                  <tr key={po.id} style={{ background:selected.has(po.id)?"var(--brand-lt)":"", position:"relative" }}>
                    <td>{isUnpaid && <input type="checkbox" checked={selected.has(po.id)} onChange={()=>toggleSelect(po.id)} style={{ width:15, height:15, accentColor:"var(--brand)", cursor:"pointer" }} />}</td>
                    <td style={{ fontSize:12 }}>{po.order_date ? new Date(po.order_date).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "—"}</td>
                    <td style={{ fontWeight:600 }}>{po.supplier_name || "Tanpa Pemasok"}</td>
                    <td style={{ fontSize:12, fontFamily:"monospace", color:"var(--ink4)" }}>{po.invoice_no || po.id?.slice(0,12) || "—"}</td>
                    <td style={{ fontSize:12 }}>{"Barang Jual"}</td>
                    <td style={{ fontSize:12 }}>
                      {itemNames.map((n,i)=><div key={i}>{n}</div>)}
                      {extraCount>0 && <div style={{ color:"var(--brand)", fontSize:11, fontWeight:600 }}>+{extraCount} Produk</div>}
                      {itemNames.length===0 && <span style={{ color:"var(--ink5)" }}>—</span>}
                    </td>
                    <td style={{ fontWeight:700, color:"var(--brand)" }}>{fmt(po.total)}</td>
                    <td style={{ fontSize:12, color:isOverdue?"#DE350B":"var(--ink4)" }}>{po.due_date ? new Date(po.due_date).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "—"}</td>
                    <td>
                      <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:10, background:statusColor+"22", color:statusColor, whiteSpace:"nowrap" }}>
                        {statusLabel}
                      </span>
                    </td>
                    <td style={{ position:"relative" }}>
                      <button
                        onClick={e=>{e.stopPropagation(); setOpenMenu(prev=>prev===po.id?null:po.id)}}
                        className="bo-btn bo-btn-ghost bo-btn-sm"
                        style={{ padding:"4px 10px", fontWeight:700, fontSize:15, letterSpacing:1 }}
                      >...</button>
                      {openMenu===po.id && (
                        <div onClick={e=>e.stopPropagation()} style={{ position:"fixed", right:16, background:"#fff", border:"1px solid #E8ECF0", borderRadius:10, boxShadow:"0 4px 20px rgba(0,0,0,0.15)", zIndex:9999, minWidth:180, padding:"6px 0" }}>
                          <button onClick={()=>{setOpenMenu(null);setViewModal(po)}} style={{ display:"block", width:"100%", textAlign:"left", padding:"9px 16px", fontSize:13, background:"none", border:"none", cursor:"pointer", color:"var(--ink1)" }}>Detail</button>
                          {isUnpaid && <button onClick={()=>{setOpenMenu(null);openBayarFaktur(po)}} style={{ display:"block", width:"100%", textAlign:"left", padding:"9px 16px", fontSize:13, background:"none", border:"none", cursor:"pointer", color:"var(--ink1)" }}>Bayar Faktur</button>}
                          {isUnpaid && <button onClick={()=>{setOpenMenu(null);openEdit(po)}} style={{ display:"block", width:"100%", textAlign:"left", padding:"9px 16px", fontSize:13, background:"none", border:"none", cursor:"pointer", color:"var(--ink1)" }}>Edit</button>}
                          <div style={{ height:1, background:"#F0F4F8", margin:"4px 0" }} />
                          {isUnpaid && <button onClick={()=>{setOpenMenu(null);voidPO(po)}} style={{ display:"block", width:"100%", textAlign:"left", padding:"9px 16px", fontSize:13, background:"none", border:"none", cursor:"pointer", color:"#DE350B" }}>Void</button>}
                          {po.status==="Paid" && <button onClick={()=>{setOpenMenu(null);voidPO(po)}} style={{ display:"block", width:"100%", textAlign:"left", padding:"9px 16px", fontSize:13, background:"none", border:"none", cursor:"pointer", color:"#DE350B" }}>Void</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length===0 && <tr><td colSpan={10} style={{ textAlign:"center", color:"var(--ink5)", padding:"32px 0" }}>Tidak ada faktur pembelian</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {viewModal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setViewModal(null)}>
          <div className="bo-modal" style={{ maxWidth:600 }}>
            <div className="bo-modal-header">
              <div>
                <div className="bo-modal-title">{viewModal.id}</div>
                <div style={{ fontSize:11, color:"var(--ink5)" }}>{viewModal.invoice_no} · {viewModal.supplier_name}</div>
              </div>
              <button className="bo-modal-close" onClick={()=>setViewModal(null)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <table className="bo-table">
                <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit Cost</th><th>Total</th></tr></thead>
                <tbody>
                  {(viewModal.po_items||[]).map((item,i) => (
                    <tr key={i}>
                      <td>{item.name}</td><td>{item.qty}</td><td>{item.unit}</td>
                      <td>{fmt(item.unit_cost)}</td>
                      <td style={{ fontWeight:700, color:"var(--brand)" }}>{fmt(item.total_cost)}</td>
                    </tr>
                  ))}
                  <tr style={{ background:"var(--surface)" }}>
                    <td colSpan={4} style={{ fontWeight:700 }}>Total</td>
                    <td style={{ fontWeight:900, fontSize:15, color:"var(--brand)" }}>{fmt(viewModal.total)}</td>
                  </tr>
                </tbody>
              </table>
              {viewModal.notes && <div style={{ marginTop:12, padding:10, background:"var(--surface)", borderRadius:"var(--r)", fontSize:13 }}>{viewModal.notes}</div>}
              <div style={{ marginTop:12, padding:"10px 14px", background:viewModal.status==="Paid"?"var(--green-lt)":"var(--amber-lt)", borderRadius:"var(--r)", fontSize:12, fontWeight:700, color:viewModal.status==="Paid"?"var(--green)":"var(--amber)" }}>
                {viewModal.status==="Paid" ? "✅ Paid — WAC + COGS updated" : "⏳ Payment pending"}
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setViewModal(null)} className="bo-btn bo-btn-ghost">Close</button>
              {viewModal.status==="Unpaid" && <>
                <button onClick={()=>{setViewModal(null);openEdit(viewModal)}} className="bo-btn bo-btn-ghost">Edit</button>
                <button onClick={()=>deletePO(viewModal)} className="bo-btn bo-btn-danger">Delete</button>
                <button onClick={()=>markPaid(viewModal)} className="bo-btn bo-btn-primary">✓ Mark as Paid</button>
              </>}
              {viewModal.status==="Paid" && (
                <button onClick={()=>{ voidPO(viewModal); setViewModal(null) }} className="bo-btn bo-btn-danger">Void PO</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bayar Faktur Modal */}
      {bayarConfirm && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setBayarConfirm(null)}>
          <div className="bo-modal" style={{ maxWidth:680, maxHeight:"94vh", display:"flex", flexDirection:"column", width:"95vw" }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">Bayar Faktur</div>
              <button className="bo-modal-close" onClick={()=>setBayarConfirm(null)}>x</button>
            </div>
            <div className="bo-modal-body" style={{ overflowY:"auto", flex:1 }}>

              {/* Section 1: Informasi Pembayaran */}
              <div style={{ background:"#fff", borderRadius:12, border:"1px solid #E8ECF0", padding:"18px 20px", marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:800, color:"var(--ink1)", marginBottom:16 }}>Informasi Pembayaran Faktur</div>
                <div style={{ display:"grid", gridTemplateColumns:"130px 1fr", gap:"10px 14px", alignItems:"start" }}>

                  <label style={{ fontSize:13, fontWeight:600, paddingTop:8 }}>Pilih Outlet</label>
                  <input className="bo-input" value="PawonLoka" disabled style={{ background:"#F4F5F7" }} />

                  <label style={{ fontSize:13, fontWeight:600, paddingTop:8 }}>Jenis Pembayaran <span style={{ color:"red" }}>*</span></label>
                  <select className="bo-select"
                    value={payForm.payment_account_id}
                    onChange={e=>{
                      const acct = coaAccounts.find(a=>a.id===e.target.value)
                      setPayForm(f=>({...f, payment_account_id:e.target.value, payment_account_name:acct?`${acct.code} - ${acct.name}`:""}))
                    }}
                    style={{ borderColor: !payForm.payment_account_id ? "var(--brand)" : "" }}
                  >
                    <option value="">Pilih</option>
                    {coaAccounts.map(a=>(
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>

                  <label style={{ fontSize:13, fontWeight:600, paddingTop:8 }}>Jenis Transaksi</label>
                  <div style={{ display:"flex", gap:10 }}>
                    {[["stock_order","Pemesanan Stok"],["no_ref","Tanpa Nomor Referensi"]].map(([v,l])=>(
                      <label key={v} onClick={()=>setPayForm(f=>({...f,transaction_type:v}))}
                        style={{ flex:1, display:"flex", alignItems:"center", gap:8, padding:"10px 14px", borderRadius:8,
                          border:`1.5px solid ${payForm.transaction_type===v?"var(--brand)":"#DFE1E6"}`,
                          cursor:"pointer", fontSize:13 }}>
                        <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${payForm.transaction_type===v?"var(--brand)":"#DFE1E6"}`,
                          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          {payForm.transaction_type===v && <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--brand)" }} />}
                        </div>
                        {l}
                      </label>
                    ))}
                  </div>

                  <label style={{ fontSize:13, fontWeight:600, paddingTop:8 }}>Tanggal Transaksi</label>
                  <input type="date" className="bo-input" value={payForm.transaction_date}
                    onChange={e=>setPayForm(f=>({...f,transaction_date:e.target.value}))} />

                  <label style={{ fontSize:13, fontWeight:600, paddingTop:8 }}>No Transaksi</label>
                  <div>
                    <input className="bo-input" value={payForm.transaction_no}
                      onChange={e=>setPayForm(f=>({...f,transaction_no:e.target.value}))}
                      placeholder="Contoh: PFA/260601/0001" />
                    <div style={{ fontSize:11, color:"var(--ink5)", marginTop:4 }}>Nomor transaksi akan terisi otomatis jika dikosongkan</div>
                  </div>

                </div>
              </div>

              {/* Section 2: Daftar Pembelian */}
              <div style={{ background:"#fff", borderRadius:12, border:"1px solid #E8ECF0", padding:"18px 20px", marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:"var(--ink1)" }}>Daftar Pembelian</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button
                      onClick={()=>setPayLines(prev=>prev.map(l=>({...l,discount:0,payment:l.billed})))}
                      className="bo-btn bo-btn-ghost bo-btn-sm">Bayar Semua</button>
                    <button
                      onClick={()=>{
                        const remaining = pos.filter(p=>p.status==="Unpaid"&&!payLines.find(l=>l.po_id===p.id))
                        if(remaining.length===0){alert("Tidak ada faktur lain yang belum dibayar");return}
                        const first = remaining[0]
                        setPayLines(prev=>[...prev,{po_id:first.id,invoice_no:first.invoice_no||first.id?.slice(0,12)||"—",due_date:first.due_date||"—",billed:first.total||0,discount:0,payment:0,po_ref:first}])
                      }}
                      className="bo-btn bo-btn-primary bo-btn-sm">+ Faktur Pembelian</button>
                  </div>
                </div>
                <div>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:"#F8FAFC" }}>
                        {["TANGGAL PEMBELIAN","NO FAKTUR","JATUH TEMPO","TAGIHAN","POTONGAN","PEMBAYARAN",""].map(h=>(
                          <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--ink4)", borderBottom:"1px solid #E8ECF0", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payLines.map((line,i)=>(
                        <tr key={i} style={{ borderBottom:"1px solid #F0F4F8" }}>
                          <td style={{ padding:"10px 12px", fontSize:12 }}>
                            {line.po_ref?.order_date ? new Date(line.po_ref.order_date).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "—"}
                          </td>
                          <td style={{ padding:"10px 12px", fontSize:12, fontFamily:"monospace" }}>{line.invoice_no}</td>
                          <td style={{ padding:"10px 12px", fontSize:12 }}>{line.due_date && line.due_date!=="—" ? new Date(line.due_date).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "—"}</td>
                          <td style={{ padding:"10px 12px", fontSize:13, fontWeight:700 }}>Rp {Number(line.billed).toLocaleString("id-ID")}</td>
                          <td style={{ padding:"10px 12px" }}>
                            <div style={{ position:"relative" }}>
                              <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"var(--ink4)", pointerEvents:"none" }}>Rp</span>
                              <input type="number" className="bo-input" style={{ width:"100%", fontSize:13, paddingLeft:28 }}
                                value={line.discount||""}
                                placeholder="0"
                                onChange={e=>{
                                  const d = parseFloat(e.target.value)||0
                                  setPayLines(prev=>prev.map((l,j)=>j===i?{...l,discount:d,payment:Math.max(0,l.billed-d)}:l))
                                }} />
                            </div>
                          </td>
                          <td style={{ padding:"10px 12px" }}>
                            <div style={{ position:"relative" }}>
                              <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"var(--ink4)", pointerEvents:"none" }}>Rp</span>
                              <input type="number" className="bo-input" style={{ width:"100%", fontSize:13, paddingLeft:28 }}
                                value={line.payment||""}
                                placeholder="0"
                                onChange={e=>setPayLines(prev=>prev.map((l,j)=>j===i?{...l,payment:parseFloat(e.target.value)||0}:l))} />
                            </div>
                          </td>
                          <td style={{ padding:"10px 12px" }}>
                            {payLines.length > 1 && (
                              <button onClick={()=>setPayLines(prev=>prev.filter((_,j)=>j!==i))}
                                style={{ background:"none", border:"none", cursor:"pointer", color:"#DE350B", fontSize:16 }}>x</button>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background:"#F8FAFC", fontWeight:700 }}>
                        <td colSpan={3} style={{ padding:"10px 12px", fontSize:13 }}>Total</td>
                        <td style={{ padding:"10px 12px", fontSize:13, fontWeight:800 }}>Rp {payLines.reduce((a,l)=>a+(parseFloat(l.billed)||0),0).toLocaleString("id-ID")}</td>
                        <td style={{ padding:"10px 12px", fontSize:13 }}>Rp {payLines.reduce((a,l)=>a+(parseFloat(l.discount)||0),0).toLocaleString("id-ID")}</td>
                        <td style={{ padding:"10px 12px", fontSize:13, fontWeight:800, color:"var(--brand)" }}>
                          Rp {payLines.reduce((a,l)=>a+(parseFloat(l.payment)||0),0).toLocaleString("id-ID")}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div style={{ background:"#fff", borderRadius:12, border:"1px solid #E8ECF0", padding:"16px 20px" }}>
                <label className="bo-label">Keterangan</label>
                <textarea className="bo-input" rows={2} value={payForm.notes}
                  onChange={e=>setPayForm(f=>({...f,notes:e.target.value}))}
                  placeholder="Catatan pembayaran..." />
              </div>

            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setBayarConfirm(null)} className="bo-btn bo-btn-ghost">Batal</button>
              <button onClick={submitBayar} disabled={saving} className="bo-btn bo-btn-primary">
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {newPO && <POFormModal title="Create Purchase Order" onSubmit={()=>submitPO(false)} onClose={()=>{setNewPO(false);setPOItems([{ingredient_id:"",qty:"",unit:"gr",unit_cost:""}])}} suppliers={suppliers} ingredients={ingredients} poForm={poForm} setPOForm={setPOForm} poItems={poItems} addPOItem={addPOItem} removePOItem={removePOItem} updatePOItem={updatePOItem} getUnits={getUnits} grandTotal={grandTotal} saving={saving} />}
      {editModal && <POFormModal title="Save Changes" onSubmit={()=>submitPO(true)} onClose={()=>{setEditModal(null);setPOItems([{ingredient_id:"",qty:"",unit:"gr",unit_cost:""}])}} suppliers={suppliers} ingredients={ingredients} poForm={poForm} setPOForm={setPOForm} poItems={poItems} addPOItem={addPOItem} removePOItem={removePOItem} updatePOItem={updatePOItem} getUnits={getUnits} grandTotal={grandTotal} saving={saving} />}
    </div>
  )
}

function fmt2(n) { return "Rp " + Number(n||0).toLocaleString("id-ID") }
function POFormModal({ title, onSubmit, onClose, suppliers, ingredients, poForm, setPOForm, poItems, addPOItem, removePOItem, updatePOItem, getUnits, grandTotal, saving }) {
  return (
    <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bo-modal" style={{ maxWidth:700, maxHeight:"94vh" }}>
        <div className="bo-modal-header">
          <div className="bo-modal-title">{title}</div>
          <button className="bo-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="bo-modal-body" style={{ overflowY:"auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div><label className="bo-label">Supplier *</label>
              <SearchSelect
                options={suppliers}
                value={poForm.supplier_id}
                onChange={v=>setPOForm(f=>({...f,supplier_id:v}))}
                placeholder="— Search supplier —"
                labelKey="name" valueKey="id"
              />
            </div>
            <div><label className="bo-label">Invoice No.</label><input value={poForm.invoice_no} onChange={e=>setPOForm(f=>({...f,invoice_no:e.target.value}))} className="bo-input" placeholder="INV/001" /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div><label className="bo-label">Order Date</label><input type="date" value={poForm.order_date} onChange={e=>setPOForm(f=>({...f,order_date:e.target.value}))} className="bo-input" /></div>
            <div><label className="bo-label">Due Date</label><input type="date" value={poForm.due_date} onChange={e=>setPOForm(f=>({...f,due_date:e.target.value}))} className="bo-input" /></div>
          </div>
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <label className="bo-label" style={{ marginBottom:0 }}>Items *</label>
              <button onClick={addPOItem} className="bo-btn bo-btn-ghost bo-btn-sm">+ Add Item</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 100px 130px 36px", gap:6, marginBottom:6 }} className="po-items-header">
              {["INGREDIENT","QTY","UNIT","UNIT COST",""].map((h,i)=><div key={i} style={{ fontSize:10, fontWeight:700, color:"var(--ink4)" }}>{h}</div>)}
            </div>
            {poItems.map((item,i) => (
              <div key={i} className="po-item-row" style={{ display:"grid", gridTemplateColumns:"2fr 80px 100px 130px 36px", gap:6, marginBottom:8 }}>
                <SearchSelect
                  options={ingredients}
                  value={item.ingredient_id}
                  onChange={v=>updatePOItem(i,"ingredient_id",v)}
                  placeholder="— Search ingredient —"
                  labelKey="name" valueKey="id"
                  renderOption={o=><span>{o.name} <span style={{fontSize:10,color:"var(--ink5)"}}>({o.unit})</span></span>}
                />
                <input type="number" value={item.qty} onChange={e=>updatePOItem(i,"qty",e.target.value)} className="bo-input" placeholder="0" />
                <select value={item.unit} onChange={e=>updatePOItem(i,"unit",e.target.value)} className="bo-select">
                  {getUnits(item.ingredient_id).map(u=><option key={u}>{u}</option>)}
                </select>
                <input type="number" value={item.unit_cost} onChange={e=>updatePOItem(i,"unit_cost",e.target.value)} className="bo-input" placeholder="Price/unit" />
                <button onClick={()=>removePOItem(i)} className="bo-btn bo-btn-danger bo-btn-sm" style={{ padding:"0 10px" }}>✕</button>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 16px", background:"var(--surface)", borderRadius:"var(--r)", marginTop:8 }}>
              <span style={{ fontWeight:700 }}>Grand Total</span>
              <span style={{ fontSize:18, fontWeight:900, color:"var(--brand)" }}>{fmt2(grandTotal)}</span>
            </div>
          </div>
          <div className="bo-form-row"><label className="bo-label">Notes</label><textarea value={poForm.notes} onChange={e=>setPOForm(f=>({...f,notes:e.target.value}))} className="bo-input" rows={2} /></div>
        </div>
        <div className="bo-modal-footer">
          <button onClick={onClose} className="bo-btn bo-btn-ghost">Cancel</button>
          <button onClick={onSubmit} disabled={saving} className="bo-btn bo-btn-primary">{saving?"Saving...":title}</button>
        </div>
      </div>
    </div>
  )
}
