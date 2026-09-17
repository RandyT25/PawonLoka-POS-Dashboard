const fs = require('fs');
let content = fs.readFileSync('src/backoffice/components/inventory/InvPO.jsx', 'utf8');

const duplicateFunc = `  function openEdit(po) {
    setPOForm({ supplier_id:po.supplier_id||"", invoice_no:po.invoice_no||"", order_date:po.order_date||"", due_date:po.due_date||"", notes:po.notes||"" })
    setPOItems((po.po_items||[]).map(i=>{
      const qty       = parseFloat(i.qty)       || 0
      const unit_cost = parseFloat(i.unit_cost) || 0
      const total_cost = i.total_cost != null ? parseFloat(i.total_cost) : qty * unit_cost
      return { ingredient_id:i.ingredient_id, qty:String(i.qty), unit:i.unit, total_cost:String(total_cost), unit_cost:String(unit_cost) }
    }))
    setEditModal(po)
  }

  function openDuplicate(po) {
    setPOForm({ supplier_id:po.supplier_id||"", invoice_no:"", order_date:new Date().toISOString().split("T")[0], due_date:po.due_date||"", notes:(po.notes||"") + " (Copy)" })
    setPOItems((po.po_items||[]).map(i=>{
      const qty       = parseFloat(i.qty)       || 0
      const unit_cost = parseFloat(i.unit_cost) || 0
      const total_cost = i.total_cost != null ? parseFloat(i.total_cost) : qty * unit_cost
      return { ingredient_id:i.ingredient_id, qty:String(i.qty), unit:i.unit, total_cost:String(total_cost), unit_cost:String(unit_cost) }
    }))
    setNewPO(true)
  }`;

content = content.replace(/  function openEdit\(po\) \{\n    setPOForm\(\{ supplier_id:po.supplier_id\|\|"", invoice_no:po.invoice_no\|\|"", order_date:po.order_date\|\|"", due_date:po.due_date\|\|"", notes:po.notes\|\|"" \}\)\n    setPOItems\(\(po.po_items\|\|\[\]\).map\(i=>\{\n      const qty       = parseFloat\(i.qty\)       \|\| 0\n      const unit_cost = parseFloat\(i.unit_cost\) \|\| 0\n      const total_cost = i.total_cost != null \? parseFloat\(i.total_cost\) : qty \* unit_cost\n      return \{ ingredient_id:i.ingredient_id, qty:String\(i.qty\), unit:i.unit, total_cost:String\(total_cost\), unit_cost:String\(unit_cost\) \}\n    \}\)\)\n    setEditModal\(po\)\n  \}/, duplicateFunc);

// Add button to view modal
content = content.replace(
  /\{viewModal\.status==="Paid" && \(\n\s*<button onClick=\{\(\)=>\{ voidPO\(viewModal\); setViewModal\(null\) \}\} className="bo-btn bo-btn-danger">Void PO<\/button>\n\s*\)\}/,
  `{viewModal.status==="Paid" && (
                <>
                  <button onClick={()=>{openDuplicate(viewModal); setViewModal(null)}} className="bo-btn bo-btn-ghost">Duplicate</button>
                  <button onClick={()=>{ voidPO(viewModal); setViewModal(null) }} className="bo-btn bo-btn-danger">Void PO</button>
                </>
              )}`
);

// Add button to non-paid view modal
content = content.replace(
  /<button onClick=\{\(\)=>\{setViewModal\(null\);openEdit\(viewModal\)\}\} className="bo-btn bo-btn-ghost">Edit<\/button>/,
  `<button onClick={()=>{openDuplicate(viewModal); setViewModal(null)}} className="bo-btn bo-btn-ghost">Duplicate</button>
                <button onClick={()=>{setViewModal(null);openEdit(viewModal)}} className="bo-btn bo-btn-ghost">Edit</button>`
);

fs.writeFileSync('src/backoffice/components/inventory/InvPO.jsx', content);
