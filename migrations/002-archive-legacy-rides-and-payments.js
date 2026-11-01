
async function getTableNames(queryInterface) {
  const tables = await queryInterface.showAllTables();

  return new Set(
    tables
      .map((table) => {
        if (typeof table === "string") {
          return table;
        }

        return (
          table.tableName ||
          table.table_name ||
          Object.values(table)[0]
        );
      })
      .filter(Boolean)
      .map((name) => String(name).toLowerCase())
  );
}

async function getReferencedTable(
  queryInterface,
  tableName,
  columnName
) {
  const results = await queryInterface.sequelize.query(
    `
      SELECT REFERENCED_TABLE_NAME AS referencedTable
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :tableName
        AND COLUMN_NAME = :columnName
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `,
    {
      replacements: { tableName, columnName },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    }
  );

  return results[0]?.referencedTable ?? null;
}

module.exports = {
  async up({ context: queryInterface }) {
    const tablesBefore = await getTableNames(queryInterface);

    if (
      !tablesBefore.has("rides") ||
      !tablesBefore.has("payments") ||
      tablesBefore.has("rides_legacy") ||
      tablesBefore.has("payments_legacy")
    ) {
      throw new Error(
        "Unexpected table state. Expected rides and payments to exist, " +
          "with no rides_legacy or payments_legacy tables."
      );
    }

    // Verify the existing foreign key before changing table names.
    const paymentReference = await getReferencedTable(
      queryInterface,
      "payments",
      "rideID"
    );

    if (paymentReference?.toLowerCase() !== "rides") {
      throw new Error(
        "Expected payments.rideID to reference rides. Migration stopped."
      );
    }

    // Rename the parent table first.
    await queryInterface.renameTable("rides", "rides_legacy");

    // Rename the dependent table.
    await queryInterface.renameTable("payments", "payments_legacy");

    // Verify that the foreign key still references the renamed parent.
    const paymentReferenceAfter = await getReferencedTable(
      queryInterface,
      "payments_legacy",
      "rideID"
    );

    if (paymentReferenceAfter?.toLowerCase() !== "rides_legacy") {
      throw new Error(
        "The legacy payment-to-ride foreign key does not reference " +
          "rides_legacy after renaming. Manual inspection is required."
      );
    }
  },

  async down({ context: queryInterface }) {
    const tables = await getTableNames(queryInterface);

    if (
      !tables.has("rides_legacy") ||
      !tables.has("payments_legacy") ||
      tables.has("rides") ||
      tables.has("payments")
    ) {
      throw new Error(
        "Unexpected table state. Cannot safely restore legacy table names."
      );
    }

    // Restore the dependent table first.
    await queryInterface.renameTable("payments_legacy", "payments");

    // Restore the parent table.
    await queryInterface.renameTable("rides_legacy", "rides");
  },
};
