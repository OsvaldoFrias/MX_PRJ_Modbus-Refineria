const xlsx = require('xlsx');
const path = require('path');
const jsmodbus = require('jsmodbus');
const net = require('net');

// --- Configuration ---
const excelFilePath = path.join(__dirname, '../docs/BASE MODBUS PARA EL VMS DEL SFG.xlsx');
const sheetName = '7453SFG01'; // Or the specific sheet you need
const modbusHost = '127.0.0.1';
const modbusPort = 502;
const modbusUnitId = 1;
const readInterval = 5000; // Read every 5 seconds
const pauseBetweenReads = 50; // 50ms pause between each address read

// --- Placeholder function for processing Modbus values ---
function processModbusValue(address, value) {
  // TODO: Implement your custom logic here
  console.log(`Processing Address ${address}: Value: ${value}`);
}

// --- Utility function for delay ---
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function main() {

  // --- Main Logic ---
  try {
    // 1. Read data from Excel file (only once at the start)
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
    console.log(`Found ${addresses.length} addresses to read periodically.`);

    // 2. Setup Modbus connection
    const socket = new net.Socket();
    const client = new jsmodbus.client.TCP(socket, modbusUnitId);

    socket.on('error', (err) => {
      console.error(`❌ Connection Error:`, err.message);
    });

    socket.on('close', () => {
      console.log('Connection closed. Attempting to reconnect...');
      setTimeout(connect, readInterval);
    });


    function connect() {
      if (socket.connecting || socket.writable) {
        return;
      }
      console.log(`Attempting to connect to ${modbusHost}:${modbusPort}...`);
      socket.connect({ host: modbusHost, port: modbusPort });
    }


    socket.on('connect', () => {
      console.log(`✅ Connected to Modbus server at ${modbusHost}:${modbusPort}`);
      // Start periodic reading once connected
      setInterval(readAllAddresses, readInterval);
    });

    async function readAllAddresses() {
      console.log('--- Starting new read cycle ---');
      for (const address of addresses) {
        try {
          console.log(`Reading address: ${address}`);
          const response = await client.readHoldingRegisters(address, 1);
          const value = response.response.body.valuesAsArray[0];
          processModbusValue(address, value);
        } catch (err) {
          console.error(`❌ Error reading address ${address}:`, err.message);
          // If an error occurs, the connection might have dropped.
          // The 'close' or 'error' event on the socket will handle reconnection.
          break; // Exit this read cycle and wait for reconnection
        }
        // Pause before reading the next address
        await delay(pauseBetweenReads);
      }
      console.log('--- Read cycle finished ---');
    }

    // Initial connection attempt
    connect();

  } catch (error) {
    console.error("An error occurred during setup:", error.message);
  }
}

main();
