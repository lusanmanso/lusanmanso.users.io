// File: jest.config.js
module.exports = {
  // Directorios donde Jest buscará archivos de test
  testMatch: [
    "**/tests/**/*.js?(x)",
    "**/?(*.)+(spec|test).js?(x)"
  ],
   testPathIgnorePatterns: [
    "tests/setup.js",
    "tests/teardown.js"
  ],
  // Entorno de ejecución de los tests (nodejs es el predeterminado)
  testEnvironment: 'node',
  // Archivo que Jest ejecuta una vez antes de todas las suites de tests
  globalSetup: './tests/setup.js',
  // Archivo que Jest ejecuta una vez después de todas las suites de tests
  globalTeardown: './tests/teardown.js',
  // Detecta handles abiertos que impiden que Jest salga
  detectOpenHandles: true,
  // Fuerza a Jest a salir una vez que los tests han terminado
  forceExit: true,
  // Ruta donde se inicializan las variables de entorno de Jest
  // setupFilesAfterEnv: ['./tests/jest.setup.js'], // Puedes añadir esto si necesitas configurar algo antes de cada archivo de test (no cada test individual)
  testTimeout: 15000, // 15 segundos para la wifi de biblioteca
};
