import fs from 'fs'

const file = 'src/backoffice/components/StaffSubmissions.jsx'
let content = fs.readFileSync(file, 'utf8')

// First, change setViewModal(s) to a toggle state
if (content.includes('const [viewModal,   setViewModal]')) {
  content = content.replace('const [viewModal,   setViewModal]   = useState(null)', 'const [viewModal,   setViewModal]   = useState(null)\n  const [expandedId, setExpandedId] = useState(null)')
}

// Update the onClick
content = content.replace(/<tr key=\{s\.id\} onClick=\{.*?\} style=\{\{ cursor: 'pointer', \.\.\.rowStyle\(s\) \}\}>/, 
`<tr key={s.id} onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} style={{ cursor: 'pointer', ...rowStyle(s), borderBottom: expandedId === s.id ? 'none' : undefined }}>`)

// After the </tr> closing, inject the inline details if expandedId === s.id
// We will have to find where the </tr> is inside the map.
