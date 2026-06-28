import { useState, useEffect, useRef } from "react";
import { registerPlugin } from "@capacitor/core";

const PrintBridge = registerPlugin("PrintBridge");
const isNative = () => !!window?.Capacitor?.isNativePlatform?.();

const TEAL = "#0D9488";

// ── SVG Icons ────────────────────────────────────────────────────────────────
function IconReceipt({ color = "white", size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
      <path d="M14 8H8M16 12H8M11 16H8"/>
    </svg>
  );
}

function IconChef({ color = "white", size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/>
      <line x1="6" y1="17" x2="18" y2="17"/>
    </svg>
  );
}

function IconDrink({ color = "white", size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 22h8M7 10h10l-1 7H8L7 10ZM5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/>
      <path d="M11 7V4M13 7V4"/>
    </svg>
  );
}

function IconPrinter({ color = "white", size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
  );
}

function IconSearch({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

function IconBack({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  );
}

// ── Empty state printer illustration ─────────────────────────────────────────
function PrinterIllustration() {
  return (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none">
      {/* blob background */}
      <ellipse cx="80" cy="95" rx="62" ry="34" fill="#CCFBF1" />
      <path d="M30 60 Q10 30 50 20 Q80 10 110 25 Q145 15 148 50 Q158 80 130 95 Q100 110 60 100 Q20 92 30 60Z" fill="#99F6E4" opacity="0.5"/>
      {/* printer body */}
      <rect x="34" y="68" width="92" height="52" rx="6" fill="#0F766E"/>
      <rect x="34" y="68" width="92" height="18" rx="6" fill="#0D9488"/>
      {/* paper slot */}
      <rect x="50" y="74" width="60" height="6" rx="3" fill="#5EEAD4"/>
      {/* paper coming out */}
      <rect x="54" y="56" width="52" height="28" rx="3" fill="white"/>
      <rect x="60" y="63" width="30" height="3" rx="1.5" fill="#CBD5E1"/>
      <rect x="60" y="70" width="24" height="3" rx="1.5" fill="#CBD5E1"/>
      {/* printer detail */}
      <circle cx="112" cy="88" r="5" fill="#0F766E"/>
      <circle cx="112" cy="88" r="3" fill="#14B8A6"/>
      {/* plus badge */}
      <circle cx="52" cy="105" r="14" fill="#94A3B8"/>
      <circle cx="52" cy="105" r="12" fill="#CBD5E1"/>
      <rect x="51" y="99" width="2" height="12" rx="1" fill="white"/>
      <rect x="46" y="104" width="12" height="2" rx="1" fill="white"/>
      {/* dots */}
      <circle cx="130" cy="65" r="3" fill="#99F6E4"/>
      <circle cx="22" cy="80" r="4" fill="#CCFBF1"/>
      <circle cx="140" cy="100" r="3" fill="#99F6E4"/>
    </svg>
  );
}

// ── Station config ────────────────────────────────────────────────────────────
const STATIONS = [
  { id: "kitchen", label: "Printer Kasir",   Icon: IconReceipt },
  { id: "snack",   label: "Printer Dapur 1", Icon: IconChef    },
  { id: "bar",     label: "Printer Dapur 2", Icon: IconDrink   },
  { id: "receipt", label: "Printer Struk",   Icon: IconPrinter },
];

const CONNECTION_TYPES = [
  { id: "bluetooth",  label: "Bluetooth",  enabled: true  },
  { id: "lanwifi",    label: "LAN/WIFI",   enabled: false },
  { id: "usbserial",  label: "USB/Serial", enabled: false },
  { id: "aplikasi",   label: "Aplikasi",   enabled: false },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function PrinterSettings() {
  const [view,       setView]       = useState("list");
  const [editId,     setEditId]     = useState(null);
  const [aksiId,     setAksiId]     = useState(null);
  const [connSheet,  setConnSheet]  = useState(null);
  const [selMac,     setSelMac]     = useState("");
  const [selPs,      setSelPs]      = useState("80mm");
  const [search,     setSearch]     = useState("");
  const [discovered, setFound]      = useState([]);
  const [config,     setConfig]     = useState({});
  const [serviceOn,  setService]    = useState(false);
  const [busy,       setBusy]       = useState(null);
  const [toast,      setToast]      = useState(null);
  const toastTimer = useRef(null);

  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (!isNative()) return;
    loadConfig();
    const iv = setInterval(loadConfig, 5000);
    return () => clearInterval(iv);
  }, []);

  async function loadConfig() {
    try {
      const [cfg, status] = await Promise.all([
        PrintBridge.getPrinterConfig(),
        PrintBridge.getServiceStatus(),
      ]);
      setConfig(cfg);
      setService(status.running);
      const { devices } = await PrintBridge.getBondedDevices();
      if (devices?.length) setFound(devices.map(d => ({ address: d.mac, name: d.name })));
    } catch (_) {}
  }

  async function assignPrinter(station, mac, paperSize) {
    if (!mac) return;
    const dev = discovered.find(d => d.address === mac);
    const name = dev?.name || mac;
    try {
      await PrintBridge.setPrinterMac({ station, mac, name, paperSize });
      showToast(`Tersimpan: ${name.slice(0, 20)}`);
      loadConfig();
    } catch (e) { showToast("Error: " + e.message); }
  }

  async function removePrinter(station) {
    try {
      await PrintBridge.removePrinter({ station });
      showToast("Perangkat dihapus");
      loadConfig();
    } catch (e) { showToast("Error: " + e.message); }
  }

  async function handleTest(station) {
    setBusy(station);
    try {
      const ps = config[station]?.paperSize || "80mm";
      await PrintBridge.testPrint({ station, paperSize: ps });
      showToast("Tes cetak berhasil");
    } catch (e) { showToast("Tes gagal: " + e.message); }
    finally { setBusy(null); }
  }

  async function toggleService() {
    try {
      if (serviceOn) { await PrintBridge.stopService(); showToast("Service dihentikan"); }
      else           { await PrintBridge.startService(); showToast("Service dimulai"); }
      setService(!serviceOn);
    } catch (e) { showToast("Error: " + e.message); }
  }

  function openAdd(id) {
    setEditId(id);
    setSelMac("");
    setSelPs("80mm");
    setSearch("");
    setView("configure");
    loadConfig();
  }

  function openEdit(id) {
    const st = config[id] || {};
    setEditId(id);
    setSelMac(st.mac || "");
    setSelPs(st.paperSize || "80mm");
    setSearch("");
    setView("configure");
    loadConfig();
  }

  async function saveDevice() {
    if (!selMac) return;
    await assignPrinter(editId, selMac, selPs);
    setView("list");
  }

  async function handleAksiTest() {
    const s = aksiId;
    setAksiId(null);
    await handleTest(s);
  }

  async function handleAksiHapus() {
    const s = aksiId;
    setAksiId(null);
    await removePrinter(s);
  }

  // ── Toast overlay (shared across all views) ──────────────────────────────
  const toastEl = toast ? (
    <div style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, background: "#1E293B", color: "white",
      padding: "12px 22px", borderRadius: 24, fontSize: 13, fontWeight: 600,
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)", whiteSpace: "nowrap",
      pointerEvents: "none",
    }}>
      {toast}
    </div>
  ) : null;

  // ── Not native ───────────────────────────────────────────────────────────
  if (!isNative()) {
    return (
      <div style={{ padding: "32px 20px", textAlign: "center", color: "#6B7A8D" }}>
        <div style={{ marginBottom: 12 }}>
          <IconPrinter color="#CBD5E1" size={40} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#374151", marginBottom: 6 }}>
          Printer tidak tersedia di browser
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          Gunakan aplikasi Android untuk mengatur printer Bluetooth.
        </div>
      </div>
    );
  }

  // ── Configure view ───────────────────────────────────────────────────────
  if (view === "configure") {
    const st = STATIONS.find(s => s.id === editId) || {};
    const isEditing = !!(config[editId]?.mac);
    const q = search.toLowerCase();
    const filtered = discovered.filter(d => !q || d.name.toLowerCase().includes(q) || d.address.toLowerCase().includes(q));

    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>

        {/* Teal header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: TEAL, margin: "-16px -16px 0", padding: "16px 16px 16px",
          marginBottom: 20,
        }}>
          <button onClick={() => setView("list")} style={{
            background: "none", border: "none", cursor: "pointer", padding: 4,
            display: "flex", alignItems: "center",
          }}>
            <IconBack />
          </button>
          <span style={{ fontWeight: 700, fontSize: 16, color: "white", flex: 1 }}>
            {st.label || "Pilih Perangkat"}
          </span>
        </div>

        {/* Search bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          border: "1px solid #E5E7EB", borderRadius: 10,
          padding: "10px 14px", marginBottom: 14, background: "white",
        }}>
          <IconSearch />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari ..."
            style={{
              border: "none", outline: "none", flex: 1,
              fontSize: 14, color: "#374151", background: "transparent",
            }}
          />
        </div>

        {/* Scan button */}
        <button onClick={loadConfig} style={{
          width: "100%", padding: "13px 0", borderRadius: 10,
          border: `1.5px solid ${TEAL}`, background: "white",
          color: TEAL, fontWeight: 700, fontSize: 14,
          cursor: "pointer", marginBottom: 20,
        }}>
          Scan Ulang Perangkat
        </button>

        {/* Device list / empty state */}
        {filtered.length === 0 && !(isEditing && config[editId]?.mac) ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 0 32px" }}>
            <PrinterIllustration />
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1E293B", marginTop: 16, marginBottom: 8 }}>
              Perangkat Tidak Tersedia
            </div>
            <div style={{ fontSize: 13, color: "#6B7A8D", textAlign: "center", lineHeight: 1.6, maxWidth: 240 }}>
              Silakan pair printer di Pengaturan Bluetooth Android lalu tekan{" "}
              <strong>Scan Ulang Perangkat</strong>
            </div>
          </div>
        ) : (
          <div style={{ borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden", marginBottom: 20 }}>
            {filtered.map((dev, i) => (
              <div key={dev.address}
                onClick={() => setSelMac(dev.address)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px",
                  borderBottom: i < filtered.length - 1 ? "1px solid #F1F5F9" : "none",
                  cursor: "pointer",
                  background: selMac === dev.address ? "#F0FDFA" : "white",
                }}>
                <Radio selected={selMac === dev.address} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{dev.name}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "monospace", marginTop: 2 }}>{dev.address}</div>
                </div>
              </div>
            ))}
            {/* Show current saved device if not in bonded list */}
            {isEditing && config[editId]?.mac && !discovered.find(d => d.address === config[editId].mac) && (
              <div
                onClick={() => setSelMac(config[editId].mac)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                  cursor: "pointer",
                  background: selMac === config[editId].mac ? "#F0FDFA" : "#FFFBEB",
                  borderTop: "1px solid #F1F5F9",
                }}>
                <Radio selected={selMac === config[editId].mac} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
                    {config[editId].name || config[editId].mac}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "monospace", marginTop: 2 }}>
                    {config[editId].mac} · tersimpan
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paper size */}
        <div style={{
          fontSize: 11, fontWeight: 700, color: "#6B7A8D",
          textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8,
        }}>
          Tipe Kertas
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["58mm", "80mm"].map(ps => (
            <button key={ps} onClick={() => setSelPs(ps)} style={{
              flex: 1, padding: "11px 0", borderRadius: 10,
              border: `1.5px solid ${selPs === ps ? TEAL : "#E2E8F0"}`,
              background: selPs === ps ? TEAL : "white",
              color: selPs === ps ? "white" : "#374151",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>
              {ps}
            </button>
          ))}
        </div>

        {/* Save */}
        <button onClick={saveDevice} disabled={!selMac} style={{
          padding: "14px 0", borderRadius: 12, border: "none",
          background: selMac ? TEAL : "#E2E8F0",
          color: selMac ? "white" : "#94A3B8",
          fontWeight: 700, fontSize: 15,
          cursor: selMac ? "pointer" : "not-allowed",
        }}>
          Simpan
        </button>

        {toastEl}
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Service toggle */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderRadius: 14,
        background: serviceOn ? "#F0FDF4" : "#FFF7ED",
        border: `1px solid ${serviceOn ? "#86EFAC" : "#FCD34D"}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: serviceOn ? "#16A34A" : "#92400E" }}>
            {serviceOn ? "Print Service Aktif" : "Print Service Mati"}
          </div>
          <div style={{ fontSize: 11, color: "#6B7A8D", marginTop: 2 }}>
            {serviceOn ? "Auto-print tiket dapur aktif" : "Tap Start untuk mengaktifkan"}
          </div>
        </div>
        <button onClick={toggleService} style={{
          padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
          background: serviceOn ? "#EF4444" : "#16A34A",
          color: "white", fontWeight: 700, fontSize: 12,
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        }}>
          {serviceOn ? "Stop" : "Start"}
        </button>
      </div>

      {/* Section label */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#94A3B8",
        textTransform: "uppercase", letterSpacing: "0.6px", marginTop: 4, paddingLeft: 2,
      }}>
        Perangkat Printer
      </div>

      {/* Station cards */}
      {STATIONS.map(({ id, label, Icon }) => {
        const st = config[id] || {};
        const hasMac = !!st.mac;
        const connected = !!st.connected;

        return (
          <div key={id}
            onClick={hasMac ? () => openEdit(id) : undefined}
            style={{
              background: "white", borderRadius: 14, padding: "14px 16px",
              border: "1px solid #F1F5F9",
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
              cursor: hasMac ? "pointer" : "default",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

              {/* Icon in teal circle */}
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: hasMac ? TEAL : "#F1F5F9",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon color={hasMac ? "white" : "#94A3B8"} size={20} />
              </div>

              {/* Labels */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{label}</div>
                <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {hasMac
                    ? `${st.name || st.mac} · Bluetooth · ${st.paperSize || "80mm"}`
                    : "Belum dikonfigurasi"}
                </div>
              </div>

              {/* Status + action */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {hasMac && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: connected ? "#22C55E" : "#F59E0B",
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: connected ? "#16A34A" : "#92400E" }}>
                      {connected ? "Terhubung" : "Tersimpan"}
                    </span>
                  </div>
                )}
                {hasMac ? (
                  <button
                    onClick={e => { e.stopPropagation(); setAksiId(id); }}
                    style={{
                      padding: "6px 14px", borderRadius: 20, border: "none",
                      background: TEAL, color: "white",
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>
                    Aksi
                  </button>
                ) : (
                  <button
                    onClick={() => setConnSheet(id)}
                    style={{
                      padding: "6px 14px", borderRadius: 20,
                      border: `1.5px solid ${TEAL}`, background: "white",
                      color: TEAL, fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>
                    + Tambah
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Pilih Jenis Koneksi bottom sheet ── */}
      {connSheet && (
        <>
          <div onClick={() => setConnSheet(null)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100,
          }} />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
            background: "white", borderRadius: "20px 20px 0 0",
            boxShadow: "0 -6px 30px rgba(0,0,0,0.15)", paddingBottom: 32,
          }}>
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 6 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E2E8F0" }} />
            </div>
            <div style={{ padding: "12px 24px 0" }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: "#111827", marginBottom: 24 }}>
                Pilih Jenis Koneksi
              </div>
              {CONNECTION_TYPES.map(ct => (
                <div key={ct.id} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  paddingBottom: 22, opacity: ct.enabled ? 1 : 0.35,
                }}>
                  <Radio selected={ct.id === "bluetooth"} disabled={!ct.enabled} />
                  <span style={{ fontWeight: 600, fontSize: 16, color: "#111827" }}>{ct.label}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  onClick={() => setConnSheet(null)}
                  style={{
                    flex: 1, padding: "14px 0", borderRadius: 12,
                    border: "none", background: "none",
                    color: TEAL, fontWeight: 700, fontSize: 15, cursor: "pointer",
                  }}>
                  Batal
                </button>
                <button
                  onClick={() => { const id = connSheet; setConnSheet(null); openAdd(id); }}
                  style={{
                    flex: 2, padding: "14px 0", borderRadius: 12,
                    border: "none", background: TEAL,
                    color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer",
                  }}>
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Aksi bottom sheet ── */}
      {aksiId && (
        <>
          <div onClick={() => setAksiId(null)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100,
          }} />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
            background: "white", borderRadius: "20px 20px 0 0",
            boxShadow: "0 -6px 30px rgba(0,0,0,0.15)", paddingBottom: 32,
          }}>
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E2E8F0" }} />
            </div>
            <div style={{ padding: "8px 0 0" }}>
              <div style={{ padding: "10px 24px 14px", fontWeight: 700, fontSize: 16, color: "#111827" }}>
                Aksi
              </div>
              <div onClick={handleAksiTest} style={{
                padding: "16px 24px", fontSize: 15, cursor: "pointer",
                color: busy === aksiId ? "#94A3B8" : "#111827",
                borderTop: "1px solid #F1F5F9",
                fontWeight: 500,
              }}>
                {busy === aksiId ? "Mengirim tes..." : "Tes Cetak"}
              </div>
              <div onClick={handleAksiHapus} style={{
                padding: "16px 24px", fontSize: 15, cursor: "pointer",
                color: "#EF4444", borderTop: "1px solid #F1F5F9",
                fontWeight: 500,
              }}>
                Hapus Perangkat
              </div>
            </div>
          </div>
        </>
      )}

      {toastEl}
    </div>
  );
}

// ── Radio button component ────────────────────────────────────────────────────
function Radio({ selected, disabled = false }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
      border: `2px solid ${selected && !disabled ? TEAL : "#CBD5E1"}`,
      background: selected && !disabled ? TEAL : "white",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {selected && !disabled && (
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />
      )}
    </div>
  );
}
