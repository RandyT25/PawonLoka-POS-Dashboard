        <div className="bo-modal-overlay" onClick={() => setViewDetail(null)}>
          <div className="bo-modal" style={{ maxWidth: 1200 }} onClick={e => e.stopPropagation()}>
            <div className="bo-modal-header">
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>
                  📋 Rincian Stok Harian ({viewDetail.data?.date || viewDetail.submitted_at?.slice(0, 10)})
                </div>
                <div style={{ fontSize: 12, color: "var(--ink4)" }}>
                  Kasir: <b>{viewDetail.submitted_by || "Kasir"}</b> · Waktu: {new Date(viewDetail.submitted_at).toLocaleString("id-ID")}
                </div>
              </div>
              <button className="bo-modal-close" onClick={() => setViewDetail(null)}>✕</button>
            </div>

            <div className="bo-modal-body" style={{ maxHeight: "75vh", overflowY: "auto", paddingBottom: "40px" }}>
              {viewDetail.data?.notes && (
                <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: 8, marginBottom: 24, border: "1px solid #E2E8F0" }}>
                  <div style={{ color: "#334155", fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 18 }}>📝</span> Analisis Sistem Otomatis
                  </div>
                  <div style={{ color: "#475569", fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {viewDetail.data.notes}
                  </div>
                </div>
              )}

              <table className="bo-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Bahan</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Awal</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>+Masuk</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>-Terjual</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>-Produksi</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>-Waste</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Staff Meal</th>
                    <th style={{ textAlign: "center", background: "#F1F5F9", whiteSpace: "nowrap" }}>Sisa Teori</th>
                    <th style={{ textAlign: "center", background: "#EFF6FF", whiteSpace: "nowrap" }}>Sisa Fisik</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Selisih</th>
                    <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Nilai Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewDetail.data?.items || []).map((it, idx) => {
                    let displayVal = "Rp 0";
                    let displayColor = "var(--ink4)";
                    if (it.diff_value !== undefined) {
                      if (it.diff_value < 0) {
                        displayVal = `-${fmt(Math.abs(it.diff_value))}`;
                        displayColor = "#DE350B";
                      } else if (it.diff_value > 0) {
                        displayVal = `+${fmt(it.diff_value)}`;
                        displayColor = "#00875A";
                      }
                    } else {
                      const lossOnly = it.diff_qty < 0 ? Math.abs(it.diff_qty) * (it.cost_per_unit || 0) : 0;
                      if (lossOnly > 0) {
                        displayVal = `-${fmt(lossOnly)}`;
                        displayColor = "#DE350B";
                      }
                    }
                    return (
                      <tr key={idx}>
                        <td>
                          <div style={{ fontWeight: 700, color: "var(--ink1)" }}>{it.name}</div>
                          <div style={{ fontSize: 11, color: "var(--ink5)" }}>Satuan: {it.unit}</div>
                        </td>
                        <td style={{ textAlign: "center" }}>{it.opening_stock ?? "—"}</td>
                        <td style={{ textAlign: "center", color: it.added_qty > 0 ? "#00875A" : "var(--ink5)" }}>
                          {it.added_qty > 0 ? `+${it.added_qty}` : "0"}
                          {it.claimed_added_qty !== undefined && it.claimed_added_qty !== it.added_qty && (
                            <div style={{ color: "#DE350B", fontSize: 10, fontWeight: 700, marginTop: 2, background: "#FEE2E2", padding: "2px 4px", borderRadius: 4 }}>
                              Klaim Kasir: +{it.claimed_added_qty}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "center", color: it.sold_qty > 0 ? "#DE350B" : "var(--ink5)", fontWeight: 600 }}>
                          {it.sold_qty > 0 ? `-${it.sold_qty}` : "0"}
                        </td>
                        <td style={{ textAlign: "center", color: (it.production_qty || 0) > 0 ? "#D97706" : "var(--ink5)", fontWeight: 600 }}>
                          {(it.production_qty || 0) > 0 ? `-${it.production_qty}` : "0"}
                        </td>
                        <td style={{ textAlign: "center", color: (it.waste_qty || 0) > 0 ? "#9A3412" : "var(--ink5)", fontWeight: 600 }}>
                          {(it.waste_qty || 0) > 0 ? `-${it.waste_qty}` : "0"}
                        </td>
                        <td style={{ textAlign: "center", color: (it.adj_qty || 0) !== 0 ? "#475569" : "var(--ink5)", fontWeight: 600 }}>
                          {(it.adj_qty || 0) > 0 ? `+${it.adj_qty}` : (it.adj_qty || 0) < 0 ? it.adj_qty : "0"}
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 700, background: "#F8FAFC" }}>
                          {it.expected_qty} {it.unit}
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 800, color: "#0284C7", background: "#F0F9FF" }}>
                          {it.actual_qty} {it.unit}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {it.diff_qty === 0 ? (
                            <span style={{ color: "#00875A", fontWeight: 700 }}>✓ Cocok</span>
                          ) : it.diff_qty < 0 ? (
                            <span style={{ color: "#DE350B", fontWeight: 800 }}>{it.diff_qty} {it.unit}</span>
                          ) : (
                            <span style={{ color: "#F59E0B", fontWeight: 800 }}>+{it.diff_qty} {it.unit}</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: displayColor }}>
                          {displayVal}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="bo-modal-footer" style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setViewDetail(null)} className="bo-btn bo-btn-ghost">Tutup</button>
              {viewDetail.status !== "approved" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleApprove(viewDetail, false)}
                    className="bo-btn bo-btn-ghost"
                    style={{ color: "#00875A" }}
                  >
                    Setujui Saja
