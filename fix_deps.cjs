const fs = require('fs')

const files = [
  'src/backoffice/components/inventory/InvWaste.jsx',
  'src/backoffice/components/inventory/InvProduction.jsx',
  'src/backoffice/components/inventory/InvOpname.jsx',
  'src/backoffice/components/inventory/InvStaffConsumption.jsx'
]

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8')
  
  // Remove the useEffect from before load
  code = code.replace(/useEffect\(\(\) => \{ load\(\) \}, \[load\]\)\n/g, '')
  code = code.replace(/useEffect\(\(\) => \{ load\(\) \}, \[load\]\)/g, '')
  
  // Add it after the load function
  code = code.replace(
    /setLoading\(false\)\n\s*\}, \[range, customDate, customDateTo\]\)/g,
    'setLoading(false)\n  }, [range, customDate, customDateTo])\n\n  useEffect(() => { load() }, [load])'
  )
  
  fs.writeFileSync(file, code)
}
console.log('Fixed TDZ in useEffect')
