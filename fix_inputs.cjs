const fs = require('fs');
let content = fs.readFileSync('src/backoffice/components/Products.jsx', 'utf8');

// Find Product Name input
content = content.replace(
  /<input type="text" value=\{form\.name\} onChange=\{e=>setForm\(f=>\(\{\.\.\.f,name:e\.target\.value\}\)\)\} className="bo-input" placeholder="e\.g\. Nasi Goreng" \/>/g,
  '<input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" placeholder="e.g. Nasi Goreng" style={{ borderColor: !form.name ? "var(--red)" : undefined }} />'
);

// Find Price input
content = content.replace(
  /<input type="number" value=\{form\.price\} onChange=\{e=>setForm\(f=>\(\{\.\.\.f,price:e\.target\.value\}\)\)\} className="bo-input" placeholder="e\.g\. 25000" \/>/g,
  '<input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} className="bo-input" placeholder="e.g. 25000" style={{ borderColor: !form.price ? "var(--red)" : undefined }} />'
);

fs.writeFileSync('src/backoffice/components/Products.jsx', content);
