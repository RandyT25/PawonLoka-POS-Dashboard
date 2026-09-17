import fs from 'fs'

const path = 'src/backoffice/components/StaffSubmissions.jsx'
let code = fs.readFileSync(path, 'utf8')

// Find the line:
// const { error:itemErr } = await supabase.from("ingredients").update({ stock:newItemStock }).eq("id",item.id)
// if (itemErr) throw itemErr
// const { error:prodErr } = await supabase.from("production_batches").insert({

const target = `          const { error:itemErr } = await supabase.from("ingredients").update({ stock:newItemStock }).eq("id",item.id)
          if (itemErr) throw itemErr
          const { error:prodErr } = await supabase.from("production_batches").insert({`

const replacement = `          const { error:itemErr } = await supabase.from("ingredients").update({ stock:newItemStock }).eq("id",item.id)
          if (itemErr) throw itemErr
          
          const { error:movErr2 } = await supabase.from("stock_movements").insert({
            id:"MOV-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),
            type:"Production", ingredient_id:item.id, ingredient_name:item.name,
            qty:producedQtyBase, unit:item.unit, ref:sub.id,
            note:"Auto-approved production output by "+sub.submitted_by,
            date:producedDate, time:new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}),
          })
          if (movErr2) throw movErr2

          const { error:prodErr } = await supabase.from("production_batches").insert({`

if (code.includes(target)) {
  code = code.replace(target, replacement)
  fs.writeFileSync(path, code)
  console.log("Patched successfully")
} else {
  console.log("Target not found in StaffSubmissions.jsx")
}
