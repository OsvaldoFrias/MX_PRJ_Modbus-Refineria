const securos = require('securos');
const jsmodbus = require('jsmodbus');
const net = require('net');

const socket = new net.Socket();
const client = new jsmodbus.client.TCP(socket, 1); // unitId 1

//const host = '192.168.73.33';
const host = '127.0.0.1';
const port = 502;

securos.connect(async function (core) {
  core.registerEventHandler('MACRO', '1.1', 'RUN', async function () {
    console.log('▶ Macro presionada');
    socket.connect({ host, port });
  });
});
 
socket.on('connect', () => {
  console.log(`✅ Conectado a ${host}:${port}`);

  client.readHoldingRegisters(0, 16)
    .then((response) => {
      const values = response.response.body.valuesAsArray;
      console.log('📥 Valores recibidos:', values);

      const bits = inputRegisterToBits(values[0]);
      console.log('🧠 Bits del primer registro:', bits);
    })
    .catch((err) => {
      console.error('❌ Error al leer registros:', err.message);
    })
    .finally(() => {
      socket.end();
    });
});

socket.on('error', (err) => {
  console.error(`❌ Error de conexión:`, err.message);
});

// Función para convertir registro a bits
function inputRegisterToBits(inputRegisterValue) {
  const bits = [];
  for (let i = 0; i < 16; i++) {
    bits.push((inputRegisterValue >> i) & 1);
  }
  return bits;
}


/*
Datos en consola:

2025-05-19T20:17:00.739: ▶ Macro presionada
✅ Conectado a 192.168.73.33:502
📥 Valores recibidos: [
  0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0,
  0, 0, 0, 0
]
🧠 Bits del primer registro: [
  0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0,
  0, 0, 0, 0
]
*/