const fs = require('fs');
const file = 'src/backoffice/components/inventory/InvPO.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix submitPO
const oldSubmitPO = `      // Auto-approve: mark as Paid immediately
      payload.status = "Paid";
      payload.paid_at = new Date().toISOString();
      payload.paid_amount = payload.total;`;
const newSubmitPO = `      // Auto-approve: mark as Paid immediately
      payload.status = "Paid";`;
content = content.replace(oldSubmitPO, newSubmitPO);

// 2. Fix submitBayar
const oldSubmitBayar = `          poStatusUpdates.push({ id: line.po_id, payload: {
            status: newStatus,
            paid_at: new Date().toISOString(),
            paid_amount: paid,
            discount_amount: parseFloat(line.discount)||0
          }})`;
const newSubmitBayar = `          poStatusUpdates.push({ id: line.po_id, payload: {
            status: newStatus
          }})`;
content = content.replace(oldSubmitBayar, newSubmitBayar);

fs.writeFileSync(file, content);
console.log("Fixed paid_amount columns in InvPO.jsx");
