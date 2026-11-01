const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Ride = sequelize.define(
  "Ride",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
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
      references: {
        model: "users",
        key: "id",
      },
    },
///////////////////////////
    carId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "cars",
        key: "id",
      },
    },
////////////////////////////
    status: {
      type: DataTypes.ENUM(
        "PENDING",
        "ACCEPTED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED"
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
  },
  {
    tableName: "rides",
    timestamps: true,
  }
);

module.exports = Ride;