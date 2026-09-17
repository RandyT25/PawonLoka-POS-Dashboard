const fs = require('fs');
let content = fs.readFileSync('src/backoffice/components/inventory/InvPO.jsx', 'utf8');

const regex = /    if \(isEdit\) \{\n      const \{ error \} = await supabase.from\("purchase_orders"\).update\(payload\).eq\("id", editModal.id\)\n      if \(error\) \{ alert\("Error saving PO: " \+ error.message\); setSaving\(false\); return; \}\n    \}/;

const replaceWith = `    if (isEdit) {
      if (editModal.status === "Paid") {
        if (!confirm("This PO is already Paid. Saving edits will recalculate stock and COGS. Continue?")) {
          setSaving(false);
          return;
        }
        payload.status = "Paid";
        
        try {
          const { data: freshIngs } = await supabase.from("ingredients").select("*");
          const ingMap = {};
          for (const i of freshIngs||[]) ingMap[i.id] = i;
          
          // 1. Compute reversal of the OLD po
          const { ingUpdates: revUpdates, movements: revMovs } = computeVoidPOChanges(editModal, ingMap);
          
          // Apply reversals to ingMap so forward computation uses the reverted state
          for (const [ingId, up] of Object.entries(revUpdates)) {
            ingMap[ingId] = { ...ingMap[ingId], ...up };
          }
          
          // 2. Compute forward application of the NEW po
          const mockNewPo = { id: editModal.id, po_items: poItems_json };
          const { updatedIngIds, ingUpdates: fwdUpdates, movements: fwdMovs } = computePaidPOChanges(mockNewPo, ingMap);
          
          // Merge updates (fwd overrides rev)
          const finalIngUpdates = { ...revUpdates, ...fwdUpdates };
          const finalMovements = [...revMovs, ...fwdMovs];
          
          // 3. Persist everything
          await Promise.all([
             persistPaidPOChanges(finalIngUpdates, finalMovements),
             supabase.from("purchase_orders").update(payload).eq("id", editModal.id)
          ]);
          
          const recalcIds = [...new Set([...(editModal.po_items||[]).map(i=>i.ingredient_id), ...updatedIngIds])].filter(Boolean);
          if (recalcIds.length) {
             await flagNeedsRecalc(recalcIds);
             await cascadeRecalc(recalcIds);
          }
        } catch(e) {
          alert("Error updating Paid PO: " + e.message);
          setSaving(false);
          return;
        }
      } else {
        const { error } = await supabase.from("purchase_orders").update(payload).eq("id", editModal.id)
        if (error) { alert("Error saving PO: " + error.message); setSaving(false); return; }
      }
    }`;

content = content.replace(regex, replaceWith);

// Also we need to make sure the Edit button is shown for Paid POs again!
// We had removed the original Edit and only put Duplicate + Void PO.
content = content.replace(
  /                  <button onClick=\{\(\)=>\{openDuplicate\(viewModal\); setViewModal\(null\)\}\} className="bo-btn bo-btn-ghost">Duplicate<\/button>\n                  <button onClick=\{\(\)=>\{ voidPO\(viewModal\); setViewModal\(null\) \}\} className="bo-btn bo-btn-danger">Void PO<\/button>/,
  `                  <button onClick={()=>{setViewModal(null);openEdit(viewModal)}} className="bo-btn bo-btn-primary">Edit</button>
                  <button onClick={()=>{openDuplicate(viewModal); setViewModal(null)}} className="bo-btn bo-btn-ghost">Duplicate</button>
                  <button onClick={()=>{ voidPO(viewModal); setViewModal(null) }} className="bo-btn bo-btn-danger">Void PO</button>`
);

fs.writeFileSync('src/backoffice/components/inventory/InvPO.jsx', content);
