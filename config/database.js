require("dotenv").config();
const { createSequelize } = require("./sequelizeFactory");
const { createIntegrationSequelize } = require("./integrationDatabase");

if (process.env.NODE_ENV === "integration") {
  module.exports = createIntegrationSequelize();
} else {
  module.exports = createSequelize({
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
}