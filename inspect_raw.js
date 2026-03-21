const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

async function debugExcel(fileName) {
    const filePath = path.join(process.cwd(), 'upload', fileName);
    if (!fs.existsSync(filePath)) return;

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`\nFILE: ${fileName}`);
    data.slice(0, 10).forEach((row, i) => {
        if (row && row.length > 5) {
            console.log(`Row ${i} (partial): ${JSON.stringify(row.slice(0, 15))}`);
        }
    });
}

async function main() {
    const files = ['MITRAS_25-26.xlsx', 'CUMBRES_25-26.xlsx', 'NORTE_25-26.xlsx', 'ANAHUAC_25-26.xlsx'];
    for (const f of files) await debugExcel(f);
}

main();
