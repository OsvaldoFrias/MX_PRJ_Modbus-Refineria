const xlsx = require('xlsx');
const path = require('path');
const jsmodbus = require('jsmodbus');
const net = require('net');

// --- Configuration ---
const excelFilePath = path.join(__dirname, '../BASE MODBUS PARA EL VMS DEL SFG.xlsx');
const sheetName = '7453SFG01'; // Or the specific sheet you need
const modbusHost = '127.0.0.1';
const modbusPort = 502;
const modbusUnitId = 1;

// --- Placeholder function for processing Modbus values ---
function processModbusValue(address, value) {
  // TODO: Implement your custom logic here
  console.log(`Processing Address ${address}: Value: ${value}`);
}

// --- Main Logic ---
try {
  // 1. Read data from Excel file
  const workbook = xlsx.readFile(excelFilePath);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in the Excel file.`);
  }
  const data = xlsx.utils.sheet_to_json(sheet);

  const addresses = data.map(row => row.ALIASNUM).filter(num => typeof num === 'number');
  if (addresses.length === 0) {
    console.log('No valid ALIASNUM values found in the Excel sheet.');
    return;
  }
  console.log(`Found ${addresses.length} addresses to read.`);

  // 2. Connect to Modbus server
  const socket = new net.Socket();
  const client = new jsmodbus.client.TCP(socket, modbusUnitId);

  socket.on('error', (err) => {
    console.error(`❌ Connection Error:`, err.message);
  });

  socket.connect({ host: modbusHost, port: modbusPort }, () => {
    console.log(`✅ Connected to Modbus server at ${modbusHost}:${modbusPort}`);
    
    // 3. Read Modbus registers for each address
    const readPromises = addresses.map(address => {
      console.log(`Reading address: ${address}`);
      return client.readHoldingRegisters(address, 1)
        .then(response => {
          const value = response.response.body.valuesAsArray[0];
          processModbusValue(address, value);
        })
        .catch(err => {
          console.error(`❌ Error reading address ${address}:`, err.message);
        });
    });

    // 4. Close connection when all reads are done
    Promise.all(readPromises).finally(() => {
      console.log('All reads attempted. Closing connection.');
      socket.end();
    });
  });

} catch (error) {
  console.error("An error occurred:", error.message);
}
