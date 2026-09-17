require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: ings } = await supabase.from('ingredients').select('id, name, category, station');
  
  const updates = [];
  
  for (const i of ings) {
    let stations = new Set(Array.isArray(i.station) ? i.station : ["Kitchen"]);
    
    const lowerName = i.name.toLowerCase();
    const cat = i.category || "";
    
    // Logic for BAR
    if (
      cat === "Beverage" || 
      lowerName.includes("syrup") || lowerName.includes("sirup") ||
      lowerName.includes("kopi") || lowerName.includes("coffee") ||
      lowerName.includes("espresso") || lowerName.includes("latte") ||
      lowerName.includes("teh") || lowerName.includes("tea") ||
      lowerName.includes("susu") || lowerName.includes("milk") ||
      lowerName.includes("es ") || lowerName.includes("ice") || lowerName.includes("batu") ||
      lowerName.includes("gula") || lowerName.includes("sugar") ||
      lowerName.includes("soda") || lowerName.includes("water") || lowerName.includes("air") ||
      lowerName.includes("cup") || lowerName.includes("sedotan") || lowerName.includes("straw") ||
      lowerName.includes("powder") || lowerName.includes("bubuk") ||
      lowerName.includes("matcha") || lowerName.includes("coklat") || lowerName.includes("chocolate") ||
      lowerName.includes("lemon") || lowerName.includes("jeruk") || lowerName.includes("mint") ||
      lowerName.includes("yakult")
    ) {
      stations.add("Bar");
    }
    
    // Logic for SNACK
    if (
      cat === "Snack" || 
      lowerName.includes("snack") || 
      lowerName.includes("kentang") || lowerName.includes("fries") ||
      lowerName.includes("sosis") || lowerName.includes("sausage") ||
      lowerName.includes("nugget") || 
      lowerName.includes("roti") || lowerName.includes("bread") ||
      lowerName.includes("pisang") || lowerName.includes("banana") ||
      lowerName.includes("keju") || lowerName.includes("cheese") ||
      lowerName.includes("kulit") || lowerName.includes("dimsum") ||
      lowerName.includes("cireng") || lowerName.includes("tahu") || lowerName.includes("tempe") ||
      lowerName.includes("jamur") || lowerName.includes("mushroom")
    ) {
      stations.add("Snack");
    }
    
    // Logic for KASIR (Cashier items like receipt paper)
    if (
      lowerName.includes("kertas") || lowerName.includes("paper") ||
      lowerName.includes("struk") || lowerName.includes("receipt") || lowerName.includes("plastik")
    ) {
      stations.add("Kasir");
    }
    
    const newStations = Array.from(stations);
    if (newStations.includes("Bar") && !["Meat", "Vegetables", "Spices", "Seafood", "Poultry"].includes(cat)) {
      if (cat === "Beverage" || lowerName.includes("kopi") || lowerName.includes("sirup") || lowerName.includes("cup") || lowerName.includes("sedotan")) {
        stations.delete("Kitchen");
      }
    }
    
    if (newStations.includes("Snack") && !["Meat", "Vegetables", "Spices"].includes(cat)) {
      if (lowerName.includes("kentang") || lowerName.includes("sosis") || lowerName.includes("nugget") || lowerName.includes("roti") || lowerName.includes("cireng") || lowerName.includes("pisang")) {
        stations.delete("Kitchen");
      }
    }
    
    const finalStations = Array.from(stations);
    if (finalStations.length === 0) finalStations.push("Kitchen");
    
    const oldStr = Array.isArray(i.station) ? i.station.sort().join(",") : "Kitchen";
    const newStr = finalStations.sort().join(",");
    
    if (oldStr !== newStr) {
      updates.push({ id: i.id, name: i.name, old: oldStr, new: newStr, station: finalStations });
    }
  }
  
  console.log(`Found ${updates.length} ingredients to update.`);
  console.log(updates.slice(0, 15));
  
  for (const u of updates) {
    await supabase.from("ingredients").update({ station: u.station }).eq("id", u.id);
  }
  console.log("Done updating stations in DB!");
}
run();
