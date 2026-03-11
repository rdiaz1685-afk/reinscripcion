const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

async function main() {
    const files = ['MITRAS_25-26.xlsx', 'CUMBRES_25-26.xlsx', 'NORTE_25-26.xlsx', 'ANAHUAC_25-26.xlsx'];
    for (const f of files) {
        const filePath = path.join(process.cwd(), 'upload', f);
        if (!fs.existsSync(filePath)) continue;
        const workbook = XLSX.readFile(filePath);
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        console.log(`\nFILE: ${f}`);
        // Buscar la fila que parece ser el encabezado
        for (let i = 0; i < 10; i++) {
            if (data[i] && data[i].some(c => String(c).toLowerCase().includes('matricula') || String(c).toLowerCase().includes('clave') || String(c).toLowerCase().includes('nombre'))) {
                console.log(`Header at Row ${i}:`, data[i]);
                break;
            }
        }
    }
}
main();
