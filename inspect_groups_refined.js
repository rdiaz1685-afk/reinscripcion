const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

function findCol(headers, terms) {
    return headers.findIndex(h => h && terms.some(t => String(h).toLowerCase().includes(t.toLowerCase())));
}

async function debugExcel(fileName) {
    const filePath = path.join(process.cwd(), 'upload', fileName);
    if (!fs.existsSync(filePath)) return;

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`\nFILE: ${fileName}`);
    for (let i = 0; i < Math.min(data.length, 30); i++) {
        const row = data[i];
        if (row && row.some(c => String(c).toLowerCase().includes('matricula'))) {
            console.log(`Header Row ${i}:`, row.filter(x => x).map((h, idx) => `[${idx}]:${h}`).join(' | '));
            const gIdx = findCol(row, ['grupo', 'seccion', 'clase']);
            console.log(`Detected 'Grupo' Index: ${gIdx} (${row[gIdx]})`);
            if (data[i + 1]) {
                console.log(`Data Row Sample: Grupo=${data[i + 1][gIdx]}`);
            }
            break;
        }
    }
}

async function main() {
    const files = ['MITRAS_25-26.xlsx', 'CUMBRES_25-26.xlsx', 'NORTE_25-26.xlsx', 'ANAHUAC_25-26.xlsx'];
    for (const f of files) await debugExcel(f);
}

main();
