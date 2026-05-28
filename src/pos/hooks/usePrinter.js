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
  LF:        [0x0A],
  CUT:       [GS,  0x56, 0x41, 0x03],
  BEEP:      [ESC, 0x42, 0x03, 0x02],
  DRAWER:    [ESC, 0x70, 0x00, 0x19, 0xFA],
};

function line(left, right, width = 42) {
  const r = String(right ?? "");
  const l = String(left ?? "").slice(0, width - r.length);
  return l.padEnd(width - r.length, " ") + r;
}
function divider(char = "-", width = 42) { return char.repeat(width); }

export function buildReceiptData({ order, outlet, tax, service }) {
  const fmt = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
  const w = 42;
  const lines = [];
  lines.push({ cmd: "ALIGN_C" }, { cmd: "BOLD_ON" }, { cmd: "DOUBLE_ON" });
  lines.push({ text: (outlet?.name || "PawonLoka") + "\n" });
  lines.push({ cmd: "DOUBLE_OFF" }, { cmd: "BOLD_OFF" });
  if (outlet?.address) lines.push({ text: outlet.address + "\n" });
  if (outlet?.phone)   lines.push({ text: outlet.phone + "\n" });
  lines.push({ text: divider() + "\n" });
  lines.push({ cmd: "ALIGN_L" });
  lines.push({ text: "Order : " + (order.code || order.id) + "\n" });
  lines.push({ text: "Meja  : " + (order.table || "Walk-in") + "\n" });
  lines.push({ text: "Kasir : " + (order.cashier || "-") + "\n" });
  lines.push({ text: "Waktu : " + new Date(order.created_at).toLocaleString("id-ID") + "\n" });
  lines.push({ text: divider() + "\n" });
  for (const item of (order.items || [])) {
    lines.push({ cmd: "BOLD_ON" });
    lines.push({ text: item.name + "\n" });
    lines.push({ cmd: "BOLD_OFF" });
    lines.push({ text: line("  " + item.qty + " x " + fmt(item.price), fmt(item.qty * item.price), w) + "\n" });
    if (item.note)     lines.push({ text: "  * " + item.note + "\n" });
    if (item.discount) lines.push({ text: line("  Diskon", "-" + fmt(item.discount), w) + "\n" });
  }
  lines.push({ text: divider() + "\n" });
  const subtotal = (order.items || []).reduce((s, i) => s + (i.qty * i.price) - (i.discount || 0), 0);
  const taxAmt   = tax?.enabled     ? Math.round(subtotal * (tax.rate / 100))     : 0;
  const svcAmt   = service?.enabled ? Math.round(subtotal * (service.rate / 100)) : 0;
  const total    = subtotal + taxAmt + svcAmt - (order.discount || 0);
  lines.push({ text: line("Subtotal", fmt(subtotal), w) + "\n" });
  if (taxAmt) lines.push({ text: line((tax.label || "PPN") + " " + tax.rate + "%", fmt(taxAmt), w) + "\n" });
  if (svcAmt) lines.push({ text: line("Service " + service.rate + "%", fmt(svcAmt), w) + "\n" });
  if (order.discount) lines.push({ text: line("Diskon", "-" + fmt(order.discount), w) + "\n" });
  lines.push({ cmd: "BOLD_ON" });
  lines.push({ text: line("TOTAL", fmt(total), w) + "\n" });
  lines.push({ cmd: "BOLD_OFF" });
  lines.push({ text: divider() + "\n" });
  for (const pay of (order.payments || [])) {
    lines.push({ text: line(pay.method, fmt(pay.amount), w) + "\n" });
  }
  if (order.change > 0) lines.push({ text: line("Kembali", fmt(order.change), w) + "\n" });
  lines.push({ text: divider() + "\n" });
  lines.push({ cmd: "ALIGN_C" });
  lines.push({ text: (outlet?.thankYou || "Terima kasih!") + "\n" });
  if (outlet?.wifi) lines.push({ text: "WiFi: " + outlet.wifi + "\n" });
  lines.push({ text: "\n\n\n" });
  lines.push({ cmd: "CUT" });
  return lines;
}

export function buildKitchenData({ ticket, paperSize }) {
  const w = paperSize === "80mm" ? 42 : 32;
  const lines = [];
  lines.push({ cmd: "ALIGN_C" }, { cmd: "BOLD_ON" }, { cmd: "DOUBLE_ON" });
  lines.push({ text: "*** " + (ticket.stationName || "KITCHEN") + " ***\n" });
  lines.push({ cmd: "DOUBLE_OFF" }, { cmd: "BOLD_OFF" });
  lines.push({ text: "Meja: " + ticket.table + "  |  " + ticket.orderType + "\n" });
  lines.push({ text: new Date().toLocaleTimeString("id-ID") + "\n" });
  lines.push({ text: "=".repeat(w) + "\n" });
  lines.push({ cmd: "ALIGN_L" });
  for (const item of ticket.items) {
    lines.push({ cmd: "BOLD_ON" });
    lines.push({ text: item + "\n" });
    lines.push({ cmd: "BOLD_OFF" });
  }
  lines.push({ text: "=".repeat(w) + "\n" });
  lines.push({ text: "\n\n\n" }, { cmd: "CUT" });
  return lines;
}

export function renderToBytes(lines) {
  const chunks = [escpos([CMD.INIT])];
  for (const l of lines) {
    if (l.cmd && CMD[l.cmd])   chunks.push(escpos([CMD[l.cmd]]));
    else if (l.text)           chunks.push(escpos([l.text]));
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// Module-level refs survive re-renders and Realtime subscriptions
const _deviceRefs = {}
const _charRefs   = {}

export function usePrinter() {
  const [printers,  setPrinters]  = useState([]);
  const [scanning,  setScanning]  = useState(false);
  const [loading,   setLoading]   = useState(true);

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
      // Also load kitchen printers
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
    } finally { setLoading(false); }
  }

  async function savePrinterToDb(printer) {
    await supabase.from("hardware_devices").upsert({
      id:         printer.id,
      name:       printer.name,
      type:       printer.role === "receipt" ? "receipt_printer" : "kitchen_printer",
      connection: "Bluetooth",
      mac:        printer.deviceId || "",
      role:       printer.role,
      paper:      printer.paperSize === "58mm" ? "58mm" : "80mm (standard)",
      deviceId:   printer.deviceId || "",
    }, { onConflict: "id" });
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
        id:        existing?.id || ("DEV-" + Date.now()),
        name:      device.name || "Unknown Printer",
        deviceId:  device.id,
        role,
        paperSize: "80mm",
        connected: false,
        type:      role === "receipt" ? "receipt_printer" : "kitchen_printer",
      };
      _deviceRefs[np.id] = device;
      const next = existing
        ? printers.map(p => p.id === existing.id ? { ...p, name: device.name || p.name } : p)
        : [...printers, np];
      // Save to DB immediately on pair
      await savePrinterToDb(np);
      setPrinters(next);
      return np;
    } finally { setScanning(false); }
  }, [printers]);

  const connect = useCallback(async (printerId) => {
    const printer = printers.find(p => p.id === printerId);
    if (!printer) throw new Error("Printer not found");
    let device = _deviceRefs[printerId];
    if (!device) {
      // Android Chrome does not support getDevices() — must re-pair
      if (navigator.bluetooth?.getDevices) {
        try {
          const devs = await navigator.bluetooth.getDevices();
          device = devs.find(d => d.id === printer.deviceId);
        } catch(e) { device = null; }
      }
      if (!device) {
        // Re-pair via requestDevice
        try {
          device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
              "000018f0-0000-1000-8000-00805f9b34fb",
              "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
              "49535343-fe7d-4ae5-8fa9-9fafd205e455",
            ],
          });
        } catch(e) { throw new Error("Could not find printer. Please select it from the list."); }
      }
      _deviceRefs[printerId] = device;
    }
    const server = await device.gatt.connect();
    let characteristic;
    const uuids = [
      "000018f0-0000-1000-8000-00805f9b34fb",
      "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
      "49535343-fe7d-4ae5-8fa9-9fafd205e455",
    ];
    for (const uuid of uuids) {
      try {
        const svc  = await server.getPrimaryService(uuid);
        const chars = await svc.getCharacteristics();
        characteristic = chars.find(c => c.properties.writeWithoutResponse || c.properties.write);
        if (characteristic) break;
      } catch { continue; }
    }
    if (!characteristic) throw new Error("No writable characteristic found.");
    _charRefs[printerId] = characteristic;
    device.addEventListener("gattserverdisconnected", () => {
      setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: false } : p));
      delete _charRefs[printerId];
    });
    setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: true } : p));
    return characteristic;
  }, [printers]);

  const disconnect = useCallback(async (printerId) => {
    const device = _deviceRefs[printerId];
    if (device?.gatt?.connected) device.gatt.disconnect();
    delete _charRefs[printerId];
    delete _deviceRefs[printerId];
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

  const printBytes = useCallback(async (printerId, bytes) => {
    let char = _charRefs[printerId];
    if (!char) char = await connect(printerId);
    const CHUNK = 512;
    async function writeBytes(c) {
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const chunk = bytes.slice(i, i + CHUNK);
        if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(chunk);
        else await c.writeValue(chunk);
        await new Promise(r => setTimeout(r, 50));
      }
    }
    try {
      await writeBytes(char);
    } catch(e) {
      // GATT disconnected — reconnect and retry once
      console.warn("Print failed, reconnecting...", e.message);
      delete _charRefs[printerId];
      char = await connect(printerId);
      await writeBytes(char);
    }
  }, [connect]);

  const printReceipt = useCallback(async (order, { outlet, tax, service } = {}) => {
    const printer = printers.find(p => p.role === "receipt" && p.connected);
    if (!printer) throw new Error("No receipt printer connected");
    // Verify GATT still connected, reconnect if needed
    const device = _deviceRefs[printer.id];
    if (device && !device.gatt?.connected) {
      console.warn("GATT dropped, reconnecting...");
      delete _charRefs[printer.id];
      await connect(printer.id).catch(() => {});
    }
    await printBytes(printer.id, renderToBytes(buildReceiptData({ order, outlet, tax, service })));
  }, [printers, printBytes, connect]);

  const printKitchenTicket = useCallback(async (ticket) => {
    const role = ticket.stationRole || "kitchen1";
    const printer = printers.find(p => p.role === role && p.connected)
                 || printers.find(p => (p.role === "kitchen1" || p.role === "kitchen2" || p.role === "bar") && p.connected);
    if (!printer) throw new Error("No kitchen printer connected for " + role);
    await printBytes(printer.id, renderToBytes(buildKitchenData({ ticket, paperSize: printer.paperSize })));
  }, [printers, printBytes]);

  const testPrint = useCallback(async (printerId) => {
    const lines = [
      { cmd: "ALIGN_C" }, { cmd: "BOLD_ON" }, { cmd: "DOUBLE_ON" },
      { text: "PawonLoka POS\n" },
      { cmd: "DOUBLE_OFF" }, { cmd: "BOLD_OFF" },
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
