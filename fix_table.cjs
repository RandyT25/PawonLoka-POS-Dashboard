const fs = require('fs');
let content = fs.readFileSync('src/backoffice/components/Profitability.jsx', 'utf8');

// 1. Remove minWidth:1000
content = content.replace('minWidth:1000', 'width:"100%"');

// 2. Header style
content = content.replace(/padding:"10px 12px"/g, 'padding:"8px 6px"');
content = content.replace(/whiteSpace:"nowrap", minWidth: i===1 \? 200 : undefined/g, 'lineHeight:1.2, minWidth: i===1 ? 140 : undefined');

// 3. Body cells padding
content = content.replace(/padding:"8px 12px"/g, 'padding:"6px 6px"');

fs.writeFileSync('src/backoffice/components/Profitability.jsx', content);
