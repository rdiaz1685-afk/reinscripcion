const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const targetTerms = ['matricula', 'unidad', 'campus', 'nombre', 'grupo', 'grado', 'estatus', 'expediente'];

function findHeader(data) {
    let bestHeaderIndex = -1;
    let maxMatches = 0;

    for (let i = 0; i < Math.min(data.length, 50); i++) {
        const row = data[i];
        if (!row) continue;

        let currentMatches = 0;
        const rowTerms = row.map(cell =>
            String(cell || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        );

        targetTerms.forEach(term => {
            if (rowTerms.some(rt => rt.includes(term))) {
                currentMatches++;
            }
        });

        if (currentMatches > maxMatches) {
            maxMatches = currentMatches;
            bestHeaderIndex = i;
            console.log(`Row ${i} matches: ${currentMatches}`, rowTerms);
        }
    }
    return { bestHeaderIndex, maxMatches };
}

const workbook = XLSX.readFile('upload/25-26.xlsx');
const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
const { bestHeaderIndex, maxMatches } = findHeader(data);
console.log('Final Result:', { bestHeaderIndex, maxMatches });
