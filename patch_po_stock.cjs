const fs = require('fs');
const file = 'src/backoffice/components/inventory/InvPO.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Rename computePaidPOChanges to computePOStockChanges so it can be used for both.
content = content.replace("function computePaidPOChanges", "function computePOStockChanges");

// 2. Modify markPaid to check if stock_updated is already true. If so, don't update stock again.
// Find the logic inside `markPaid`
const markPaidRegex = /const changes = computePaidPOChanges\(line, ingredients, ingMap\)/g;
content = content.replace(markPaidRegex, `// Only update stock if it hasn't been updated yet!
        let changes = { movements: [], updatedIngIds: [] }
        if (!line.stock_updated) {
          changes = computePOStockChanges(line, ingredients, ingMap)
        }`);
// Wait, I need to make sure the promise all handles empty ingUpdates safely.
const persistPaidRegex = /persistPaidPOChanges\(ingUpdates, movements\)/g;
content = content.replace(persistPaidRegex, `Object.keys(ingUpdates).length > 0 ? persistPaidPOChanges(ingUpdates, movements) : Promise.resolve()`);

// 3. Modify handleSave so that when a New PO is created, it IMMEDIATELY updates stock!
// It will set `stock_updated: true` in the PO payload.
const handleSaveRegex = /await supabase\.from\("purchase_orders"\)\.insert\(\{ id:"PO-"\+Date\.now\(\), \.\.\.payload \}\)/s;
content = content.replace(handleSaveRegex, `
      payload.stock_updated = true;
      const newPoId = "PO-"+Date.now();
      const mockPo = { id: newPoId, ...payload, po_items: poItems_json };
      
      const ingMap = {}
      const changes = computePOStockChanges(mockPo, ingredients, ingMap)
      
      await Promise.all([
        supabase.from("purchase_orders").insert({ id: newPoId, ...payload }),
        Object.keys(changes.ingUpdates).length > 0 ? persistPaidPOChanges(changes.ingUpdates, changes.movements) : Promise.resolve()
      ])
`);

// 4. What about isEdit? 
// If they edit a PO that already has stock_updated = true, they are changing quantities! 
// This is dangerous. If they really want to edit, we should ideally reverse the old stock and apply new.
// For now, let's just alert them if they try to edit an already-updated PO, or we just write the reversal logic.
const editRegex = /if \(isEdit\) \{\s*await supabase\.from\("purchase_orders"\)\.update\(payload\)\.eq\("id", editModal\.id\)\s*\}/s;
content = content.replace(editRegex, `if (isEdit) {
      if (editModal.stock_updated) {
         // REVERSE OLD STOCK BEFORE APPLYING NEW!
         const ingMap = {}
         const revChanges = computeVoidPOChanges(editModal, ingMap)
         await persistPaidPOChanges(revChanges.ingUpdates, revChanges.movements)
         
         // APPLY NEW STOCK
         payload.stock_updated = true
         const mockPo = { id: editModal.id, ...payload, po_items: poItems_json }
         const newChanges = computePOStockChanges(mockPo, ingredients, ingMap)
         await persistPaidPOChanges(newChanges.ingUpdates, newChanges.movements)
      }
      await supabase.from("purchase_orders").update(payload).eq("id", editModal.id)
    }`);

fs.writeFileSync(file, content);
console.log("PO Auto-Stock implemented!");
