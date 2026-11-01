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
    const requiredTables = ["users", "rides"];

    const missingTables = requiredTables.filter(
        (tableName) => !tablesBefore.has(tableName),
    );

    if (missingTables.length > 0) {
        throw new Error(
            `Cannot create notifications. Missing required tables: ${missingTables.join(", ")}`,
        );
    }

    // Never overwrite an existing table.
    if (tablesBefore.has("notifications")) {
        throw new Error(
            'Cannot create notifications because a table named "notifications" already exists.',
        );
    }

    try {
        await queryInterface.createTable("notifications", {
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

            type: {
                type: DataTypes.ENUM(
                    "RIDE_ACCEPTED",
                    "RIDE_STARTED",
                    "RIDE_COMPLETED",
                    "RIDE_CANCELLED",
                    "NO_DRIVER_FOUND",
                ),
                allowNull: false,
            },

            title: {
                type: DataTypes.STRING(150),
                allowNull: false,
            },

            message: {
                type: DataTypes.STRING(500),
                allowNull: false,
            },

            metadata: {
                type: DataTypes.JSON,
                allowNull: true,
            },

            rideId: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },

            readAt: {
                type: DataTypes.DATE,
                allowNull: true,
            },

            deduplicationKey: {
                type: DataTypes.STRING(191),
                allowNull: false,
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

        // A notification must belong to an existing user.
        await queryInterface.addConstraint("notifications", {
            fields: ["userId"],
            type: "foreign key",
            name: "fk_notifications_user",
            references: {
                table: "users",
                field: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
        });

        // A notification may reference a ride that is later deleted.
        // In that case, retain the notification and clear rideId.
        await queryInterface.addConstraint("notifications", {
            fields: ["rideId"],
            type: "foreign key",
            name: "fk_notifications_ride",
            references: {
                table: "rides",
                field: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        });

        // Prevent duplicate notifications with the same deduplication key.
        await queryInterface.addConstraint("notifications", {
            fields: ["deduplicationKey"],
            type: "unique",
            name: "uq_notifications_deduplication_key",
        });

        // Support notification history queries for a user.
        await queryInterface.addIndex("notifications", ["userId", "createdAt"], {
            name: "notifications_user_id_created_at",
        });

        // Support queries filtering a user's read/unread notifications.
        await queryInterface.addIndex("notifications", ["userId", "readAt"], {
            name: "notifications_user_id_read_at",
        });
    } catch (error) {
        // MySQL DDL may not roll back as one transaction.
        // Clean up only a table created by this migration.
        const tablesAfter = await getTableNames(queryInterface);

        if (!tablesBefore.has("notifications") && tablesAfter.has("notifications")) {
            try {
                await queryInterface.dropTable("notifications");
            } catch (cleanupError) {
                error.cleanupError = cleanupError;
            }
        }

        throw error;
    }
},

async down({ context: queryInterface }) {
    const tables = await getTableNames(queryInterface);

    if (!tables.has("notifications")) {
        return;
    }

    // Protect notifications created after this migration.
    const rows = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS rowCount FROM `notifications`",
        {
            type: queryInterface.sequelize.QueryTypes.SELECT,
        },
    );

    if (Number(rows[0].rowCount) > 0) {
        throw new Error(
            "Rollback refused: notifications contains data. " +
            "Back up and review the data before removing the table.",
        );
    }

    await queryInterface.dropTable("notifications");
},

};
