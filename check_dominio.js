const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

async function main() {
    const files = ['DOMINIO_25-26.xlsx'];
    for (const f of files) {
        const filePath = path.join(process.cwd(), 'upload', f);
        if (!fs.existsSync(filePath)) continue;
        const workbook = XLSX.readFile(filePath);
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        console.log(`\nFILE: ${f}`);
        for (let i = 0; i < 5; i++) {
            if (data[i]) console.log(`Row ${i}:`, data[i]);
        }
    }
}
main();
