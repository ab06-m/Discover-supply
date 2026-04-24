const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const csvPath = path.join(__dirname, '..', 'Products_20260120_20260420.csv');
const data = fs.readFileSync(csvPath, 'utf8');

const records = parse(data, {
  columns: true,
  skip_empty_lines: true
});

const cats = new Set();
for (const r of records) {
  if (r.Category) {
    cats.add(r.Category.trim());
  }
}

console.log(Array.from(cats));
