// export-wo.js
// Batch-convert Work Order .xlsb files to JSON for website import.
// Usage:  node export-wo.js [--input=./input] [--output=./output]

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ---------- CLI args ----------
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);
const INPUT_DIR  = path.resolve(args.input  || './input');
const OUTPUT_DIR = path.resolve(args.output || './output');

if (!fs.existsSync(INPUT_DIR)) {
  console.error(`Input folder not found: ${INPUT_DIR}`);
  process.exit(1);
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ---------- helpers ----------
// Read a cell by A1 address from a sheet. Returns formatted value (w) if present,
// otherwise the raw value (v). Returns '' if empty.
function cell(sheet, addr) {
  const c = sheet[addr];
  if (!c) return '';
  if (c.w !== undefined && c.w !== null) return c.w;
  if (c.v !== undefined && c.v !== null) return c.v;
  return '';
}

// Trim strings, leave numbers/dates alone.
function clean(v) {
  if (typeof v === 'string') return v.trim();
  return v;
}

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

// Split an accessory description: first whitespace-delimited token is part_number,
// the rest is description. If no whitespace, whole string is part_number.
function splitAccessory(raw) {
  const s = String(raw).trim();
  if (!s) return { part_number: '', description: '' };
  const idx = s.search(/\s/);
  if (idx === -1) return { part_number: s, description: '' };
  return {
    part_number: s.slice(0, idx),
    description: s.slice(idx + 1).trim(),
  };
}

// ---------- core extractor ----------
function extractWorkOrder(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheet = wb.Sheets['Work Order'];
  if (!sheet) throw new Error(`Sheet 'Work Order' not found in ${path.basename(filePath)}`);

  // ----- Header -----
  const addr1 = cell(sheet, 'N4');
  const addr2 = cell(sheet, 'N5');
  const deliveryAddress = [addr1, addr2].map(clean).filter(v => !isBlank(v)).join(', ');

  const header = {
    so_number:        clean(cell(sheet, 'P11')),
    po_number:        clean(cell(sheet, 'J2')),
    customer:         clean(cell(sheet, 'C1')),
    branch:           clean(cell(sheet, 'I1')),
    contact:          clean(cell(sheet, 'C2')),
    phone:            clean(cell(sheet, 'G2')),
    date_received:    clean(cell(sheet, 'K1')),
    deliver_on:       clean(cell(sheet, 'O1')),
    job_name:         clean(cell(sheet, 'N3')),
    delivery_address: deliveryAddress,
  };

  // ----- Accessories (H5:I9) -----
  const accessories = [];
  for (let r = 5; r <= 9; r++) {
    const qty = cell(sheet, `H${r}`);
    if (isBlank(qty)) continue;
    const { part_number, description } = splitAccessory(cell(sheet, `I${r}`));
    accessories.push({ qty: clean(qty), part_number, description });
  }

  // ----- Lines (rows 14-113) -----
  // Include row only if B, C, D, E, F, G all have values. H (instructions) is optional.
  const lines = [];
  for (let r = 14; r <= 113; r++) {
    const b = cell(sheet, `B${r}`);
    const c = cell(sheet, `C${r}`);
    const d = cell(sheet, `D${r}`);
    const e = cell(sheet, `E${r}`);
    const f = cell(sheet, `F${r}`);
    const g = cell(sheet, `G${r}`);
    if ([b, c, d, e, f, g].some(isBlank)) continue;

    lines.push({
      row:          clean(cell(sheet, `A${r}`)),
      facing:       clean(b),
      roll_qty:     clean(c),
      thickness:    clean(d),
      width:        clean(e),
      length:       clean(f),
      roll_for:     clean(g),
      instructions: clean(cell(sheet, `H${r}`)),
      tab_type:     clean(cell(sheet, `BM${r}`)),
    });
  }

  return { header, accessories, lines };
}

// ---------- batch runner ----------
const files = fs.readdirSync(INPUT_DIR)
  .filter(f => /\.xlsb$/i.test(f) || /\.xlsx$/i.test(f) || /\.xls$/i.test(f));

if (files.length === 0) {
  console.log(`No .xlsb/.xlsx files found in ${INPUT_DIR}`);
  process.exit(0);
}

let ok = 0, fail = 0;
for (const file of files) {
  const srcPath = path.join(INPUT_DIR, file);
  const base = path.basename(file, path.extname(file));
  const outPath = path.join(OUTPUT_DIR, `${base}.json`);
  try {
    const data = extractWorkOrder(srcPath);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✓ ${file} → ${path.basename(outPath)}  (${data.accessories.length} acc, ${data.lines.length} lines)`);
    ok++;
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
    fail++;
  }
}
console.log(`\nDone. ${ok} succeeded, ${fail} failed.`);
