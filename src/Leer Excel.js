const xlsx = require('xlsx');
const path = require('path');

// Replace this with the path to your XLSX file
//const filePath = path.join(__dirname, 'RELACION PRESETS.xlsx');
const filePath = path.join(__dirname, 'BASE MODBUS PARA EL VMS DEL SFG.xlsx');

// Read the workbook
const workbook = xlsx.readFile(filePath);

// Get sheet names
const sheetNames = workbook.SheetNames;
console.log('Sheet names:', sheetNames);

const sheet = workbook.Sheets["7453SFG01"];
// Convert the sheet to JSON
const data = xlsx.utils.sheet_to_json(sheet);
console.log('Data from the first sheet:', data);


/*
// Read the first sheet
const sheet = workbook.Sheets[sheetNames[0]];

// Convert the sheet to JSON
const data = xlsx.utils.sheet_to_json(sheet);
console.log('Data from the first sheet:', data);
*/
