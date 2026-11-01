require("dotenv").config();

const {
  initializeIntegrationSchema
} = require("./database");

initializeIntegrationSchema()
  .then(({ modelNames, tableNames }) => {
    console.log(`Registered integration models: ${modelNames.join(", ")}`);
    console.log(`Integration tables: ${tableNames.join(", ")}`);
  })
  .catch((error) => {
    console.error(`Integration schema setup failed: ${error.message}`);
    process.exitCode = 1;
  });
