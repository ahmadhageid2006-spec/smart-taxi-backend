const assert = require("node:assert/strict");
const test = require("node:test");
const { Sequelize } = require("sequelize");
const normalDatabase = require("../../config/database");
const {
  createIntegrationSequelize,
  assertIntegrationSequelize
} = require("../../config/integrationDatabase");

const integrationEnv = {
  SMART_TAXI_INTEGRATION_DB_NAME: "smart_taxi_integration_local",
  SMART_TAXI_INTEGRATION_DB_HOST: "localhost",
  SMART_TAXI_INTEGRATION_DB_PORT: "3306",
  SMART_TAXI_INTEGRATION_DB_USER: "smart_taxi_integration",
  SMART_TAXI_INTEGRATION_DB_PASSWORD: "integration_password"
};

test("a normal Sequelize instance is rejected for integration setup", () => {
  assert.ok(normalDatabase instanceof Sequelize);
  assert.throws(
    () => assertIntegrationSequelize(normalDatabase, integrationEnv),
    /not created by the integration database factory/
  );
});

test("integration validation rejects mismatched connection configuration", () => {
  for (const change of [
    { SMART_TAXI_INTEGRATION_DB_HOST: "other-host" },
    { SMART_TAXI_INTEGRATION_DB_USER: "other-user" },
    { SMART_TAXI_INTEGRATION_DB_PASSWORD: "other-password" }
  ]) {
    const sequelize = createIntegrationSequelize(integrationEnv);

    try {
      assert.throws(
        () => assertIntegrationSequelize(sequelize, {
          ...integrationEnv,
          ...change
        }),
        /does not match the approved integration database configuration/
      );
    } finally {
      sequelize.close();
    }
  }
});

test("a correctly configured integration instance is accepted", async () => {
  const sequelize = createIntegrationSequelize(integrationEnv);

  try {
    assert.strictEqual(
      assertIntegrationSequelize(sequelize, integrationEnv),
      sequelize
    );
  } finally {
    await sequelize.close();
  }
});

test("schema alteration is enabled only for development", () => {
  const { shouldAlterDevelopmentSchema, shouldSyncSchema } =
    require("../../app");
  const previous = process.env.NODE_ENV;

  try {
    for (const environment of [
      undefined,
      "production",
      "integration",
      "staging",
      "prod"
    ]) {
      if (environment === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = environment;
      }
      assert.equal(shouldAlterDevelopmentSchema(), false);
    }

    process.env.NODE_ENV = "development";
    assert.equal(shouldAlterDevelopmentSchema(), true);
    assert.equal(shouldSyncSchema(), true);

    process.env.NODE_ENV = "integration";
    assert.equal(shouldSyncSchema(), false);
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
});
