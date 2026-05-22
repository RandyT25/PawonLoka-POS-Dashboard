import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../lib/supabase";

/* ─── UNIT CONVERSION MAP ─────────────────────────────────── */
const UNIT_TO_BASE = {
  gr:1,g:1,gram:1,grams:1,
  kg:1000,kilogram:1000,
  ml:1,mL:1,milliliter:1,
  L:1000,liter:1000,litre:1000,
  Galon:19000,galon:19000,
  pcs:1,butir:1,biji:1,buah:1,lembar:1,ekor:1,Ekor:1,
  tsp:5,tbsp:15,cup:240,
  portion:1,porsi:1,slice:1,
  bungkus:1,pack:1,sachet:1,
};
const UNITS = Object.keys(UNIT_TO_BASE);

function toBase(qty, unit) { return qty * (UNIT_TO_BASE[unit] ?? 1); }
function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}
function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; }

/* ─── STATUS PILL ─────────────────────────────────────────── */
function MarginPill({ margin }) {
  if (margin == null) return <span className="re-pill re-pill-none">No recipe</span>;
  const cls = margin >= 65 ? "re-pill-good" : margin >= 45 ? "re-pill-ok" : "re-pill-bad";
  return <span className={`re-pill ${cls}`}>{margin}% margin</span>;
}

/* ─── SEARCHABLE INGREDIENT SELECT ───────────────────────── */
function IngSearch({ value, onChange, ingredients, subRecipes }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const ref = React.useRef(null);

  React.useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const allChoices = [
    ...ingredients.map(i => ({ ...i, _group: "Raw Ingredients" })),
    ...subRecipes.map(s => ({ ...s, name: s.name.replace(" (sub)","") + " (sub)", _group: "Sub-recipes" })),
  ];

  const selected = allChoices.find(x => x.id === value);
  const filtered = allChoices.filter(x =>
    !search || x.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} style={{ position:"relative", flex:2 }}>
      <div onClick={() => { setOpen(o => !o); setSearch(""); }}
        style={{ padding:"7px 10px", border:"1.5px solid #ddd", borderRadius:8, cursor:"pointer", fontSize:13, background:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center", minHeight:36 }}>
        <span style={{ color: selected ? "#111" : "#999", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
          {selected ? selected.name : "— Select ingredient —"}
        </span>
        <span style={{ fontSize:10, color:"#999", marginLeft:4 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ position:"absolute", zIndex:9999, top:"100%", left:0, right:0, background:"#fff", border:"1.5px solid #0066ff", borderRadius:8, boxShadow:"0 8px 24px rgba(0,0,0,0.12)", marginTop:2 }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search..." onClick={e => e.stopPropagation()}
            style={{ width:"100%", padding:"8px 10px", border:"none", borderBottom:"1px solid #eee", fontSize:13, outline:"none", boxSizing:"border-box" }} />
          <div style={{ maxHeight:200, overflowY:"auto" }}>
            {filtered.length === 0
              ? <div style={{ padding:"10px", fontSize:12, color:"#999", textAlign:"center" }}>No results</div>
              : filtered.map(o => (
                <div key={o.id} onClick={() => { onChange(o); setOpen(false); setSearch(""); }}
                  style={{ padding:"8px 12px", fontSize:13, cursor:"pointer", background: o.id===value ? "#f0f5ff" : "transparent", color: o.id===value ? "#0066ff" : o._group==="Sub-recipes" ? "#6554C0" : "#111", fontWeight: o.id===value ? 700 : 400 }}
                  onMouseEnter={e => { if(o.id!==value) e.currentTarget.style.background="#f5f5f5" }}
                  onMouseLeave={e => { if(o.id!==value) e.currentTarget.style.background="transparent" }}>
                  {o.name}
                  {o.cost_per_unit > 0 && <span style={{ fontSize:11, color:"#888", marginLeft:6 }}>Rp {Math.round(o.cost_per_unit).toLocaleString("id-ID")}/{o.unit}</span>}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── COST BREAKDOWN ROW ──────────────────────────────────── */
function IngRow({ row, ingredients, subRecipes, onChange, onRemove }) {
  const allChoices = [
    ...ingredients.map(i => ({ ...i })),
    ...subRecipes.map(s => ({ ...s, name: s.name.replace(" (sub)","") + " (sub)" })),
  ];
  const selected = allChoices.find(x => x.id === row.ingredient_id);
  const baseQty     = toBase(row.qty, row.unit);
  const ingBase     = selected ? (UNIT_TO_BASE[selected.unit] ?? 1) : 1;
  const costPerBase = selected ? ((selected.cost_per_unit ?? 0) / ingBase) : 0;
  const rowCost     = costPerBase * baseQty;

  return (
    <div className="re-ing-row">
      <IngSearch
        value={row.ingredient_id}
        onChange={found => onChange({ ...row, ingredient_id: found.id, ingredient_name: found.name, unit: found.unit ?? row.unit })}
        ingredients={ingredients}
        subRecipes={subRecipes}
      />
      <input type="number" className="re-qty" min="0" step="any" value={row.qty}
        onChange={e => onChange({ ...row, qty: parseFloat(e.target.value) || 0 })} />
      <select className="re-unit" value={row.unit} onChange={e => onChange({ ...row, unit: e.target.value })}>
        {UNITS.map(u => <option key={u}>{u}</option>)}
      </select>
      <span className="re-row-cost">{rowCost > 0 ? fmt(rowCost) : "—"}</span>
      <button className="re-remove-btn" onClick={onRemove}>✕</button>
    </div>
  );
}

/* ─── RECIPE EDITOR PANEL ─────────────────────────────────── */
function RecipePanel({ item, itemType, ingredients, subRecipes, allSubRecipes, onSaved, onCancel }) {
  const [rows, setRows] = useState([]);
  const [yieldQty, setYieldQty] = useState(item?.yield_qty ?? 1);
  const [yieldUnit, setYieldUnit] = useState(item?.yield_unit ?? "portion");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!item) return;
    const table = itemType === "dish" ? "recipes" : "sub_recipe_ingredients";
    const col   = itemType === "dish" ? "product_id" : "sub_recipe_id";
    supabase.from(table).select("*").eq(col, item.id).then(({ data }) => {
      if (data) setRows(data.map(r => ({
        id: r.id,
        ingredient_id: r.ingredient_id,
        ingredient_name: r.ingredient_name ?? "",
        qty: r.qty ?? 0,
        unit: r.unit ?? "gr",
      })));
    });
    if (itemType === "sub") {
      setYieldQty(item.yield_qty ?? 1);
      setYieldUnit(item.yield_unit ?? "gr");
    }
  }, [item?.id, itemType]);

  const totalCost = useMemo(() => {
    const allChoices = [...ingredients, ...subRecipes.map(s => ({ ...s, id: s.id }))];
    return rows.reduce((sum, row) => {
      const found = allChoices.find(x => x.id === row.ingredient_id);
      if (!found || !found.cost_per_unit) return sum;
      const baseQty   = toBase(row.qty, row.unit);
      const ingBase   = UNIT_TO_BASE[found.unit] ?? 1;
      const costPerBase = found.cost_per_unit / ingBase;
      return sum + costPerBase * baseQty;
    }, 0);
  }, [rows, ingredients, subRecipes]);

  const addRow = () => setRows(r => [...r, { ingredient_id: null, ingredient_name: "", qty: 0, unit: "gr" }]);
  const updateRow = (i, val) => setRows(r => r.map((x, idx) => idx === i ? val : x));
  const removeRow = (i) => setRows(r => r.filter((_, idx) => idx !== i));

  const save = async () => {
    const validRows = rows.filter(r => r.ingredient_id && r.qty > 0);
    if (!validRows.length) { setMsg({ type: "error", text: "Tambahkan minimal 1 bahan." }); return; }
    setSaving(true);
    setMsg(null);
    try {
      if (itemType === "dish") {
        /* Delete old, insert new */
        await supabase.from("recipes").delete().eq("product_id", item.id);
        const inserts = validRows.map(r => ({
          product_id: item.id,
          ingredient_id: r.ingredient_id,
          ingredient_name: r.ingredient_name,
          qty: r.qty,
          unit: r.unit,
        }));
        const { error: insErr } = await supabase.from("recipes").insert(inserts);
        if (insErr) throw insErr;
        /* Update products.cogs */
        await supabase.from("products").update({ cogs: Math.round(totalCost) }).eq("sku", item.id);

      } else {
        /* Sub-recipe */
        await supabase.from("sub_recipe_ingredients").delete().eq("sub_recipe_id", item.id);
        const inserts = validRows.map(r => ({
          sub_recipe_id: item.id,
          ingredient_id: r.ingredient_id,
          ingredient_name: r.ingredient_name,
          qty: r.qty,
          unit: r.unit,
        }));
        const { error: insErr } = await supabase.from("sub_recipe_ingredients").insert(inserts);
        if (insErr) throw insErr;
        /* Update yield + cost_per_unit on sub_recipes */
        const yieldBase = toBase(yieldQty, yieldUnit);
        const costPerUnit = yieldBase > 0 ? totalCost / yieldBase : 0;
        await supabase.from("sub_recipes").update({
          yield_qty: yieldQty,
          yield_unit: yieldUnit,
          cost_per_unit: costPerUnit,
        }).eq("id", item.id);
        /* Cascade: recalculate COGS for all dishes using this sub-recipe */
        await cascadeCOGS(item.id, costPerUnit);
      }
      setMsg({ type: "ok", text: "✓ Resep disimpan." });
      onSaved();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  /* After sub-recipe cost changes, recalculate COGS for dishes that reference it */
  async function cascadeCOGS(subId, newCostPerUnit) {
    /* Find all dishes whose recipes include this sub_recipe */
    const { data: affectedRecipes } = await supabase
      .from("recipes")
      .select("product_id, qty, unit")
      .eq("ingredient_id", subId);
    if (!affectedRecipes?.length) return;

    for (const rec of affectedRecipes) {
      /* Fetch all ingredients for this dish */
      const { data: allRows } = await supabase
        .from("recipes")
        .select("ingredient_id, qty, unit")
        .eq("product_id", rec.product_id);
      if (!allRows) continue;

      /* Re-fetch updated ingredient costs */
      const { data: ings } = await supabase.from("ingredients").select("id, cost_per_unit, unit");
      const { data: subs } = await supabase.from("sub_recipes").select("id, cost_per_unit, unit");
      const allChoices = [...(ings ?? []), ...(subs ?? [])];

      const cogs = allRows.reduce((sum, row) => {
        const found = allChoices.find(x => x.id === row.ingredient_id);
        if (!found || !found.cost_per_unit) return sum;
        const baseQty = toBase(row.qty, row.unit);
        const ingBase = UNIT_TO_BASE[found.unit] ?? 1;
        return sum + (found.cost_per_unit / ingBase) * baseQty;
      }, 0);

      await supabase.from("products").update({ cogs: Math.round(cogs) }).eq("sku", rec.product_id);
    }
  }

  if (!item) return <div className="re-empty">← Pilih item dari daftar</div>;

  const sellingPrice = item.price ?? 0;
  const margin = sellingPrice > 0 && totalCost > 0 ? pct(sellingPrice - totalCost, sellingPrice) : null;

  return (
    <div className="re-panel">
      <div className="re-panel-header">
        <div>
          <div className="re-panel-title">{item.icon ?? "🍴"} {item.name}</div>
          {itemType === "dish" && <div className="re-panel-sub">{fmt(sellingPrice)} · COGS: {fmt(totalCost)}</div>}
        </div>
        <MarginPill margin={margin} />
      </div>

      {itemType === "sub" && (
        <div className="re-yield-bar">
          <span className="re-yield-label">Yield (hasil jadi):</span>
          <input
            type="number"
            className="re-qty"
            value={yieldQty}
            min="0.01"
            step="any"
            onChange={e => setYieldQty(parseFloat(e.target.value) || 1)}
          />
          <select className="re-unit" value={yieldUnit} onChange={e => setYieldUnit(e.target.value)}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
          <span className="re-yield-note">→ Cost/unit: {yieldQty > 0 ? fmt(totalCost / toBase(yieldQty, yieldUnit)) : "—"}/base unit</span>
        </div>
      )}

      <div className="re-ing-header">
        <span>Bahan</span><span>Qty</span><span>Unit</span><span>Biaya</span><span></span>
      </div>
      <div className="re-ing-list">
        {rows.map((row, i) => (
          <IngRow
            key={i}
            row={row}
            ingredients={ingredients}
            subRecipes={subRecipes}
            onChange={val => updateRow(i, val)}
            onRemove={() => removeRow(i)}
          />
        ))}
        {rows.length === 0 && <div className="re-no-rows">Belum ada bahan. Klik "+ Tambah Bahan"</div>}
      </div>

      <button className="re-add-btn" onClick={addRow}>+ Tambah Bahan</button>

      {/* Cost breakdown */}
      {rows.length > 0 && (
        <div className="re-breakdown">
          <div className="re-breakdown-title">Rincian Biaya</div>
          {rows.map((row, i) => {
            const allChoices = [...ingredients, ...subRecipes];
            const found = allChoices.find(x => x.id === row.ingredient_id);
            if (!found) return null;
            const baseQty = toBase(row.qty, row.unit);
            const ingBase = UNIT_TO_BASE[found.unit] ?? 1;
            const cost = (found.cost_per_unit / ingBase) * baseQty;
            const share = totalCost > 0 ? pct(cost, totalCost) : 0;
            return (
              <div key={i} className="re-bd-row">
                <span className="re-bd-name">{row.ingredient_name || found.name}</span>
                <span className="re-bd-qty">{row.qty} {row.unit}</span>
                <div className="re-bd-bar-wrap">
                  <div className="re-bd-bar" style={{ width: share + "%" }} />
                </div>
                <span className="re-bd-pct">{share}%</span>
                <span className="re-bd-cost">{fmt(cost)}</span>
              </div>
            );
          })}
          <div className="re-bd-total">
            <span>Total COGS</span>
            <span>{fmt(totalCost)}</span>
          </div>
          {itemType === "sub" && yieldQty > 0 && (
            <div className="re-bd-total" style={{ color: "var(--blue, #3b82f6)" }}>
              <span>Cost per base unit</span>
              <span>{fmt(totalCost / toBase(yieldQty, yieldUnit))}</span>
            </div>
          )}
        </div>
      )}

      {msg && <div className={`re-msg re-msg-${msg.type}`}>{msg.text}</div>}

      <div className="re-panel-footer">
        <button className="re-btn-ghost" onClick={onCancel}>Batal</button>
        <button className="re-btn-primary" onClick={save} disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan Resep"}
        </button>
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ──────────────────────────────────────── */
export default function RecipeEditor() {
  const [tab, setTab]             = useState("dish"); // "dish" | "sub"
  const [search, setSearch]       = useState("");
  const [products, setProducts]   = useState([]);
  const [subRecipes, setSubRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refresh, setRefresh]     = useState(0);

  /* Load data */
  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("products").select("sku,name,icon,price,cogs,cat").order("name").then(r => ({ data: (r.data||[]).map(p => ({ ...p, id: p.sku, category: p.cat })), error: r.error })),
      supabase.from("sub_recipes").select("id,name,unit,cost_per_unit,yield_qty,yield_unit,ingredient_id").order("name"),
      supabase.from("ingredients").select("id,name,unit,cost_per_unit,category").order("name"),
    ]).then(async ([p, s, i]) => {
      const allIngs = i.data ?? [];
      let subs = s.data ?? [];

      // Auto-sync: create sub_recipes rows for semi-finished ingredients that don't have one yet
      const semiFinished = allIngs.filter(ing =>
        ing.category === "Semi-finished" || ing.name?.toLowerCase().includes("(sub)")
      );
      const existingIngIds = new Set(subs.map(s => s.ingredient_id).filter(Boolean));
      const toCreate = semiFinished.filter(ing => !existingIngIds.has(ing.id));

      if (toCreate.length) {
        const newRows = toCreate.map(ing => ({
          id: "SR-" + ing.id,
          name: ing.name,
          ingredient_id: ing.id,
          unit: ing.unit,
          cost_per_unit: ing.cost_per_unit || 0,
          yield_qty: 1,
          yield_unit: ing.unit,
        }));
        await supabase.from("sub_recipes").upsert(newRows, { onConflict: "id", ignoreDuplicates: true });
        // Reload sub_recipes after sync
        const { data: refreshed } = await supabase.from("sub_recipes").select("id,name,unit,cost_per_unit,yield_qty,yield_unit,ingredient_id").order("name");
        subs = refreshed ?? [];
      }

      setProducts(p.data ?? []);
      setSubRecipes(subs);
      setIngredients(allIngs);
      setLoading(false);
    });
  }, [refresh]);

  /* If selected item gets stale after save, refresh it */
  const onSaved = useCallback(() => {
    setRefresh(r => r + 1);
    setSelected(null);
  }, []);

  const listItems = tab === "dish"
    ? products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))
    : subRecipes.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));

  /* Determine recipe status for left panel */
  function getRecipeStatus(item) {
    if (tab === "dish") {
      return item.cogs > 0 ? "has_recipe" : "no_recipe";
    }
    return item.cost_per_unit > 0 ? "has_recipe" : "no_recipe";
  }

  function getMargin(item) {
    if (tab !== "dish") return null;
    return item.price > 0 && item.cogs > 0 ? pct(item.price - item.cogs, item.price) : null;
  }

  if (loading) return <div className="re-loading">Memuat data resep…</div>;

  return (
    <div className="re-root">
      <style>{CSS}</style>

      {/* LEFT PANEL */}
      <div className="re-left">
        <div className="re-left-tabs">
          <button className={`re-tab ${tab === "dish" ? "active" : ""}`} onClick={() => { setTab("dish"); setSelected(null); }}>
            🍽 Dishes
          </button>
          <button className={`re-tab ${tab === "sub" ? "active" : ""}`} onClick={() => { setTab("sub"); setSelected(null); }}>
            🥣 Sub-recipes
          </button>
        </div>

        <div className="re-search-wrap">
          <input
            className="re-search"
            placeholder="Cari…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="re-list">
          {listItems.map(item => {
            const status = getRecipeStatus(item);
            const margin = getMargin(item);
            const isSel  = selected?.id === item.id && selected?._type === tab;
            return (
              <div
                key={item.id}
                className={`re-list-item ${isSel ? "active" : ""}`}
                onClick={() => setSelected({ ...item, _type: tab })}
              >
                <div className="re-li-left">
                  <span className="re-li-icon">{item.icon ?? (tab === "sub" ? "🥣" : "🍴")}</span>
                  <div>
                    <div className="re-li-name">{item.name}</div>
                    <div className="re-li-meta">
                      {tab === "dish" && <span>{fmt(item.price)}</span>}
                      {status === "has_recipe"
                        ? <span className="re-li-badge re-li-has">✓ Ada resep</span>
                        : <span className="re-li-badge re-li-none">+ Buat resep</span>}
                    </div>
                  </div>
                </div>
                <MarginPill margin={margin} />
              </div>
            );
          })}
          {listItems.length === 0 && <div className="re-empty-list">Tidak ada item.</div>}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="re-right">
        {selected ? (
          <RecipePanel
            key={selected.id + selected._type}
            item={selected}
            itemType={selected._type}
            ingredients={ingredients}
            subRecipes={subRecipes}
            allSubRecipes={subRecipes}
            onSaved={onSaved}
            onCancel={() => setSelected(null)}
          />
        ) : (
          <div className="re-empty">
            <div className="re-empty-ico">📖</div>
            <div className="re-empty-txt">Pilih item dari daftar untuk mulai edit resep</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── CSS ─────────────────────────────────────────────────── */
const CSS = `
.re-root{display:flex;height:calc(100vh - 56px);overflow:hidden;font-family:inherit;}
.re-loading{padding:40px;text-align:center;color:#888;}

/* LEFT */
.re-left{width:320px;min-width:260px;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;background:#fafafa;}
.re-left-tabs{display:flex;border-bottom:1px solid #e5e7eb;}
.re-tab{flex:1;padding:12px 8px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;}
.re-tab.active{color:#f59e0b;border-bottom-color:#f59e0b;background:#fff;}
.re-search-wrap{padding:10px 12px;border-bottom:1px solid #f0f0f0;}
.re-search{width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;}
.re-list{flex:1;overflow-y:auto;}
.re-list-item{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer;border-bottom:1px solid #f3f4f6;transition:background .12s;}
.re-list-item:hover{background:#fff7ed;}
.re-list-item.active{background:#fff7ed;border-left:3px solid #f59e0b;}
.re-li-left{display:flex;align-items:center;gap:10px;}
.re-li-icon{font-size:22px;width:32px;text-align:center;}
.re-li-name{font-size:13px;font-weight:600;color:#1f2937;}
.re-li-meta{display:flex;align-items:center;gap:6px;margin-top:2px;font-size:11px;color:#6b7280;}
.re-li-badge{padding:1px 6px;border-radius:20px;font-size:10px;font-weight:700;}
.re-li-has{background:#d1fae5;color:#065f46;}
.re-li-none{background:#f3f4f6;color:#6b7280;}
.re-empty-list{padding:24px;text-align:center;color:#9ca3af;font-size:13px;}

/* PILLS */
.re-pill{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;}
.re-pill-good{background:#d1fae5;color:#065f46;}
.re-pill-ok{background:#fef3c7;color:#92400e;}
.re-pill-bad{background:#fee2e2;color:#991b1b;}
.re-pill-none{background:#f3f4f6;color:#6b7280;}

/* RIGHT */
.re-right{flex:1;overflow-y:auto;background:#fff;}
.re-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#9ca3af;}
.re-empty-ico{font-size:48px;margin-bottom:12px;}
.re-empty-txt{font-size:14px;}

/* PANEL */
.re-panel{padding:20px;max-width:680px;}
.re-panel-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #f0f0f0;}
.re-panel-title{font-size:18px;font-weight:700;color:#1f2937;}
.re-panel-sub{font-size:12px;color:#6b7280;margin-top:3px;}

/* YIELD */
.re-yield-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#eff6ff;border-radius:10px;margin-bottom:14px;flex-wrap:wrap;}
.re-yield-label{font-size:12px;font-weight:700;color:#1e40af;}
.re-yield-note{font-size:11px;color:#3b82f6;margin-left:4px;}

/* ING ROWS */
.re-ing-header{display:grid;grid-template-columns:1fr 80px 80px 90px 28px;gap:6px;padding:6px 0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #f0f0f0;margin-bottom:6px;}
.re-ing-list{display:flex;flex-direction:column;gap:6px;}
.re-ing-row{display:grid;grid-template-columns:1fr 80px 80px 90px 28px;gap:6px;align-items:center;}
.re-ing-select-wrap select{width:100%;padding:7px 8px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;background:#fff;outline:none;}
.re-qty{width:80px;padding:7px 8px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;}
.re-unit{width:80px;padding:7px 6px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;background:#fff;outline:none;}
.re-row-cost{font-size:12px;font-weight:700;color:#1f2937;text-align:right;}
.re-remove-btn{background:none;border:none;cursor:pointer;color:#ef4444;font-size:14px;padding:0;line-height:1;}
.re-no-rows{font-size:13px;color:#9ca3af;padding:12px 0;}
.re-add-btn{margin-top:10px;padding:7px 14px;background:#f3f4f6;border:1px dashed #d1d5db;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;color:#374151;}
.re-add-btn:hover{background:#e5e7eb;}

/* BREAKDOWN */
.re-breakdown{margin-top:18px;background:#f9fafb;border-radius:10px;padding:14px;}
.re-breakdown-title{font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;text-transform:uppercase;}
.re-bd-row{display:grid;grid-template-columns:1fr 70px 80px 36px 90px;gap:6px;align-items:center;margin-bottom:6px;}
.re-bd-name{font-size:12px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.re-bd-qty{font-size:11px;color:#6b7280;}
.re-bd-bar-wrap{background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden;}
.re-bd-bar{height:6px;background:#f59e0b;border-radius:4px;transition:width .3s;}
.re-bd-pct{font-size:11px;color:#6b7280;text-align:right;}
.re-bd-cost{font-size:12px;font-weight:700;color:#1f2937;text-align:right;}
.re-bd-total{display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:#1f2937;border-top:1px solid #e5e7eb;padding-top:8px;margin-top:6px;}

/* MSG */
.re-msg{margin-top:12px;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;}
.re-msg-ok{background:#d1fae5;color:#065f46;}
.re-msg-error{background:#fee2e2;color:#991b1b;}

/* FOOTER */
.re-panel-footer{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid #f0f0f0;}
.re-btn-ghost{padding:9px 18px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font-size:13px;font-weight:600;cursor:pointer;color:#374151;}
.re-btn-primary{padding:9px 18px;border:none;border-radius:8px;background:#f59e0b;font-size:13px;font-weight:700;cursor:pointer;color:#fff;}
.re-btn-primary:disabled{opacity:.5;cursor:not-allowed;}

@media(max-width:640px){
  .re-root{flex-direction:column;height:auto;}
  .re-left{width:100%;border-right:none;border-bottom:1px solid #e5e7eb;max-height:300px;}
  .re-right{min-height:400px;}
  .re-ing-header,.re-ing-row{grid-template-columns:1fr 60px 60px 80px 24px;}
  .re-bd-row{grid-template-columns:1fr 50px 60px 30px 80px;}
}
`;
