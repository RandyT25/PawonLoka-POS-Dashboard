import { useState, useEffect, useRef } from "react";
import { registerPlugin } from "@capacitor/core";

const PrintBridge = registerPlugin("PrintBridge");
const isNative = () => !!window?.Capacitor?.isNativePlatform?.();

const STATIONS = [
  { id: "kitchen", label: "🍳 Kitchen" },
  { id: "snack",   label: "🍟 Snack" },
  { id: "bar",     label: "🍹 Bar" },
  { id: "receipt", label: "🧾 Kasir / Receipt" },
];

export default function PrinterSettings({ hook }) {
  const [discovered, setDiscovered] = useState([]);
  const [config, setConfig]         = useState({});
  const [serviceOn, setServiceOn]   = useState(false);
  const [scanning, setScanning]     = useState(false);
  const [pairingAddr, setPairing]   = useState(null);
  const [busy, setBusy]             = useState(null);
  const [log, setLog]               = useState([]);
  const [newRole, setNewRole]       = useState("kitchen");
  const listenerRef                 = useRef(null);

  const { printers, scanAndPair, reconnect, removePrinter } = hook;
  const btSupported = !!navigator.bluetooth;

  const addLog = msg => setLog(p => [...p.slice(-12), msg]);

  useEffect(() => {
    if (!isNative()) return;
    loadConfig();
    const iv = setInterval(loadConfig, 5000);
    return () => { clearInterval(iv); stopScan(); };
  }, []);

  async function loadConfig() {
    try {
      const [cfg, status] = await Promise.all([
        PrintBridge.getPrinterConfig(),
        PrintBridge.getServiceStatus(),
      ]);
      setConfig(cfg);
      setServiceOn(status.running);
      // Pre-load bonded printers so station dropdowns work without scanning
      const { devices } = await PrintBridge.getBondedDevices();
      if (devices?.length) {
        setDiscovered(prev => {
          const merged = [...prev];
          devices.forEach(d => {
            if (!merged.find(m => m.address === d.mac))
              merged.push({ address: d.mac, name: d.name, bonded: true });
          });
          return merged;
        });
      }
    } catch (_) {}
  }

  async function startScan() {
    setDiscovered([]);
    setScanning(true);
    try {
      // Listen for discovered devices
      listenerRef.current = await PrintBridge.addListener("deviceFound", dev => {
        setDiscovered(prev => {
          const exists = prev.find(d => d.address === dev.address);
          if (exists) return prev.map(d => d.address === dev.address ? { ...d, ...dev } : d);
          return [...prev, dev];
        });
      });
      const doneListener = await PrintBridge.addListener("scanFinished", () => {
        setScanning(false);
        doneListener.remove();
      });
      await PrintBridge.startScan();
      // Auto-stop UI indicator after 15s
      setTimeout(() => setScanning(false), 15000);
    } catch (e) {
      setScanning(false);
      addLog("Scan error: " + e.message);
    }
  }

  async function stopScan() {
    try { await PrintBridge.stopScan(); } catch (_) {}
    listenerRef.current?.remove();
    listenerRef.current = null;
    setScanning(false);
  }

  async function pairDevice(address, name) {
    setPairing(address);
    addLog(`Pairing ${name}...`);
    try {
      await PrintBridge.pairDevice({ address });
      addLog(`✓ Paired: ${name}`);
      setDiscovered(prev => prev.map(d => d.address === address ? { ...d, bonded: true } : d));
      loadConfig();
    } catch (e) {
      addLog(`✗ ${e.message}`);
    } finally {
      setPairing(null);
    }
  }

  async function assignPrinter(station, mac) {
    try {
      await PrintBridge.setPrinterMac({ station, mac });
      addLog(`Saved: ${station} → ${mac.slice(-5)}`);
      loadConfig();
    } catch (e) { addLog("Error: " + e.message); }
  }

  async function handleTest(station) {
    setBusy(station);
    try { await PrintBridge.testPrint({ station }); addLog(`✓ Test OK: ${station}`); }
    catch (e) { addLog(`✗ Test failed: ${e.message}`); }
    finally { setBusy(null); }
  }

  async function toggleService() {
    try {
      if (serviceOn) { await PrintBridge.stopService(); addLog("Service stopped"); }
      else           { await PrintBridge.startService(); addLog("Service started"); }
      setServiceOn(!serviceOn);
    } catch (e) { addLog("Error: " + e.message); }
  }

  // ── NATIVE APK UI ──────────────────────────────────────────────────────
  if (isNative()) {
    const bondedAddrs = new Set(Object.values(config).map(c => c?.mac).filter(Boolean));

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Service toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", borderRadius: 10,
          background: serviceOn ? "#F0FDF4" : "#FFF7ED",
          border: `1px solid ${serviceOn ? "#86EFAC" : "#FCD34D"}` }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: serviceOn ? "#16A34A" : "#92400E" }}>
              {serviceOn ? "● Print Service Running" : "○ Print Service Stopped"}
            </div>
            <div style={{ fontSize: 11, color: "#6B7A8D" }}>
              {serviceOn ? "Auto-printing kitchen tickets from Supabase" : "Tap Start to enable"}
            </div>
          </div>
          <button onClick={toggleService}
            style={{ padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              background: serviceOn ? "#EF4444" : "#16A34A", color: "white", fontWeight: 700, fontSize: 12 }}>
            {serviceOn ? "Stop" : "Start"}
          </button>
        </div>

        {/* Scan section */}
        <div style={{ borderRadius: 10, border: "1.5px solid #E2E8F0", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Find & Pair Printers</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>Tap Scan to discover nearby Bluetooth printers</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {scanning
                ? <button onClick={stopScan}
                    style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#6B7A8D", color: "white", fontSize: 12, cursor: "pointer" }}>
                    Stop
                  </button>
                : <button onClick={startScan}
                    style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#3B82F6", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {discovered.length > 0 ? "Re-scan" : "🔍 Scan"}
                  </button>
              }
            </div>
          </div>

          {scanning && (
            <div style={{ padding: "8px 14px", background: "#EFF6FF", fontSize: 11, color: "#3B82F6", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ animation: "spin 1s linear infinite" }}>⟳</span> Scanning for Bluetooth printers...
            </div>
          )}

          {discovered.length === 0 && !scanning && (
            <div style={{ padding: "16px 14px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
              Tap Scan to find nearby printers
            </div>
          )}

          {discovered.map(dev => (
            <div key={dev.address} style={{ display: "flex", alignItems: "center", padding: "10px 14px",
              borderBottom: "1px solid #F1F5F9", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{dev.name}</div>
                <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "monospace" }}>{dev.address}</div>
              </div>
              {dev.bonded || bondedAddrs.has(dev.address) ? (
                <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 600 }}>✓ Paired</div>
              ) : (
                <button
                  onClick={() => pairDevice(dev.address, dev.name)}
                  disabled={pairingAddr === dev.address}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "none",
                    background: pairingAddr === dev.address ? "#E2E8F0" : "#0A1628",
                    color: pairingAddr === dev.address ? "#6B7A8D" : "white",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {pairingAddr === dev.address ? "Pairing..." : "Pair"}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Station assignment */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase",
          letterSpacing: "0.5px", marginTop: 4 }}>
          Assign Stations
        </div>

        {STATIONS.map(({ id, label }) => {
          const st = config[id] || {};
          const mac = st.mac || "";
          const connected = !!st.connected;
          const pairedDevices = discovered.filter(d => d.bonded || bondedAddrs.has(d.address));

          return (
            <div key={id} style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px",
              border: `1.5px solid ${mac ? (connected ? "#86EFAC" : "#E2E8F0") : "#E2E8F0"}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%",
                    background: connected ? "#22C55E" : mac ? "#F59E0B" : "#CBD5E1" }} />
                  <span style={{ fontSize: 11, color: "#6B7A8D" }}>
                    {connected ? "Connected" : mac ? "Saved" : "Not set"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={mac}
                  onChange={e => e.target.value && assignPrinter(id, e.target.value)}
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 8,
                    border: "1.5px solid #E2E8F0", fontSize: 12, background: "white" }}>
                  <option value="">-- Select printer --</option>
                  {/* Paired devices from scan */}
                  {pairedDevices.map(d => (
                    <option key={d.address} value={d.address}>{d.name} ({d.address.slice(-5)})</option>
                  ))}
                  {/* Already-configured MAC not in scan list */}
                  {mac && !pairedDevices.find(d => d.address === mac) && (
                    <option value={mac}>{mac}</option>
                  )}
                </select>
                {mac && (
                  <button onClick={() => handleTest(id)} disabled={busy === id}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E2E8F0",
                      background: "white", fontSize: 12, cursor: "pointer" }}>
                    {busy === id ? "..." : "Test"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Log */}
        {log.length > 0 && (
          <div style={{ background: "#0A1628", borderRadius: 8, padding: 10 }}>
            {log.map((l, i) => (
              <div key={i} style={{ fontSize: 10, fontFamily: "monospace", lineHeight: 1.6,
                color: l.startsWith("✓") ? "#86EFAC" : l.startsWith("✗") ? "#FCA5A5" : "#94A3B8" }}>
                {l}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── CHROME BROWSER FALLBACK ─────────────────────────────────────────
  const ROLES = [
    { id: "receipt", label: "Kasir — Receipt Printer" },
    { id: "kitchen", label: "Kitchen Station" },
    { id: "snack",   label: "Snack Station" },
    { id: "bar",     label: "Bar Station" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!btSupported && (
        <div style={s.warn}>Web Bluetooth not supported. Use Chrome on Android or Chrome desktop.</div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <select value={newRole} onChange={e => setNewRole(e.target.value)}
          style={{ flex: 1, padding: "10px 8px", border: "1.5px solid #DFE1E6", borderRadius: 8, fontSize: 13, background: "#fff" }}>
          {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <button onClick={() => scanAndPair(newRole).catch(e => addLog(e.message))}
          disabled={!btSupported}
          style={{ ...s.scanBtn, flex: "none", padding: "10px 16px", width: "auto" }}>
          Add Printer
        </button>
      </div>
      {printers.map(p => (
        <div key={p.id} style={s.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ ...s.dot, background: p.connected ? "#00875A" : "#C1C7D0" }} />
            <span style={s.connLabel}>{p.connected ? "Connected" : "Disconnected"}</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#6B7A8D" }}>{p.name} · {p.role}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!p.connected && <button onClick={() => reconnect(p.id)} style={s.primaryBtn}>Connect</button>}
            <button onClick={() => removePrinter(p.id)} style={{ ...s.ghostBtn, marginLeft: "auto", color: "#DE350B" }}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const s = {
  scanBtn:    { width: "100%", padding: "11px 0", background: "#0066FF", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  warn:       { padding: "10px 12px", background: "#FFF7E6", border: "1px solid #FFE0B2", borderRadius: 8, fontSize: 12, color: "#7D5A00", lineHeight: 1.6 },
  card:       { background: "#F4F5F7", borderRadius: 10, padding: "12px 14px", border: "1px solid #DFE1E6" },
  dot:        { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  connLabel:  { fontSize: 11, fontWeight: 600, color: "#6B778C" },
  ghostBtn:   { padding: "8px 14px", borderRadius: 8, border: "1.5px solid #DFE1E6", background: "white", fontSize: 12, cursor: "pointer" },
  primaryBtn: { padding: "8px 14px", borderRadius: 8, border: "none", background: "#0066FF", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" },
};
