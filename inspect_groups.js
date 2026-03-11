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

    console.log(`\n--- Debugging ${fileName} ---`);
    console.log('Total Rows:', data.length);
    // Buscamos una fila que tenga al menos "Nombre" o "Matricula"
    for (let i = 0; i < Math.min(data.length, 20); i++) {
        const row = data[i];
        if (row.some(c => String(c).toLowerCase().includes('nombre') || String(c).toLowerCase().includes('matricula'))) {
            console.log(`Found Header at Row ${i}:`, JSON.stringify(row));
            // Show one row of data too
            if (data[i + 1]) {
                console.log(`Example Data Row ${i + 1}:`, JSON.stringify(data[i + 1]));
            }
            break;
        }
    }
}

async function main() {
    await debugExcel('MITRAS_25-26.xlsx');
    await debugExcel('CUMBRES_25-26.xlsx');
    await debugExcel('NORTE_25-26.xlsx');
    await debugExcel('ANAHUAC_25-26.xlsx');
}

main();
