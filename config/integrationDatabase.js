const { Sequelize } = require("sequelize");
const { createSequelize } = require("./sequelizeFactory");

const INTEGRATION_DATABASE_ENV = "SMART_TAXI_INTEGRATION_DB_NAME";
const APPROVAL_ENV = "SMART_TAXI_INTEGRATION_DB_APPROVED";
const ownedIntegrationInstances = new WeakSet();

const getIntegrationDatabaseName = (env = process.env) => {
  const databaseName = env[INTEGRATION_DATABASE_ENV];

  if (!databaseName) {
    throw new Error(
      `${INTEGRATION_DATABASE_ENV} must be set for integration tests`
    );
  }

  if (
    databaseName === "carpooling_db" ||
    databaseName === "test" ||
    !/^smart_taxi_integration_[a-z0-9_]+$/.test(databaseName)
  ) {
    throw new Error(
      "Integration tests require a dedicated SMART_TAXI_INTEGRATION_DB_NAME"
    );
  }

  return databaseName;
};

const getIntegrationDatabaseConfig = (env = process.env) => ({
  database: getIntegrationDatabaseName(env),
  username: env.SMART_TAXI_INTEGRATION_DB_USER,
  password: env.SMART_TAXI_INTEGRATION_DB_PASSWORD,
  host: env.SMART_TAXI_INTEGRATION_DB_HOST,
  port: Number(env.SMART_TAXI_INTEGRATION_DB_PORT || 3306)
});

const createIntegrationSequelize = (env = process.env) => {
  const config = getIntegrationDatabaseConfig(env);

  if (!config.username || !config.password || !config.host) {
    throw new Error(
      "Integration database credentials, password, and host must be configured explicitly"
    );
  }

  const sequelize = createSequelize({
    ...config,
    logging: false
  });

  ownedIntegrationInstances.add(sequelize);
  return sequelize;
};

const assertIntegrationSequelize = (sequelize, env = process.env) => {
  const approvedConfig = getIntegrationDatabaseConfig(env);

  if (!(sequelize instanceof Sequelize)) {
    throw new Error("Integration setup requires a Sequelize instance");
  }

  if (!ownedIntegrationInstances.has(sequelize)) {
    throw new Error(
      "Sequelize instance was not created by the integration database factory"
    );
  }

  const configured = sequelize.config || {};
  const matchesConfiguration =
    configured.database === approvedConfig.database &&
    configured.host === approvedConfig.host &&
    Number(configured.port) === approvedConfig.port &&
    configured.username === approvedConfig.username &&
    configured.password === approvedConfig.password;

  if (!matchesConfiguration) {
    throw new Error(
      "Sequelize instance does not match the approved integration database configuration"
    );
  }

  return sequelize;
};

const assertDestructiveIntegrationApproval = (env = process.env) => {
  const databaseName = getIntegrationDatabaseName(env);

  if (env[APPROVAL_ENV] !== "true") {
    throw new Error(
      `${APPROVAL_ENV}=true is required for disposable integration database setup`
    );
  }

  return databaseName;
};

module.exports = {
  INTEGRATION_DATABASE_ENV,
  APPROVAL_ENV,
  getIntegrationDatabaseName,
  getIntegrationDatabaseConfig,
  createIntegrationSequelize,
  assertIntegrationSequelize,
  assertDestructiveIntegrationApproval
};
