const isOwner = (staff) => {
  if (!staff) return false;
  const roles = Array.isArray(staff.role) ? staff.role : [];
  if (roles.some(r => typeof r === "string" && r.toLowerCase() === "owner")) return true;
  if (typeof staff.name === "string" && staff.name.toLowerCase().includes("claudy")) return true;
  return false;
};

const isNita = (staff) => {
  if (!staff) return false;
  return typeof staff.name === "string" && staff.name.toLowerCase().includes("nita");
};

// Filter ingredients
const filterIngredients = (ingredients, staff, station) => {
  if (isOwner(staff)) return ingredients;
  if (isNita(staff)) return ingredients; // "request anything for the floor" -> let Nita see all ingredients!

  return ingredients.filter(i => {
    if (i.station && Array.isArray(i.station)) {
      return i.station.some(s => typeof s === "string" && s.toLowerCase() === (station || "").toLowerCase());
    } else if (i.station && typeof i.station === "string") {
      return i.station.toLowerCase() === (station || "").toLowerCase();
    }
    return true; // No station assigned -> let everyone see it
  });
};

// Filter subrecipes
const filterSubRecipes = (subRecipes, ingredients, staff, station) => {
  if (isOwner(staff)) return subRecipes;
  
  return subRecipes.filter(r => {
    if (isNita(staff) && r.name.toLowerCase().includes("sambal kacang")) return true;

    const outIng = ingredients.find(i => i.id === r.ingredient_id);
    if (!outIng) return true; // if no linked ingredient, let everyone produce it

    if (outIng.station && Array.isArray(outIng.station)) {
      return outIng.station.some(s => typeof s === "string" && s.toLowerCase() === (station || "").toLowerCase());
    } else if (outIng.station && typeof outIng.station === "string") {
      return outIng.station.toLowerCase() === (station || "").toLowerCase();
    }
    return true;
  });
};

// Filter products (frozen products for production)
const filterProducts = (products, staff, station) => {
  if (isOwner(staff)) return products;
  // Usually frozen food production is Kitchen
  if ((station||"").toLowerCase() === "kitchen") return products;
  return []; // only kitchen produces frozen food unless owner
};
