const { Sequelize } = require("sequelize");

const createSequelize = (config) => {
  if (!config || !config.database || !config.username || !config.host) {
    throw new Error(
      "Sequelize database, username, and host configuration are required"
    );
  }

  return new Sequelize(
    config.database,
    config.username,
    config.password,
    {
      host: config.host,
      port: config.port,
      dialect: "mysql",
      ...(config.pool ? { pool: config.pool } : {}),
      ...(config.logging !== undefined ? { logging: config.logging } : {})
    }
  );
};

module.exports = { createSequelize };
