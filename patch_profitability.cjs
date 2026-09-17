const fs = require('fs');
const file = 'src/backoffice/components/Profitability.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldThead = `            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["#","Menu","Cat","HPP/COGS","Harga Sekarang","COGS %","Profit","Margin %","Harga Baru","COGS % Baru","Δ COGS","Profit Baru","Rec. Price @ "+target+"%","Status"].map(h => (
                  <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:10, fontWeight:700, color:"var(--ink4)", borderBottom:"1px solid #E8ECF0", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>`;

const newThead = `            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["#","Menu","Cat","HPP/COGS","Harga Sekarang","COGS %","Profit","Margin %","Harga Baru","COGS % Baru","Δ COGS","Profit Baru","Rec. Price @ "+target+"%","Status"].map((h, i) => (
                  <th key={h} style={{ padding:"10px 12px", textAlign: [3,4,5,6,7,8,9,10,11,12].includes(i) ? "right" : "left", fontSize:10, fontWeight:700, color:"var(--ink4)", borderBottom:"1px solid #E8ECF0", whiteSpace:"nowrap", minWidth: i===1 ? 200 : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>`;

content = content.replace(oldThead, newThead);

content = content.replace(/<td style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color: cpp > 0 \? "var\(--ink\)" : "var\(--ink5\)" }}>/g, '<td style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color: cpp > 0 ? "var(--ink)" : "var(--ink5)", textAlign:"right" }}>');
content = content.replace(/<td style={{ padding:"8px 12px", fontWeight:700 }}>{fmt\(price\)}<\/td>/g, '<td style={{ padding:"8px 12px", fontWeight:700, textAlign:"right" }}>{fmt(price)}</td>');
content = content.replace(/<td style={{ padding:"8px 12px" }}>\n\s*{\s*cpp > 0 \? \(/g, '<td style={{ padding:"8px 12px", textAlign:"right" }}>\n                      {cpp > 0 ? (');
content = content.replace(/<td style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color: profit > 0 \? "var\(--green\)" : "var\(--red\)" }}>{fmt\(profit\)}<\/td>/g, '<td style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color: profit > 0 ? "var(--green)" : "var(--red)", textAlign:"right" }}>{fmt(profit)}</td>');
content = content.replace(/<td style={{ padding:"8px 12px", fontSize:12, fontWeight:700, color: marginP >= 0 \? "var\(--green\)" : "var\(--red\)" }}>/g, '<td style={{ padding:"8px 12px", fontSize:12, fontWeight:700, color: marginP >= 0 ? "var(--green)" : "var(--red)", textAlign:"right" }}>');
content = content.replace(/<td style={{ padding:"8px 12px" }}>\n\s*<input type="number"/g, '<td style={{ padding:"8px 12px", textAlign:"right" }}>\n                      <input type="number"');
content = content.replace(/<td style={{ padding:"8px 12px" }}>\n\s*{\s*cpp > 0 && newPrice > 0 \? \(/g, '<td style={{ padding:"8px 12px", textAlign:"right" }}>\n                      {cpp > 0 && newPrice > 0 ? (');
content = content.replace(/<td style={{ padding:"8px 12px" }}>\n\s*{\s*hasChange && cpp > 0 \? \(/g, '<td style={{ padding:"8px 12px", textAlign:"right" }}>\n                      {hasChange && cpp > 0 ? (');
content = content.replace(/<td style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color: newProfit > 0 \? "var\(--green\)" : "var\(--red\)" }}>/g, '<td style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color: newProfit > 0 ? "var(--green)" : "var(--red)", textAlign:"right" }}>');
content = content.replace(/<td style={{ padding:"8px 12px", fontWeight:700, color: "var\(--brand\)" }}>\n\s*{\s*recPrice > 0 \? fmt\(recPrice\) : <span/g, '<td style={{ padding:"8px 12px", fontWeight:700, color: "var(--brand)", textAlign:"right" }}>\n                      {recPrice > 0 ? fmt(recPrice) : <span');

fs.writeFileSync(file, content, 'utf8');
console.log("Patched table layout in Profitability.jsx");
