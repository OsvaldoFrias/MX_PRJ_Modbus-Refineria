const xlsx = require('xlsx');
const path = require('path');
const jsmodbus = require('jsmodbus');
const net = require('net');

// --- Configuration ---
const excelFilePath = path.join(__dirname, './BASE MODBUS PARA EL VMS DEL SFG.xlsx');
const sheetName = '7453SFG01'; // Or the specific sheet you need
const modbusHost = '127.0.0.1';
// const modbusHost = '192.168.73.33';
// const modbusHost = '192.168.53.41';
const modbusPort = 502;
const modbusUnitId = 1;
const readInterval = 5000; // Read every 5 seconds
const pauseBetweenReads = 100; // 100ms pause between each batch read

// --- Placeholder function for processing Modbus values ---
function processModbusValue(address, value) {
  // TODO: Implement your custom logic here
  // For example, you could log to the console or store in a database
  console.log(`Processing Address ${address}: Value: ${value}`);
}

// --- Utility function for delay ---
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Groups a sorted list of addresses into batches for efficient Modbus reading.
 * Each batch will read a contiguous block of registers that is no larger than 100 registers.
 * @param {number[]} addresses - A sorted array of register addresses.
 * @returns {{start: number, count: number, addresses: number[]}[]} An array of batch objects.
 */
function createAddressBatches(addresses) {
  if (!addresses || addresses.length === 0) {
    return [];
  }

  // Use a Set to get unique addresses, then sort them.
  const sortedAddresses = [...new Set(addresses)].sort((a, b) => a - b);
  const batches = [];
  let currentBatch = null;

  for (const address of sortedAddresses) {
    // If a batch exists and the current address fits within the 100-register limit from the batch's start
    if (currentBatch && (address - currentBatch.start < 100)) {
      currentBatch.addresses.push(address);
    } else {
      // If a batch exists, finalize it and push it to the list.
      if (currentBatch) {
        // The count is the difference between the highest and lowest address in the batch.
        currentBatch.count = Math.max(...currentBatch.addresses) - currentBatch.start + 1;
        batches.push(currentBatch);
      }
      // Start a new batch for the current address.
      currentBatch = {
        start: address,
        count: 1, // Initial count
        addresses: [address] // List of specific addresses to process from this batch
      };
    }
  }

  // Don't forget to push the last batch after the loop finishes.
  if (currentBatch) {
    currentBatch.count = Math.max(...currentBatch.addresses) - currentBatch.start + 1;
    batches.push(currentBatch);
  }

  return batches;
}


function main() {
  try {
    // 1. Read data from Excel file (only once at the start)
    const workbook = xlsx.readFile(excelFilePath);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in the Excel file.`);
    }
    const data = xlsx.utils.sheet_to_json(sheet);

    // Extract, filter, and sort addresses to prepare for batching
    const addresses = data.map(row => {
      if (row.ALIASNUM) {
        const num = parseInt(row.ALIASNUM.toString().replace(/\D/g, ''));
        // Defases addressing into excel document
        return num - 30001;
      }
      return null;
    }).filter(num => typeof num === 'number' && !isNaN(num));

    if (addresses.length === 0) {
      console.log('No valid ALIASNUM values found in the Excel sheet.');
      return;
    }

    const uniqueAddresses = [...new Set(addresses)];
    console.log(`Found ${uniqueAddresses.length} unique addresses to read periodically.`);

    // Group addresses into batches for efficient reading
    const addressBatches = createAddressBatches(uniqueAddresses);
    console.log(`Grouped addresses into ${addressBatches.length} batches.`);


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
      console.log(`Attempting to connect to ${modbusHost}:${modbusPort}...`);
      socket.connect({ host: modbusHost, port: modbusPort });
    }


    socket.on('connect', () => {
      console.log(`✅ Connected to Modbus server at ${modbusHost}:${modbusPort}`);
      // Start periodic reading once connected
      setInterval(readAllAddressesInBatches, readInterval);
    });

    async function readAllAddressesInBatches() {
      console.log(`--- Starting new read cycle (${new Date().toLocaleTimeString()}) ---`);

      for (const batch of addressBatches) {
        client.readInputRegisters(batch.start, batch.count)
          .then(response => {
            const values = response.response.body.valuesAsArray;
            // The response contains values for the whole block (from batch.start to batch.start + batch.count - 1)
            // We only need to process the values for the addresses specified in the Excel file.
            for (const address of batch.addresses) {
              const index = address - batch.start; // Calculate the index in the values array
              if (index >= 0 && index < values.length) {
                const value = values[index];
                processModbusValue(address + 1, value);
              } else {
                // This should not happen if the batching logic is correct
                console.error(`Could not find value for address ${address + 1} in batch response.`);
              }
            }
          })
          .catch(err => {
            console.error(`❌ Error reading batch starting at address ${batch.start} (count: ${batch.count}):`, err.message);
          });

        // A small pause between batch reads can be good practice to not overload the device
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