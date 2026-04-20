const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'archivo excel', 'Avance de RI Mitras.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('📊 Hojas disponibles:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
    console.log(`\n\n=== HOJA: ${sheetName} ===`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    // Mostrar primeras 30 filas
    data.slice(0, 30).forEach((row, idx) => {
        console.log(`Fila ${idx + 1}:`, row);
    });
});
