const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getIntegrationDatabaseName,
  assertDestructiveIntegrationApproval
} = require("../../config/integrationDatabase");

test("integration database configuration fails closed when missing", () => {
  assert.throws(
    () => getIntegrationDatabaseName({}),
    /SMART_TAXI_INTEGRATION_DB_NAME must be set/
  );
});

test("application and shared test database names are rejected", () => {
  for (const databaseName of ["carpooling_db", "test"]) {
    assert.throws(
      () => getIntegrationDatabaseName({
        SMART_TAXI_INTEGRATION_DB_NAME: databaseName
      }),
      /dedicated SMART_TAXI_INTEGRATION_DB_NAME/
    );
  }
});

test("destructive integration setup requires explicit approval", () => {
  assert.throws(
    () => assertDestructiveIntegrationApproval({
      SMART_TAXI_INTEGRATION_DB_NAME: "smart_taxi_integration_local"
    }),
    /SMART_TAXI_INTEGRATION_DB_APPROVED=true/
  );
});
