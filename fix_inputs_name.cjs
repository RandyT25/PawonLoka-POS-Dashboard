const fs = require('fs');
let content = fs.readFileSync('src/backoffice/components/Products.jsx', 'utf8');

content = content.replace(
  /<input value=\{form\.name\} onChange=\{e=>setForm\(f=>\(\{\.\.\.f,name:e\.target\.value\}\)\)\} className="bo-input" placeholder="Product name" autoFocus \/>/g,
  '<input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" placeholder="Product name" autoFocus style={{ borderColor: !form.name ? "var(--red)" : undefined }} />'
);

fs.writeFileSync('src/backoffice/components/Products.jsx', content);
