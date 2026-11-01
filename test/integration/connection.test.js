const assert = require("node:assert/strict");
const test = require("node:test");
require("dotenv").config();

const {
  createIntegrationSequelize,
  assertIntegrationSequelize
} = require("../../config/integrationDatabase");

const EXPECTED_DATABASE = "smart_taxi_integration_local";
const EXPECTED_USERNAME = "smart_taxi_integration";

test("connects to the approved integration database without schema mutation", async () => {
  assert.equal(
    process.env.NODE_ENV,
    "integration",
    "NODE_ENV must be integration for the real integration connection test"
  );
  assert.equal(
    process.env.SMART_TAXI_INTEGRATION_DB_NAME,
    EXPECTED_DATABASE,
    "SMART_TAXI_INTEGRATION_DB_NAME must target the approved integration database"
  );
  assert.equal(
    process.env.SMART_TAXI_INTEGRATION_DB_USER,
    EXPECTED_USERNAME,
    "SMART_TAXI_INTEGRATION_DB_USER must target the dedicated integration user"
  );

  const sequelize = createIntegrationSequelize(process.env);

  try {
    assertIntegrationSequelize(sequelize, process.env);
    assert.equal(sequelize.getDatabaseName(), EXPECTED_DATABASE);
    assert.equal(sequelize.config.username, EXPECTED_USERNAME);
    await sequelize.authenticate();
  } finally {
    await sequelize.close();
  }
});
