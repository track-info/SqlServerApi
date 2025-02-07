const sql = require("mssql");
require("dotenv").config();

const config = {
  user: process.env.DB_USER,                        
  password: process.env.DB_PASS,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || 1433), 
  options: {
    encrypt: process.env.DB_ENCRYPT === "true", 
    trustServerCertificate: process.env.DB_ENCRYPT === "false",  
    enableArithAbort: true  
  },
  pool: { 
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log("Conectado ao SQL Server em", process.env.DB_HOST);
    return pool;
  })
  .catch(err => {
    console.error("Erro de conexão:", {
      message: err.message,
      code: err.code,
      server: process.env.DB_HOST
    });
    process.exit(1);
  });

module.exports = {
  sql,
  poolPromise
};
