const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Notification = sequelize.define(
  "Notification",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
        onDelete: "RESTRICT"
      },
      onDelete: "RESTRICT"
    },
    type: {
      type: DataTypes.ENUM(
        "RIDE_ACCEPTED",
        "RIDE_STARTED",
        "RIDE_COMPLETED",
        "RIDE_CANCELLED",
        "NO_DRIVER_FOUND"
      ),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    message: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    },
    rideId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "rides",
        key: "id"
      },
      onDelete: "SET NULL"
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deduplicationKey: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true
    }
  },
  {
    tableName: "notifications",
    timestamps: true,
    indexes: [
      { fields: ["userId", "createdAt"] },
      { fields: ["userId", "readAt"] }
    ]
  }
);

module.exports = Notification;
