const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Car = sequelize.define(
  "Car",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "users",
        key: "id",
      },
    },

    type: {
      type: DataTypes.ENUM("NORMAL", "COMFORT"),
      allowNull: false,
    },

    manufacturer: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    model: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    color: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    plateNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "cars",
    timestamps: true,
  }
);

module.exports = Car;
