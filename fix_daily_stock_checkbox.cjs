const fs = require('fs');

const path = 'src/pos/components/DailyStockModal.jsx';
let content = fs.readFileSync(path, 'utf8');

const replacement = `              {/* Notes */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Catatan Kasir (Opsional):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Contoh: Sate kambing sisa 119 di chiller bawah, 5 sate rusak saat ditusuk..."
                  style={styles.notesInput}
                />
              </div>

              {/* Online Warning Checkbox */}
              <div style={{ 
                marginBottom: 12, 
                padding: '12px 16px', 
                background: '#FEF3C7', 
                border: '1px solid #F59E0B', 
                borderRadius: 8,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                cursor: 'pointer'
              }}
              onClick={() => setOnlineWarningChecked(!onlineWarningChecked)}>
                <input 
                  type="checkbox" 
                  checked={onlineWarningChecked}
                  onChange={(e) => {
                    e.stopPropagation();
                    setOnlineWarningChecked(e.target.checked);
                  }}
                  style={{ marginTop: 2, transform: 'scale(1.3)' }}
                />
                <div>
                  <div style={{ fontWeight: 800, color: '#92400E', fontSize: 13.5 }}>⚠️ Penting!</div>
                  <div style={{ color: '#B45309', fontSize: 12.5, marginTop: 4, lineHeight: '1.4' }}>
                    Saya konfirmasi bahwa semua pesanan online (GoFood, dll) hari ini sudah diinput ke dalam POS sebelum menyimpan hitungan stok.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>`;

content = content.replace(
/              \{\/\* Notes \*\/\}\n              <div style=\{\{ marginBottom: 12 \}\}>\n                <label style=\{\{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 \}\}>\n                  Catatan Kasir \(Opsional\):\n                <\/label>\n                <input\n                  type="text"\n                  value=\{notes\}\n                  onChange=\{e => setNotes\(e\.target\.value\)\}\n                  placeholder="Contoh: Sate kambing sisa 119 di chiller bawah, 5 sate rusak saat ditusuk\.\.\."\n                  style=\{styles\.notesInput\}\n                \/>\n              <\/div>\n            <\/>\n          \)\}\n        <\/div>/g, 
replacement);

fs.writeFileSync(path, content, 'utf8');
console.log("Checkbox restored!");
