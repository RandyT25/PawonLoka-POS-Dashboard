const fs = require('fs');
const file = 'src/backoffice/components/inventory/InvPO.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Revert computePOStockChanges -> computePaidPOChanges
content = content.replace("function computePOStockChanges", "function computePaidPOChanges");

// 2. Replace the broken submitPO handleSave logic with a clean one
const brokenLogic = `if (isEdit) {
      if (editModal.stock_updated) {
         // REVERSE OLD STOCK BEFORE APPLYING NEW!
         const ingMap = {}
         const revChanges = computeVoidPOChanges(editModal, ingMap)
         await persistPaidPOChanges(revChanges.ingUpdates, revChanges.movements)
         
         // APPLY NEW STOCK
         payload.stock_updated = true
         const mockPo = { id: editModal.id, ...payload, po_items: poItems_json }
         const newChanges = computePOStockChanges(mockPo, ingredients, ingMap)
         if (Object.keys(newChanges.ingUpdates).length > 0) {
            await persistPaidPOChanges(newChanges.ingUpdates, newChanges.movements)
         }
      }
      await supabase.from("purchase_orders").update(payload).eq("id", editModal.id)
    } else {
      payload.stock_updated = true;
      const newPoId = "PO-"+Date.now();
      const mockPo = { id: newPoId, ...payload, po_items: poItems_json };
      
      const ingMap = {}
      const changes = computePOStockChanges(mockPo, ingredients, ingMap)
      
      await supabase.from("purchase_orders").insert({ id: newPoId, ...payload })
      if (Object.keys(changes.ingUpdates).length > 0) {
         await persistPaidPOChanges(changes.ingUpdates, changes.movements)
      }
    }`;

const fixedLogic = `if (isEdit) {
      const { error } = await supabase.from("purchase_orders").update(payload).eq("id", editModal.id)
      if (error) { alert("Error saving PO: " + error.message); setSaving(false); return; }
    } else {
      const newPoId = "PO-" + Date.now();
      
      // Auto-approve: mark as Paid immediately
      payload.status = "Paid";
      payload.paid_at = new Date().toISOString();
      payload.paid_amount = payload.total;
      
      const mockPo = { id: newPoId, ...payload, po_items: poItems_json };
      
      const { error } = await supabase.from("purchase_orders").insert({ id: newPoId, ...payload });
      if (error) {
        alert("Error saving PO: " + error.message);
        setSaving(false);
        return;
      }
      
      // Process stock updates since it's auto-approved
      const { data: freshIngs } = await supabase.from("ingredients").select("*");
      const ingMap = {};
      for (const i of freshIngs||[]) ingMap[i.id] = i;
      const { updatedIngIds, ingUpdates, movements } = computePaidPOChanges(mockPo, ingMap);
      
      await persistPaidPOChanges(ingUpdates, movements);
      if (updatedIngIds.length) await cascadeRecalc(updatedIngIds);
    }`;

if (content.includes(brokenLogic)) {
  content = content.replace(brokenLogic, fixedLogic);
  fs.writeFileSync(file, content);
  console.log("Successfully fixed InvPO.jsx");
} else {
  console.log("Could not find the broken logic to replace!");
}
