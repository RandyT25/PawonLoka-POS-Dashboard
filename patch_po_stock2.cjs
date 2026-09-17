const fs = require('fs');
const file = 'src/backoffice/components/inventory/InvPO.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Rename computePaidPOChanges -> computePOStockChanges
content = content.split("function computePaidPOChanges").join("function computePOStockChanges");

// 2. Modify markPaid to check stock_updated
const markPaidOld = `const changes = computePOStockChanges(line, ingredients, ingMap)`;
const markPaidNew = `let changes = { movements: [], updatedIngIds: [] }
        if (!line.stock_updated) {
          changes = computePOStockChanges(line, ingredients, ingMap)
        }`;
content = content.replace(markPaidOld, markPaidNew);

// 3. Modify handleSave
const handleSaveOld = `if (isEdit) {
      await supabase.from("purchase_orders").update(payload).eq("id", editModal.id)
    } else {
      await supabase.from("purchase_orders").insert({ id:"PO-"+Date.now(), ...payload })
    }`;

const handleSaveNew = `if (isEdit) {
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
content = content.replace(handleSaveOld, handleSaveNew);

fs.writeFileSync(file, content);
console.log("PO Auto-Stock implemented securely!");
