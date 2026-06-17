import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";

const ESC = 0x1B, GS = 0x1D;

function escpos(cmds) {
  const bytes = [];
  for (const cmd of cmds) {
    if (typeof cmd === "number") bytes.push(cmd);
    else if (typeof cmd === "string") {
      for (let i = 0; i < cmd.length; i++) bytes.push(cmd.charCodeAt(i) & 0xFF);
    } else if (Array.isArray(cmd)) bytes.push(...cmd);
  }
  return new Uint8Array(bytes);
}

const CMD = {
  INIT:      [ESC, 0x40],
  ALIGN_L:   [ESC, 0x61, 0x00],
  ALIGN_C:   [ESC, 0x61, 0x01],
  ALIGN_R:   [ESC, 0x61, 0x02],
  BOLD_ON:   [ESC, 0x45, 0x01],
  BOLD_OFF:  [ESC, 0x45, 0x00],
  DOUBLE_ON: [GS,  0x21, 0x11],
  DOUBLE_OFF:[GS,  0x21, 0x00],
  TALL_ON:   [GS,  0x21, 0x10],  // double height only — no width artifacts
  TALL_OFF:  [GS,  0x21, 0x00],
  LF:        [0x0A],
  CUT:       [GS,  0x56, 0x41, 0x03],
  BEEP:      [ESC, 0x42, 0x03, 0x02],
  DRAWER:    [ESC, 0x70, 0x00, 0x19, 0xFA],
};

const BLE_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

// Connect GATT and return the first writable characteristic found.
// Races against a 10-second timeout to avoid blocking the print chain indefinitely.
async function gattGetChar(device) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("BLE connection timeout (10s) — printer out of range?")), 10000)
  );
  const connect = async () => {
    const server = await device.gatt.connect();
    for (const uuid of BLE_SERVICES) {
      try {
        const svc   = await server.getPrimaryService(uuid);
        const chars = await svc.getCharacteristics();
        const char  = chars.find(c => c.properties.writeWithoutResponse || c.properties.write);
        if (char) return char;
      } catch { continue; }
    }
    throw new Error("No writable characteristic found on this device.");
  };
  return Promise.race([connect(), timeout]);
}

const logoCache = new Map(); // url+paperSize → Uint8Array, persists for the session

// Fetch a logo URL and return ESC/POS GS v 0 raster bitmap bytes, centered on paper.
async function logoToEscpos(url, paperSize = "80mm") {
  const cacheKey = url + "|" + paperSize;
  if (logoCache.has(cacheKey)) return logoCache.get(cacheKey);
  const maxW         = paperSize === "58mm" ? 384 : 576;
  const bytesPerLine = maxW / 8;
  try {
    const blob   = await fetch(url).then(r => r.blob());
    const objUrl = URL.createObjectURL(blob);
    return await new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const scale  = Math.min(1, maxW / img.width, 96 / img.height);
        const w      = Math.round(img.width  * scale);
        const h      = Math.round(img.height * scale);
        const wBytes = Math.ceil(w / 8);
        const canvas = document.createElement("canvas");
        canvas.width  = wBytes * 8;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, h);
        ctx.drawImage(img, Math.floor((canvas.width - w) / 2), 0, w, h);
        const px      = ctx.getImageData(0, 0, canvas.width, h).data;
        const padLeft = Math.max(0, Math.floor((bytesPerLine - wBytes) / 2));
        const bmp     = new Uint8Array(bytesPerLine * h);
        for (let y = 0; y < h; y++) {
          for (let bx = 0; bx < wBytes && (padLeft + bx) < bytesPerLine; bx++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
              const x = bx * 8 + bit;
              const i = (y * canvas.width + x) * 4;
              if (px[i+3] > 128 && (px[i]*0.299 + px[i+1]*0.587 + px[i+2]*0.114) < 128)
                byte |= (0x80 >> bit);
            }
            bmp[y * bytesPerLine + padLeft + bx] = byte;
          }
        }
        const xL = bytesPerLine & 0xFF, xH = (bytesPerLine >> 8) & 0xFF;
        const yL = h & 0xFF,           yH = (h >> 8) & 0xFF;
        const out = new Uint8Array(8 + bmp.length);
        out[0]=0x1D; out[1]=0x76; out[2]=0x30; out[3]=0x00;
        out[4]=xL;   out[5]=xH;   out[6]=yL;   out[7]=yH;
        out.set(bmp, 8);
        logoCache.set(cacheKey, out);
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(new Uint8Array(0)); };
      img.src = objUrl;
    });
  } catch { return new Uint8Array(0); }
}

function line(left, right, width = 42) {
  const r = String(right ?? "");
  const l = String(left ?? "").slice(0, width - r.length);
  return l.padEnd(width - r.length, " ") + r;
}
function divider(char = "-", width = 42) { return char.repeat(width); }

export function prefetchLogo(url, paperSize = "80mm") {
  if (url) logoToEscpos(url, paperSize).catch(() => {});
}

export function buildReceiptData({ order, outlet, tax, service, logoBytes, paperSize = "80mm" }) {
  const fmt = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
  const w   = paperSize === "58mm" ? 32 : 42;
  const EQ  = "=".repeat(w);
  const HR  = "-".repeat(w);
  const L   = (left, right) => line(left, right, w);
  const lines = [];

  // toggles — default ON if not explicitly false
  const showOrderId  = outlet?.showOrderId  !== false;
  const showTable    = outlet?.showTable    !== false;
  const showCashier  = outlet?.showCashier  !== false;
  const showDatetime = outlet?.showDatetime !== false;
  const showTax      = outlet?.showTax      !== false;
  const showService  = outlet?.showService  !== false;
  const showLoyalty  = outlet?.showLoyalty  !== false;
  const showSku      = outlet?.showSku      === true;

  // ── Header ──────────────────────────────────────────
  lines.push({ cmd: "ALIGN_C" });
  if (logoBytes?.length > 0) {
    lines.push({ raw: logoBytes });
    // no extra \n — keep gap tight
  }
  const outletName = outlet?.name || "PawonLoka";
  lines.push({ cmd: "BOLD_ON" });
  lines.push({ text: outletName + "\n" });
  lines.push({ cmd: "BOLD_OFF" });
  if (outlet?.address) lines.push({ text: outlet.address + "\n" });
  if (outlet?.phone)   lines.push({ text: outlet.phone  + "\n" });
  if (outlet?.website) lines.push({ text: outlet.website + "\n" });
  if (outlet?.tagline) lines.push({ text: outlet.tagline + "\n" });
  lines.push({ text: EQ + "\n" });

  // ── Order info ──────────────────────────────────────
  const orderId  = (order.code || order.id || "-").slice(-Math.max(w - 9, 12));
  const waktu    = order.created_at
    ? new Date(order.created_at).toLocaleString("id-ID", { dateStyle:"short", timeStyle:"short" })
    : "-";
  lines.push({ cmd: "ALIGN_L" });
  if (showOrderId)  lines.push({ text: "Order : " + orderId + "\n" });
  if (showTable)    lines.push({ text: "Meja  : " + (order.table  || "Walk-in") + "\n" });
  if (showCashier)  lines.push({ text: "Kasir : " + (order.cashier || "-") + "\n" });
  if (showDatetime) lines.push({ text: "Waktu : " + waktu + "\n" });
  lines.push({ text: HR + "\n" });

  // ── Items ───────────────────────────────────────────
  for (const item of (order.items || [])) {
    lines.push({ cmd: "BOLD_ON" });
    lines.push({ text: item.name + "\n" });
    lines.push({ cmd: "BOLD_OFF" });
    if (showSku && item.sku) lines.push({ text: "  SKU: " + item.sku + "\n" });
    if (item.modifiers && Object.values(item.modifiers).length)
      lines.push({ text: "  [" + Object.values(item.modifiers).join(", ") + "]\n" });
    lines.push({ text: L("  " + item.qty + " x " + fmt(item.price), fmt(item.qty * item.price)) + "\n" });
    if (item.note) lines.push({ text: "  * " + item.note + "\n" });
    const itemDiscAmt = item.itemDisc || item.discount || 0;
    if (itemDiscAmt > 0) lines.push({ text: L("  Diskon", "-" + fmt(itemDiscAmt * item.qty)) + "\n" });
  }

  // ── Totals ──────────────────────────────────────────
  lines.push({ text: HR + "\n" });
  const subtotal = (order.items || []).reduce((s, i) => s + (i.qty * i.price) - (i.qty * (i.itemDisc || i.discount || 0)), 0);
  const taxAmt   = tax?.enabled     ? Math.round(subtotal * (tax.rate / 100))     : 0;
  const svcAmt   = service?.enabled ? Math.round(subtotal * (service.rate / 100)) : 0;
  const total    = subtotal + taxAmt + svcAmt - (order.discount || 0);
  lines.push({ text: L("Subtotal", fmt(subtotal)) + "\n" });
  if (taxAmt && showTax)     lines.push({ text: L((tax.label || "PPN") + " " + tax.rate + "%", fmt(taxAmt)) + "\n" });
  if (svcAmt && showService) lines.push({ text: L("Service " + service.rate + "%", fmt(svcAmt)) + "\n" });
  if (order.discount)        lines.push({ text: L("Diskon", "-" + fmt(order.discount)) + "\n" });
  lines.push({ text: EQ + "\n" });
  lines.push({ cmd: "BOLD_ON" });
  lines.push({ text: L("TOTAL", fmt(total)) + "\n" });
  lines.push({ cmd: "BOLD_OFF" });
  lines.push({ text: EQ + "\n" });

  // ── Points earned ────────────────────────────────────
  if (showLoyalty && total > 0) {
    const pts = Math.floor(total / 100);
    if (pts > 0) lines.push({ text: L("Points earned", "+" + pts + " pts") + "\n" });
  }

  // ── Payment ─────────────────────────────────────────
  for (const pay of (order.payments || [])) {
    lines.push({ text: L(pay.method, fmt(pay.amount)) + "\n" });
  }
  if (order.change > 0) lines.push({ text: L("Kembali", fmt(order.change)) + "\n" });
  if ((order.payments || []).length > 0 || order.change > 0)
    lines.push({ text: HR + "\n" });

  // ── Footer ──────────────────────────────────────────
  lines.push({ cmd: "ALIGN_C" });
  lines.push({ text: (outlet?.thankYou || "Terima kasih!") + "\n" });
  if (outlet?.wifi)          lines.push({ text: "WiFi: " + outlet.wifi + "\n" });
  if (outlet?.promo)         lines.push({ text: outlet.promo + "\n" });
  if (outlet?.social)        lines.push({ text: outlet.social + "\n" });
  if (outlet?.custom_line_1) lines.push({ text: outlet.custom_line_1 + "\n" });
  if (outlet?.custom_line_2) lines.push({ text: outlet.custom_line_2 + "\n" });
  lines.push({ text: "\n\n" });
  lines.push({ cmd: "CUT" });
  return lines;
}

export function buildKitchenData({ ticket, paperSize }) {
  const w  = paperSize === "80mm" ? 42 : 32;
  const EQ = "=".repeat(w);
  const HR = "-".repeat(w);
  const lines = [];
  lines.push({ text: EQ + "\n" });
  lines.push({ cmd: "ALIGN_C" }, { cmd: "BOLD_ON" }, { cmd: "TALL_ON" });
  lines.push({ text: (ticket.stationName || "KITCHEN") + "\n" });
  lines.push({ cmd: "TALL_OFF" }, { cmd: "BOLD_OFF" });
  lines.push({ text: EQ + "\n" });
  const tableLabel = ticket.table && ticket.table !== ticket.orderType ? ticket.table : (ticket.orderType || "-");
  lines.push({ text: "Meja: " + tableLabel + "\n" });
  lines.push({ text: new Date().toLocaleTimeString("id-ID") + "\n" });
  lines.push({ text: HR + "\n" });
  lines.push({ cmd: "ALIGN_L" });
  for (const item of ticket.items) {
    const parts = (typeof item === "string" ? item : "").split("\n");
    lines.push({ cmd: "BOLD_ON" });
    lines.push({ text: parts[0] + "\n" });
    lines.push({ cmd: "BOLD_OFF" });
    for (let i = 1; i < parts.length; i++) {
      lines.push({ text: parts[i] + "\n" });
    }
  }
  lines.push({ text: EQ + "\n" });
  lines.push({ text: "\n\n" }, { cmd: "CUT" });
  return lines;
}

export function buildShiftReport({ shift, report, paperSize = "80mm" }) {
  const fmt = n => "Rp " + Number(n || 0).toLocaleString("id-ID")
  const w   = paperSize === "58mm" ? 32 : 42
  const EQ  = "=".repeat(w)
  const HR  = "-".repeat(w)
  const L   = (left, right) => {
    const gap = w - left.length - right.length
    return left + " ".repeat(Math.max(1, gap)) + right
  }
  const lines = []
  const now = new Date()
  const dateStr = now.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" })
  const timeStr = now.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" })

  lines.push({ cmd: "ALIGN_C" })
  lines.push({ cmd: "BOLD_ON" })
  lines.push({ text: "LAPORAN SHIFT\n" })
  lines.push({ cmd: "BOLD_OFF" })
  lines.push({ text: EQ + "\n" })
  lines.push({ cmd: "ALIGN_L" })
  lines.push({ text: "Kasir   : " + (shift.staff || "-") + "\n" })
  lines.push({ text: "Tanggal : " + (shift.date || dateStr) + "\n" })
  lines.push({ text: "Buka    : " + (shift.clock_in || "-") + "\n" })
  lines.push({ text: "Tutup   : " + timeStr + "\n" })
  lines.push({ text: EQ + "\n" })

  if (report) {
    lines.push({ cmd: "BOLD_ON" })
    lines.push({ text: "RINGKASAN PENJUALAN\n" })
    lines.push({ cmd: "BOLD_OFF" })
    lines.push({ text: L("Total Order", String(report.orderCount || 0)) + "\n" })
    Object.entries(report.sales || {}).forEach(([pay, amt]) => {
      lines.push({ text: L("  " + pay, fmt(amt)) + "\n" })
    })
    lines.push({ text: HR + "\n" })
    lines.push({ cmd: "BOLD_ON" })
    lines.push({ text: L("Total Penjualan", fmt(report.totalSales || 0)) + "\n" })
    lines.push({ cmd: "BOLD_OFF" })
    lines.push({ text: EQ + "\n" })

    lines.push({ cmd: "BOLD_ON" })
    lines.push({ text: "ARUS KAS\n" })
    lines.push({ cmd: "BOLD_OFF" })
    lines.push({ text: L("Modal Awal", fmt(shift.float_open || 0)) + "\n" })
    lines.push({ text: L("+ Cash Penjualan", fmt(report.cashSales || 0)) + "\n" })
    if (report.topups > 0)    lines.push({ text: L("+ Top-up Float", fmt(report.topups)) + "\n" })
    if (report.expenses > 0)  lines.push({ text: L("- Pengeluaran", fmt(report.expenses)) + "\n" })
    if (report.returns > 0)   lines.push({ text: L("+ Kembalian Belanja", fmt(report.returns)) + "\n" })
    lines.push({ text: HR + "\n" })
    lines.push({ cmd: "BOLD_ON" })
    lines.push({ text: L("Ekspektasi Kas", fmt(report.expectedCash || 0)) + "\n" })
    lines.push({ cmd: "BOLD_OFF" })
    lines.push({ text: EQ + "\n" })
  }

  lines.push({ cmd: "ALIGN_C" })
  lines.push({ text: "Dicetak: " + dateStr + " " + timeStr + "\n" })
  lines.push({ text: "\n\n" })
  lines.push({ cmd: "CUT" })
  return lines
}

export function renderToBytes(lines) {
  const chunks = [escpos([CMD.INIT])];
  for (const l of lines) {
    if (l.cmd && CMD[l.cmd])   chunks.push(escpos([CMD[l.cmd]]));
    else if (l.raw)            chunks.push(l.raw);
    else if (l.text)           chunks.push(escpos([l.text]));
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

export function usePrinter() {
  const [printers,  setPrinters]  = useState([]);
  const [scanning,  setScanning]  = useState(false);
  const [loading,   setLoading]   = useState(true);
  const deviceRefs  = useRef({});
  const charRefs    = useRef({});
  const printerChains        = useRef({});                 // per-printer queue — all printers print concurrently
  const listenersAdded       = useRef(new Set());          // prevent duplicate gattserverdisconnected listeners
  const reconnectTimers      = useRef({});                 // per-printer reconnect timeout handles
  const intentionalDisconnects = useRef(new Set());        // skip auto-reconnect after post-print disconnect

  // Load printers from Supabase on mount
  useEffect(() => {
    loadPrinters();
  }, []);

  async function loadPrinters() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("hardware_devices")
        .select("*")
        .eq("type", "receipt_printer")
        .order("created_at");
      const { data: kitchen } = await supabase
        .from("hardware_devices")
        .select("*")
        .eq("type", "kitchen_printer")
        .order("created_at");
      const all = [...(data||[]), ...(kitchen||[])].map(d => ({
        id:        d.id,
        name:      d.name,
        deviceId:  d.mac || d.deviceId || "",
        role:      d.role || (d.type === "receipt_printer" ? "receipt" : "kitchen1"),
        paperSize: d.paper?.includes("58") ? "58mm" : "80mm",
        connected: false,
        type:      d.type,
      }));
      setPrinters(all);
      // Connect all previously-paired printers and attach persistent reconnect listeners.
      autoConnectAll(all);
    } finally { setLoading(false); }
  }

  // Attach gattserverdisconnected handler exactly once per printer.
  // On disconnect: marks printer offline and retries with exponential backoff.
  function attachAutoReconnect(printerId, device) {
    if (listenersAdded.current.has(printerId)) return;
    listenersAdded.current.add(printerId);
    let retries = 0;
    const tryReconnect = async () => {
      if (!deviceRefs.current[printerId]) return; // printer was removed
      try {
        const char = await gattGetChar(device);
        charRefs.current[printerId] = char;
        setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: true } : p));
        retries = 0;
      } catch {
        // Keep retrying indefinitely — printer will reconnect whenever it comes back online
        retries++;
        reconnectTimers.current[printerId] = setTimeout(tryReconnect, Math.min(3000 * retries, 30000));
      }
    };
    device.addEventListener("gattserverdisconnected", () => {
      delete charRefs.current[printerId];
      // If we disconnected on purpose (post-print), don't auto-reconnect
      if (intentionalDisconnects.current.has(printerId)) {
        intentionalDisconnects.current.delete(printerId);
        setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: false } : p));
        return;
      }
      setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: false } : p));
      retries = 0;
      clearTimeout(reconnectTimers.current[printerId]);
      reconnectTimers.current[printerId] = setTimeout(tryReconnect, 3000);
    });
  }

  // Auto-connect all stored printers silently on startup using getDevices().
  // getDevices() returns previously-permitted devices with no user dialog (Chrome 85+).
  async function autoConnectAll(loadedPrinters) {
    if (!navigator.bluetooth?.getDevices) return;
    let permitted;
    try { permitted = await navigator.bluetooth.getDevices(); } catch { return; }
    for (const printer of loadedPrinters) {
      if (!printer.deviceId) continue;
      const device = permitted.find(d => d.id === printer.deviceId);
      if (!device) continue;
      deviceRefs.current[printer.id] = device;
      attachAutoReconnect(printer.id, device);
      gattGetChar(device)
        .then(char => {
          charRefs.current[printer.id] = char;
          setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, connected: true } : p));
        })
        .catch(() => {}); // silent — device may be out of range, auto-reconnects when back
    }
  }

  // Populate deviceRefs from previously-permitted BLE devices (no user gesture needed).
  // Must run before any batch print so connect() skips requestDevice() entirely.
  async function warmDeviceRefs(loadedPrinters) {
    if (!navigator.bluetooth?.getDevices) return;
    try {
      const permitted = await navigator.bluetooth.getDevices();
      for (const printer of loadedPrinters) {
        if (!printer.deviceId || deviceRefs.current[printer.id]) continue;
        const device = permitted.find(d => d.id === printer.deviceId);
        if (device) {
          deviceRefs.current[printer.id] = device;
          console.log("[BLE] warm deviceRef:", printer.name || printer.id);
        } else {
          console.warn("[BLE] not in getDevices():", printer.name || printer.id, printer.deviceId);
        }
      }
    } catch (e) {
      console.warn("[BLE] warmDeviceRefs failed:", e.message);
    }
  }

  async function savePrinterToDb(printer) {
    const payload = {
      name:  printer.name,
      type:  printer.role === "receipt" ? "receipt_printer" : "kitchen_printer",
      mac:   printer.deviceId || "",
      paper: printer.paperSize === "58mm" ? "58mm" : "80mm (standard)",
      role:  printer.role,
    };
    const { data: existing } = await supabase
      .from("hardware_devices").select("id").eq("id", printer.id).maybeSingle();
    if (existing) {
      await supabase.from("hardware_devices").update(payload).eq("id", printer.id);
    } else {
      await supabase.from("hardware_devices").insert({ id: printer.id, ...payload });
    }
  }

  const refresh = useCallback((next) => {
    setPrinters(next);
    // Save each printer to DB
    next.forEach(p => savePrinterToDb(p).catch(() => {}));
  }, []);

  const scanAndPair = useCallback(async (role = "receipt") => {
    if (!navigator.bluetooth) throw new Error("Web Bluetooth not supported. Use Chrome on Android or desktop.");
    setScanning(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ["000018f0-0000-1000-8000-00805f9b34fb"] },
          { namePrefix: "VSC" }, { namePrefix: "H-58" },
          { namePrefix: "Epson" }, { namePrefix: "Star" },
          { namePrefix: "MUNBYN" }, { namePrefix: "Rongta" },
          { namePrefix: "RPP" }, { namePrefix: "MTP" },
          { namePrefix: "PT" }, { namePrefix: "Sewoo" },
        ],
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb",
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
          "49535343-fe7d-4ae5-8fa9-9fafd205e455",
        ],
      });
      const existing = printers.find(p => p.deviceId === device.id);
      const np = {
        id:        existing?.id || crypto.randomUUID(),
        name:      device.name || "Unknown Printer",
        deviceId:  device.id,
        role,
        paperSize: /58/i.test(device.name || "") ? "58mm" : "80mm",
        connected: false,
        type:      role === "receipt" ? "receipt_printer" : "kitchen_printer",
      };
      deviceRefs.current[np.id] = device;
      const next = existing
        ? printers.map(p => p.id === existing.id ? { ...p, name: device.name || p.name } : p)
        : [...printers, np];
      await savePrinterToDb(np);
      setPrinters(next);
      // Immediately connect after pairing — no second tap needed
      attachAutoReconnect(np.id, device);
      gattGetChar(device)
        .then(char => {
          charRefs.current[np.id] = char;
          setPrinters(prev => prev.map(p => p.id === np.id ? { ...p, connected: true } : p));
        })
        .catch(() => {});
      return np;
    } finally { setScanning(false); }
  }, [printers]);

  const connect = useCallback(async (printerId) => {
    const printer = printers.find(p => p.id === printerId);
    if (!printer) throw new Error("Printer not found");
    let device = deviceRefs.current[printerId];
    if (!device) {
      // Try previously-permitted devices first (no dialog)
      if (navigator.bluetooth?.getDevices) {
        try {
          const devs = await navigator.bluetooth.getDevices();
          device = devs.find(d => d.id === printer.deviceId);
        } catch { device = null; }
      }
      if (!device) {
        // Do NOT call requestDevice() here — it shows a blocking dialog that freezes the print chain.
        // requestDevice() is only for scanAndPair (explicit user action in settings).
        throw new Error("Printer '" + (printer.name || printerId) + "' belum di-pair di perangkat ini. Buka Pengaturan > Hardware > Add Printer.");
      }
      deviceRefs.current[printerId] = device;
    }
    const char = await gattGetChar(device);
    charRefs.current[printerId] = char;
    attachAutoReconnect(printerId, device);
    setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: true } : p));
    return char;
  }, [printers]);

  const disconnect = useCallback(async (printerId) => {
    clearTimeout(reconnectTimers.current[printerId]);
    delete reconnectTimers.current[printerId];
    listenersAdded.current.delete(printerId); // allow re-attach on next pair
    const device = deviceRefs.current[printerId];
    if (device?.gatt?.connected) device.gatt.disconnect();
    delete charRefs.current[printerId];
    delete deviceRefs.current[printerId];
    setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: false } : p));
  }, []);

  const removePrinter = useCallback(async (id) => {
    disconnect(id);
    await supabase.from("hardware_devices").delete().eq("id", id);
    setPrinters(prev => prev.filter(p => p.id !== id));
  }, [disconnect]);

  const updatePrinter = useCallback(async (id, changes) => {
    setPrinters(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...changes } : p);
      const updated = next.find(p => p.id === id);
      if (updated) savePrinterToDb(updated).catch(() => {});
      return next;
    });
  }, []);

  const printBytes = useCallback((printerId, bytes) => {
    if (!printerChains.current[printerId]) printerChains.current[printerId] = Promise.resolve();
    const job = printerChains.current[printerId].then(async () => {
      // Always fresh-connect: ensures only ONE GATT connection is active at a time.
      // Android limits simultaneous GATT connections to 3-4; with 4 printers a cached
      // multi-connection model causes the 3rd/4th printer to silently fail.
      const char = await connect(printerId);
      const CHUNK = 20; // H-58BT ATT payload max
      // No fixed delay — writeValueWithoutResponse resolves when data is queued locally,
      // not when the printer receives it. The BLE stack handles over-air pacing.
      // Only back off when the stack signals congestion (caught exception).
      async function writeBytes(c) {
        for (let i = 0; i < bytes.length; i += CHUNK) {
          const chunk = bytes.slice(i, i + CHUNK);
          for (let attempt = 0; ; attempt++) {
            try {
              if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(chunk);
              else await c.writeValue(chunk);
              break;
            } catch {
              if (attempt >= 4) throw new Error("BLE write congestion — printer not responding");
              await new Promise(r => setTimeout(r, 10 * (attempt + 1)));
            }
          }
        }
      }
      try {
        await writeBytes(char);
      } catch(e) {
        console.warn("Print failed, reconnecting...", e.message);
        const char2 = await connect(printerId);
        await writeBytes(char2);
      } finally {
        // Release GATT slot immediately so next printer can connect
        intentionalDisconnects.current.add(printerId);
        const device = deviceRefs.current[printerId];
        if (device?.gatt?.connected) device.gatt.disconnect();
        delete charRefs.current[printerId];
        await new Promise(r => setTimeout(r, 50));
      }
    });
    // keep this printer's chain alive even if this job errors
    printerChains.current[printerId] = job.catch(() => {});
    return job;
  }, [connect]);

  const printReceipt = useCallback(async (order, { outlet, tax, service } = {}) => {
    const printer = printers.find(p => p.role === "receipt");
    if (!printer) throw new Error("No receipt printer configured");
    const logoBytes = outlet?.logo
      ? await logoToEscpos(outlet.logo, printer.paperSize).catch(() => null)
      : null;
    await printBytes(printer.id, renderToBytes(buildReceiptData({ order, outlet, tax, service, logoBytes, paperSize: printer.paperSize })));
  }, [printers, printBytes]);

  const printKitchenTicket = useCallback(async (ticket) => {
    const role = ticket.stationRole || "kitchen1";
    const printer = printers.find(p => p.role === role)
                 || printers.find(p => p.role === "kitchen1" || p.role === "kitchen2" || p.role === "bar");
    if (!printer) throw new Error("No kitchen printer configured for " + (ticket.stationName || role) + ". Check Hardware settings.");
    await printBytes(printer.id, renderToBytes(buildKitchenData({ ticket, paperSize: printer.paperSize })));
  }, [printers, printBytes]);

  const testPrint = useCallback(async (printerId) => {
    const lines = [
      { cmd: "ALIGN_C" }, { cmd: "BOLD_ON" }, { cmd: "TALL_ON" },
      { text: "PawonLoka POS\n" },
      { cmd: "TALL_OFF" }, { cmd: "BOLD_OFF" },
      { text: "Test Print\n" },
      { text: new Date().toLocaleString("id-ID") + "\n" },
      { text: "-------------------------------\n" },
      { text: "Printer OK!\n" },
      { text: "\n\n\n" }, { cmd: "CUT" },
    ];
    await printBytes(printerId, renderToBytes(lines));
  }, [printBytes]);

  return {
    printers, scanning, loading,
    scanAndPair, connect, disconnect, removePrinter, updatePrinter,
    printReceipt, printKitchenTicket, testPrint,
    printBytes, renderLines: renderToBytes,
    reloadPrinters: loadPrinters,
  };
}
