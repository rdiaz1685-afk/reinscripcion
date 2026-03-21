const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

async function debugExcel(fileName) {
    const filePath = path.join(process.cwd(), 'upload', fileName);
    if (!fs.existsSync(filePath)) {
        console.log(`File ${fileName} not found`);
        return;
    }

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`--- Debugging ${fileName} ---`);
    console.log('Total Rows:', data.length);
    console.log('First 15 rows:');
    data.slice(0, 15).forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });
}

async function main() {
    await debugExcel('25-26.xlsx');
    await debugExcel('26-27.xlsx');
}

main();
