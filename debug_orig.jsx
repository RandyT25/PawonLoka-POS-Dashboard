            {isOrphanApproved(viewModal) && (
              <div style={{ margin:"0 20px 12px", padding:"10px 14px", background:"var(--red-lt)", border:"1.5px solid var(--red)", borderRadius:"var(--r)" }}>
                <div style={{ fontWeight:700, color:"var(--red)", fontSize:13 }}>⚠ Approved but not applied to stock</div>
                <div style={{ fontSize:12, color:"var(--ink4)", marginTop:4 }}>
                  No "{EXPECTED_MOVEMENT_TYPE[viewModal.type]}" stock_movements record references this submission. It was likely marked approved
                  without going through the normal apply-to-stock flow (e.g. a manual database edit). Retry re-applies it using current live
                  stock as the baseline (same delayed-approval-safe math as a normal approval) — for opname, any ingredient that already got a
                  separate Adjustment since this was submitted is skipped automatically rather than risking a double-count.
                </div>
                {!dismissedOrphanIds.has(viewModal.id) && (
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <button onClick={()=>retryOrphan(viewModal)} disabled={processing} className="bo-btn bo-btn-sm" style={{ background:"var(--red-lt)", color:"var(--red)", border:"none" }}>Retry</button>
                    <button onClick={()=>dismissOrphan(viewModal.id)} className="bo-btn bo-btn-sm bo-btn-ghost">Acknowledge (skip, don't retry)</button>
                  </div>
                )}
              </div>
            )}
            <div className="bo-modal-body" style={{ overflowY:"auto" }}>
              {viewModal.type==="opname" && (() => {
                const totalValue = (viewModal.data.items||[]).reduce((a,item)=>a+(item.actual_qty*(ingredients.find(x=>x.id===item.ingredient_id)?.cost_per_unit||0)),0)
                const totalVariance = (viewModal.data.items||[]).reduce((a,item)=>a+(item.diff*(ingredients.find(x=>x.id===item.ingredient_id)?.cost_per_unit||0)),0)
                return (
                <div style={{ overflowX:"auto" }}>
                <div style={{ fontSize:12, color:"var(--ink4)", marginBottom:10 }}>Count Date: <strong>{viewModal.data.date||"—"}</strong></div>
                {viewModal.status==="pending" && (
                  <div style={{ fontSize:11, color:"var(--ink5)", fontStyle:"italic", marginBottom:10 }}>
                    ℹ️ "System" is the stock level when this count was taken. If sales/production happened
                    since then, "Live Now" shows current stock and "Will Become" shows what approving will
                    actually set it to (live + counted diff) — not the counted "Actual" number directly.
                  </div>
                )}
                <table className="bo-table">
                  <thead><tr><th>Ingredient</th><th>System</th><th>Actual</th><th>Diff</th><th>Live Now</th><th>Will Become</th><th>Unit Price</th><th>Value</th><th>Variance</th></tr></thead>
                  <tbody>
                    {(viewModal.data.items||[]).map((item,i)=>{
                      const foundIng = ingredients.find(x=>x.id===item.ingredient_id)
                      const unitPrice = foundIng?.cost_per_unit||0
                      const value = item.actual_qty*unitPrice
                      const variance = item.diff*unitPrice
                      const live = liveStock[item.ingredient_id]
                      const willBecome = live!=null ? Math.max(0, live + item.diff) : null
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight:600 }}>{item.name}</td>
                          <td>{item.system_qty} {item.unit}</td>
                          <td style={{ fontWeight:700 }}>{item.actual_qty} {item.unit}</td>
                          <td style={{ color:item.diff<0?"var(--red)":item.diff>0?"var(--green)":"var(--ink5)", fontWeight:700 }}>{item.diff>0?"+":""}{Number(item.diff).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                          <td style={{ color:live!=null&&live!==item.system_qty?"var(--amber)":"var(--ink5)" }}>{live!=null?live+" "+item.unit:"—"}</td>
                          <td style={{ fontWeight:700 }}>{willBecome!=null?willBecome+" "+item.unit:"—"}</td>
                          {foundIng ? <>
                            <td>{fmt(unitPrice)}</td>
                            <td>{fmt(value)}</td>
                            <td style={{ color:variance<0?"var(--red)":variance>0?"var(--green)":"var(--ink5)", fontWeight:700 }}>{variance>0?"+":""}{fmt(variance)}</td>
                          </> : <td colSpan={3} style={{ color:"var(--ink5)", fontStyle:"italic" }}>Ingredient deleted (no pricing)</td>}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7} style={{ textAlign:"right", fontWeight:700 }}>Total</td>
                      <td style={{ fontWeight:800 }}>{fmt(totalValue)}</td>
                      <td style={{ fontWeight:800, color:totalVariance<0?"var(--red)":totalVariance>0?"var(--green)":"var(--ink5)" }}>{totalVariance>0?"+":""}{fmt(totalVariance)}</td>
                    </tr>
                  </tfoot>
                </table>
                </div>
                )
              })()}
              {viewModal.type==="daily_recon" && (() => {
                const totalVariance = viewModal.data.total_variance_value || 0
                return (
                <div style={{ overflowX:"auto" }}>
                <div style={{ fontSize:12, color:"var(--ink4)", marginBottom:10 }}>Date: <strong>{viewModal.data.date||"—"}</strong> | Notes: <strong>{viewModal.data.notes||"—"}</strong></div>
                <table className="bo-table">
                  <thead><tr><th>Ingredient</th><th>System</th><th>Actual</th><th>Diff</th><th>Variance</th></tr></thead>
                  <tbody>
                    {(viewModal.data.items||[]).map((item,i)=>{
                      const variance = (item.diff || 0) * (item.cost_per_unit || 0)
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight:600 }}>{item.name}</td>
                          <td>{item.system_qty} {item.unit}</td>
                          <td style={{ fontWeight:700 }}>{item.actual_qty} {item.unit}</td>
                          <td style={{ color:item.diff<0?"var(--red)":item.diff>0?"var(--green)":"var(--ink5)", fontWeight:700 }}>{item.diff>0?"+":""}{Number(item.diff||0).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                          <td style={{ color:variance<0?"var(--red)":variance>0?"var(--green)":"var(--ink5)", fontWeight:700 }}>{variance>0?"+":""}{fmt(variance)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ textAlign:"right", fontWeight:700 }}>Total Variance</td>
                      <td style={{ fontWeight:800, color:totalVariance<0?"var(--red)":totalVariance>0?"var(--green)":"var(--ink5)" }}>{totalVariance>0?"+":""}{fmt(totalVariance)}</td>
                    </tr>
                  </tfoot>
                </table>
                </div>
                )
              })()}
              {viewModal.type==="waste" && (
                <div style={{ display:"grid", gap:14 }}>
                  {[["Date",viewModal.data.date||"—"],["Ingredient",viewModal.data.ingredient_name],["Quantity", (viewModal.data.entered_qty ? viewModal.data.entered_qty+" "+viewModal.data.entered_unit : viewModal.data.qty+" "+viewModal.data.unit) + (viewModal.data.entered_qty && viewModal.data.entered_unit !== viewModal.data.unit ? " ("+viewModal.data.qty+" "+viewModal.data.unit+")" : "")],["Reason",viewModal.data.reason],["Est. Cost",fmt(viewModal.data.estimated_cost)],["Notes",viewModal.data.notes||"—"]].map(([k,v])=>(
                    <div key={k}><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>{k}</div><div style={{ fontWeight:600, marginTop:3 }}>{v}</div></div>
                  ))}
                </div>
              )}
              {viewModal.type==="consumption" && (
                <div style={{ display:"grid", gap:14 }}>
                  {[["Date",viewModal.data.date||"—"],["Ingredient",viewModal.data.ingredient_name],["Quantity", (viewModal.data.entered_qty ? viewModal.data.entered_qty+" "+viewModal.data.entered_unit : viewModal.data.qty+" "+viewModal.data.unit) + (viewModal.data.entered_qty && viewModal.data.entered_unit !== viewModal.data.unit ? " ("+viewModal.data.qty+" "+viewModal.data.unit+")" : "")],["Est. Cost",fmt(viewModal.data.estimated_cost)],["Notes",viewModal.data.notes||"—"]].map(([k,v])=>(
                    <div key={k}><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>{k}</div><div style={{ fontWeight:600, marginTop:3 }}>{v}</div></div>
                  ))}
                </div>
              )}

              {viewModal.type==="trial" && (() => {
                const d = viewModal.data || viewModal.details
                let totalCost = 0
                return (
                  <div style={{ display:"grid", gap:14 }}>
                    {[["Date",(viewModal.submitted_at||"").slice(0,10)], ["Trial Name",d.trialName], ["Notes",d.notes||"—"]].map(([k,v])=>(
                      <div key={k}><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>{k}</div><div style={{ fontWeight:600, marginTop:3 }}>{v}</div></div>
                    ))}
                    <div>
                      <div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Ingredients Used</div>
                      <table className="bo-table" style={{ width:"100%" }}>
                        <thead>
                          <tr><th>Ingredient</th><th>Qty</th><th>Unit Price</th><th>Cost</th></tr>
                        </thead>
                        <tbody>
                          {(d.items||[]).map((item,i) => {
                            const ing = ingredients.find(x=>x.id===item.ingredient_id)
                            const unitPrice = unitPriceFor(ing, item.unit)
                            const cost = item.qty * unitPrice
                            totalCost += cost
                            return (
                              <tr key={i}>
                                <td>{item.ingredient_name || (ing?ing.name:"Unknown")}</td>
                                <td>{item.qty} {item.unit}</td>
                                <td>{fmt(unitPrice)}</td>
                                <td style={{ fontWeight:600 }}>{fmt(cost)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} style={{ textAlign:"right", fontWeight:700 }}>Total Trial Cost</td>
                            <td style={{ fontWeight:800, color:"#6366F1" }}>{fmt(totalCost)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )
              })()}
              {viewModal.type==="receiving" && (
                <div style={{ display:"grid", gap:14 }}>
                  {[["Date",viewModal.data.date||"—"],["Supplier",viewModal.data.supplier_name||"—"],["Invoice Total",fmt(viewModal.data.invoice_total)],["Notes",viewModal.data.notes||"—"]].map(([k,v])=>(
                    <div key={k}><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>{k}</div><div style={{ fontWeight:600, marginTop:3 }}>{v}</div></div>
                  ))}
                  <div>
                    <div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Items</div>
                    <div style={{ overflowX:"auto" }}>
                    <table className="bo-table">
                      <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit Cost</th></tr></thead>
                      <tbody>
                        {(viewModal.data.items||[]).map((item,i)=>(
                          <tr key={i}>
                            <td style={{ fontWeight:600 }}>{item.name}{!item.ingredient_id && <span style={{ color:"var(--red)", fontWeight:600 }}> ⚠ not matched</span>}</td>
                            <td>{item.qty}</td>
                            <td>{item.unit}</td>
                            <td>{fmt(item.unit_cost)}{item.cost_estimated && <span style={{ color:"var(--ink4)", fontWeight:600 }}> (est.)</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                  {viewModal.data.photo_url && (
                    <div>
                      <div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Invoice Photo</div>
                      <img src={viewModal.data.photo_url} alt="Invoice" style={{ maxWidth:"100%", borderRadius:8, border:"1px solid var(--surface3)" }} />
                    </div>
                  )}
                  <div style={{ fontSize:12, color:"var(--ink4)", fontStyle:"italic" }}>
                    Reference only — does not affect stock or cost. Finalize the real purchase through Bayar Faktur in Inventory.
                  </div>
                </div>
              )}
              {viewModal.type==="requisition" && (() => {
                const items = viewModal.data.items || []
                const bySupplier = {}
                items.forEach((item,i) => {
                  const sup = item.supplier || "Belum ada supplier"
                  if (!bySupplier[sup]) bySupplier[sup] = []
                  bySupplier[sup].push(i)
                })
                const totalAll = items.reduce((a,item)=>a+(item.qty*unitPriceFor(ingredients.find(x=>x.id===item.ingredient_id),item.unit)),0)
                return (
                <div>
                  <div style={{ marginBottom:12, fontSize:12, color:"var(--ink4)" }}>Needed by: <strong>{viewModal.data.needed_by||"—"}</strong> · Notes: {viewModal.data.notes||"—"}</div>
                  <div style={{ overflowX:"auto" }}>
                  <table className="bo-table">
                    <thead><tr><th></th><th>Ingredient</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th><th>Supplier</th></tr></thead>
                    <tbody>
                      {items.map((item,i)=>{
                        const foundIng = ingredients.find(x=>x.id===item.ingredient_id)
                        const unitPrice = unitPriceFor(foundIng, item.unit)
                        return (
                          <tr key={i}>
                            <td><input type="checkbox" checked={reqSelected.has(i)} onChange={()=>toggleReqItem(i)} /></td>
                            <td style={{ fontWeight:600 }}>{item.ingredient_name}</td>
                            <td style={{ fontWeight:700, color:"#6554C0" }}>{item.qty}</td>
                            <td>{item.unit}</td>
                            {foundIng ? <>
                              <td>{fmt(unitPrice)}</td>
                              <td style={{ fontWeight:600 }}>{fmt(item.qty*unitPrice)}</td>
                            </> : <td colSpan={2} style={{ color:"var(--red)", fontWeight:600 }}>⚠ unknown ingredient</td>}
                            <td>
                              <select value={item.supplier||""} onChange={e=>updateReqItemSupplier(viewModal, i, e.target.value)} className="bo-select" style={{ fontSize:11, padding:"4px 6px" }}>
                                <option value="">— none —</option>
                                {suppliers.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} style={{ textAlign:"right", fontWeight:700 }}>Total</td>
                        <td style={{ fontWeight:800, color:"#6554C0" }}>{fmt(totalAll)}</td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                  </div>

                  <div style={{ marginTop:16, borderTop:"1px solid var(--surface3)", paddingTop:12 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--ink4)", textTransform:"uppercase", marginBottom:8 }}>Send to Supplier</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {Object.entries(bySupplier).map(([sup, idxs])=>{
                        const allSelected = idxs.every(i=>reqSelected.has(i))
                        const selectedIdxs = idxs.filter(i=>reqSelected.has(i))
                        return (
                          <div key={sup} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"var(--surface)", borderRadius:"var(--r)", gap:8, flexWrap:"wrap" }}>
                            <button onClick={()=>setReqSelected(prev=>{ const next=new Set(prev); idxs.forEach(i=> allSelected? next.delete(i) : next.add(i)); return next })}
                              style={{ background:"none", border:"none", padding:0, cursor:"pointer", fontSize:12, fontWeight:700, color:"var(--ink)", textAlign:"left" }}>
                              {allSelected?"☑":"☐"} {sup} ({idxs.length} item{idxs.length>1?"s":""})
                            </button>
                            <button disabled={selectedIdxs.length===0} onClick={()=>sendSupplierGroupWA(viewModal, sup, selectedIdxs.map(i=>items[i]))}
                              style={{background: selectedIdxs.length===0?"#94A3B8":"#25D366",color:"#fff",border:"none",borderRadius:"var(--r)",padding:"6px 12px",fontSize:12,fontWeight:600,cursor:selectedIdxs.length===0?"not-allowed":"pointer",fontFamily:"inherit"}}>
                              💬 Kirim{selectedIdxs.length>0 && selectedIdxs.length!==idxs.length?" ("+selectedIdxs.length+")":""}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
                )
              })()}
              {viewModal.type==="production" && (() => {
                const used = viewModal.data.ingredients_used||[]
                const prodTotal = used.reduce((a,u)=>a+(u.qty*unitPriceFor(ingredients.find(x=>x.id===u.ingredient_id),u.unit)),0)
                return (
                <div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:16 }}>
                    <div><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>Date</div><div style={{ fontWeight:700, marginTop:3 }}>{viewModal.data.date||"—"}</div></div>
                    <div><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>Produced</div><div style={{ fontWeight:700, color:"var(--green)", marginTop:3 }}>{viewModal.data.item_name}</div></div>
                    <div><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>Batches</div><div style={{ fontWeight:700, marginTop:3 }}>{viewModal.data.batch_qty ?? "—"}× resep</div></div>
                    <div><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>Quantity</div><div style={{ fontWeight:700, marginTop:3 }}>{viewModal.data.actual_yield??viewModal.data.batch_qty} {viewModal.data.yield_unit||viewModal.data.unit}</div></div>
                  </div>
                  <table className="bo-table">
                    <thead><tr><th>Ingredient</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Cost</th></tr></thead>
                    <tbody>
                      {used.map((u,i) => {
                        const ing = ingredients.find(x=>x.id===u.ingredient_id)
                        const unitPrice = unitPriceFor(ing,u.unit)
                        return (
                          <tr key={i}>
                            <td>{u.name}</td><td>{Math.round((u.qty||0)*100)/100}</td><td>{u.unit}</td>
                            {ing ? <><td>{fmt(unitPrice)}</td><td>{fmt(u.qty*unitPrice)}</td></>
                              : <td colSpan={2} style={{ color:"var(--ink5)", fontStyle:"italic" }}>Ingredient deleted (no pricing)</td>}
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:"var(--surface)", fontWeight:800 }}>
                        <td colSpan={4} style={{ textAlign:"right" }}>Total Cost</td>
                        <td>{fmt(prodTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  {viewModal.data.notes && <div style={{ marginTop:12, fontSize:12, color:"var(--ink4)" }}>Notes: {viewModal.data.notes}</div>}
                </div>
                )
              })()}
            </div>
