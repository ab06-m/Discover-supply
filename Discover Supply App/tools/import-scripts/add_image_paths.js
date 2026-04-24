const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'Products_20260120_20260420.csv');
const newCsvPath = path.join(__dirname, '..', 'Products_with_Images.csv');
const kyteImagesDir = path.join(__dirname, '..', 'kyte_images_optimized');

const csvData = fs.readFileSync(csvPath, 'utf8');
const lines = csvData.trim().split('\n');

const mappedLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (i === 0) {
    // Header
    mappedLines.push(line.trim() + ',"Image_Path"');
    continue;
  }
  
  // Parse CSV (handling quotes roughly)
  const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
  if (cols.length < 2) {
    mappedLines.push(line);
    continue;
  }

  // Name is typically the second column
  let name = cols[1];
  if (name.startsWith('"') && name.endsWith('"')) {
    name = name.slice(1, -1);
  }

  const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase().trim();
  const possibleImagePath = path.join(kyteImagesDir, `${safeName}.webp`);
  
  if (fs.existsSync(possibleImagePath)) {
    mappedLines.push(`${line.trim()},"${possibleImagePath.replace(/\\/g, '\\\\')}"`);
  } else {
    mappedLines.push(line.trim() + ',""');
  }
}

fs.writeFileSync(newCsvPath, mappedLines.join('\n'));
console.log(`Wrote mapped CSV to ${newCsvPath}`);
