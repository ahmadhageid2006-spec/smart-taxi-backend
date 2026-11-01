const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  role: {
    type: DataTypes.ENUM("PASSENGER", "DRIVER", "ADMIN"),
    defaultValue: "PASSENGER",
  },
  driverStatus: {
    type: DataTypes.ENUM("OFFLINE", "ONLINE", "BUSY"),
    allowNull: false,
    defaultValue: "OFFLINE",
  },
  isBlocked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  blockedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  blockReason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  currentLatitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  currentLongitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
}, {
  tableName: "users",
  timestamps: true, // بيضيف automáticamente created_at و updated_at
}); 
module.exports = User;