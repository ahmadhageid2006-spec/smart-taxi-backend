const { DataTypes } = require("sequelize");

async function getTableNames(queryInterface) {
    const tables = await queryInterface.showAllTables();

    return new Set(
        tables
            .map((table) => {
                if (typeof table === "string") {
                    return table;
                }

                return table.tableName || table.table_name || Object.values(table)[0];
            })
            .filter(Boolean)
            .map((name) => String(name).toLowerCase()),
    );
}

module.exports = {
    async up({ context: queryInterface }) {
        const tablesBefore = await getTableNames(queryInterface);

        // Required parent tables must exist.
        const requiredTables = ["users", "cars", "rides_legacy", "payments_legacy"];

        const missingTables = requiredTables.filter(
            (tableName) => !tablesBefore.has(tableName),
        );

        if (missingTables.length > 0) {
            throw new Error(
                `Cannot create rides. Missing required tables: ${missingTables.join(", ")}`,
            );
        }

        // Never overwrite an existing table.
        if (tablesBefore.has("rides")) {
            throw new Error(
                'Cannot create rides because a table named "rides" already exists.',
            );
        }

        try {
            await queryInterface.createTable("rides", {
                id: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    primaryKey: true,
                    autoIncrement: true,
                },

                userId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },

                pickupLatitude: {
                    type: DataTypes.DECIMAL(10, 8),
                    allowNull: false,
                },

                pickupLongitude: {
                    type: DataTypes.DECIMAL(11, 8),
                    allowNull: false,
                },

                destinationLatitude: {
                    type: DataTypes.DECIMAL(10, 8),
                    allowNull: false,
                },

                destinationLongitude: {
                    type: DataTypes.DECIMAL(11, 8),
                    allowNull: false,
                },

                workerId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },

                carId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },

                status: {
                    type: DataTypes.ENUM(
                        "PENDING",
                        "ACCEPTED",
                        "IN_PROGRESS",
                        "COMPLETED",
                        "CANCELLED",
                    ),
                    allowNull: false,
                    defaultValue: "PENDING",
                },

                pickupAddress: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },

                destinationAddress: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },

                rideType: {
                    type: DataTypes.ENUM("NORMAL", "COMFORT"),
                    allowNull: false,
                },

                notes: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                },

                scheduledAt: {
                    type: DataTypes.DATE,
                    allowNull: true,
                },

                startAt: {
                    type: DataTypes.DATE,
                    allowNull: true,
                },

                completedAt: {
                    type: DataTypes.DATE,
                    allowNull: true,
                },

                cancelAt: {
                    type: DataTypes.DATE,
                    allowNull: true,
                },

                cancelReason: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                },

                distanceKm: {
                    type: DataTypes.DECIMAL(8, 2),
                    allowNull: true,
                },

                price: {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: true,
                },

                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                },

                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                },
            });

            // Use new constraint names because the legacy table
            // may still retain foreign keys with older names.
// Passenger relationship: Ride belongs to User.
await queryInterface.addConstraint("rides", {
        fields: ["userId"],
    type: "foreign key",
    name: "fk_rides_current_user",
    references: {
    table: "users",
    field: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
});

// Driver relationship: a ride may have no assigned driver.
await queryInterface.addConstraint("rides", {
    fields: ["workerId"],
    type: "foreign key",
    name: "fk_rides_current_worker",
    references: {
    table: "users",
    field: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
});

// Car relationship: a ride may have no assigned car.
await queryInterface.addConstraint("rides", {
    fields: ["carId"],
    type: "foreign key",
    name: "fk_rides_current_car",
    references: {
    table: "cars",
    field: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
});

        } catch (error) {
            // MySQL DDL may not roll back as one transaction.
            // Clean up a partially created table before reporting failure.
            const tablesAfter = await getTableNames(queryInterface);

            if (!tablesBefore.has("rides") && tablesAfter.has("rides")) {
                try {
                    await queryInterface.dropTable("rides");
                } catch (cleanupError) {
                    error.cleanupError = cleanupError;
                }
            }

            throw error;
        }
    },

    async down({ context: queryInterface }) {
        const tables = await getTableNames(queryInterface);

        if (!tables.has("rides")) {
            return;
        }

        // Protect any rides created after this migration.
        const rows = await queryInterface.sequelize.query(
            "SELECT COUNT(*) AS rowCount FROM `rides`",
            {
                type: queryInterface.sequelize.QueryTypes.SELECT,
            },
        );

        if (Number(rows[0].rowCount) > 0) {
            throw new Error(
                "Rollback refused: rides contains data. " +
                "Back up and review the data before removing the table.",
            );
        }

        await queryInterface.dropTable("rides");
    },
};
