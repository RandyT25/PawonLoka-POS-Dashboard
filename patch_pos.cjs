const fs = require('fs');
const file = 'src/pos/POS.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldHandleModifierConfirm = `
  const handleModifierConfirm = useCallback((product, modifiers, note) => {
    // Calculate extra price from modifiers
    const mods = product._mods || modifierGroups
    const extraPrice = Object.entries(modifiers).reduce((sum, [modId, optName]) => {
      const mod = mods.find(m => m.id === modId)
      const opt = mod?.options?.find(o => (o.name||o) === optName)
      return sum + (opt?.price || 0)
    }, 0)
    const finalProduct = extraPrice !== 0
      ? { ...product, price: product.price + extraPrice, _basePrice: product.price }
      : { ...product }
`.trim();

const newHandleModifierConfirm = `
  const handleModifierConfirm = useCallback((product, modifiers, note) => {
    // Calculate extra price from modifiers
    const mods = product._mods || modifierGroups
    let plus = 0;
    let minus = 0;
    Object.entries(modifiers).forEach(([modId, optName]) => {
      const mod = mods.find(m => m.id === modId)
      const opt = mod?.options?.find(o => (o.name||o) === optName)
      if (opt?.price) {
        if (opt.price > 0) plus += opt.price
        else minus += Math.abs(opt.price)
      }
    })
    const finalProduct = (plus !== 0 || minus !== 0)
      ? { ...product, price: product.price + plus, itemDisc: (product.itemDisc || 0) + minus, _basePrice: product.price }
      : { ...product }
`.trim();

if (content.includes(oldHandleModifierConfirm)) {
  content = content.replace(oldHandleModifierConfirm, newHandleModifierConfirm);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched POS.jsx for negative modifiers");
} else {
  console.log("Could not find oldHandleModifierConfirm");
}
