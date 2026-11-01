const {
  assertDestructiveIntegrationApproval,
  assertIntegrationSequelize
} = require("../../config/integrationDatabase");

const assertIntegrationMode = () => {
  if (process.env.NODE_ENV !== "integration") {
    throw new Error("Integration database helpers require NODE_ENV=integration");
  }
};

const initializeIntegrationSchema = async () => {
  assertIntegrationMode();
  const env = process.env;
  assertDestructiveIntegrationApproval(env);
  if (env.SMART_TAXI_INTEGRATION_DB_NAME !== "smart_taxi_integration_local") {
    throw new Error(
      "Schema setup requires smart_taxi_integration_local"
    );
  }

  if (env.SMART_TAXI_INTEGRATION_DB_USER !== "smart_taxi_integration") {
    throw new Error(
      "Schema setup requires the smart_taxi_integration user"
    );
  }

  const sequelize = require("../../config/database");

  try {
    assertIntegrationSequelize(sequelize, env);
    const models = require("../../models/associations");
    const requiredModelNames = Object.keys(models);
    const missingModels = requiredModelNames.filter(
      (modelName) => !sequelize.models[modelName]
    );

    if (missingModels.length > 0) {
      throw new Error(
        `Integration schema models are not registered: ${missingModels.join(", ")}`
      );
    }

    await sequelize.sync();
    const [rows] = await sequelize.query("SHOW TABLES");
    return {
      modelNames: requiredModelNames,
      tableNames: rows.map((row) => Object.values(row)[0])
    };
  } finally {
    await sequelize.close();
  }
};

module.exports = {
  initializeIntegrationSchema
};
