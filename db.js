// db.js
const mysql = require('mysql2'); // Requiere el módulo mysql2

// Configura la conexión a la base de datos
const pool = mysql.createPool({
  host: 'localhost',  // Cambia esto si tu base de datos está en otro lugar
  user: 'root',       // Cambia al usuario que usas para conectarte a la base de datos
  password: '123',  // Cambia  tu contraseña
  database: 'lol_db' // Cambia al nombre de la base de datos que quieras usar
});

module.exports = pool.promise();  // Usamos Promesas para trabajar con async/await
