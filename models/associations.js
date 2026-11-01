const User = require("./user");
const Car = require("./car");
const Ride = require("./ride");
const RefreshToken = require("./refreshToken");
const SavedAddress = require("./savedAddress");
const Notification = require("./notification");

// User ↔ Car
User.hasOne(Car, {
  foreignKey: "userId",
  as: "car",
});

Car.belongsTo(User, {
  foreignKey: "userId",
  as: "owner",
});

// User ↔ Ride (Passenger)
User.hasMany(Ride, {
  foreignKey: "userId",
  as: "rides",
});

Ride.belongsTo(User, {
  foreignKey: "userId",
  as: "passenger",
});

// User ↔ Ride (Driver)
User.hasMany(Ride, {
  foreignKey: "workerId",
  as: "drivenRides",
});

Ride.belongsTo(User, {
  foreignKey: "workerId",
  as: "driver",
});

// Car ↔ Ride
Car.hasMany(Ride, {
  foreignKey: "carId",
  as: "rides",
});

Ride.belongsTo(Car, {
  foreignKey: "carId",
  as: "car",
});

User.hasMany(RefreshToken, {
  foreignKey: "userId",
  as: "refreshTokens"
});

RefreshToken.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
});

User.hasMany(SavedAddress, {
  foreignKey: "userId",
  as: "savedAddresses"
});

SavedAddress.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
});

User.hasMany(Notification, {
  foreignKey: "userId",
  as: "notifications"
});

Notification.belongsTo(User, {
  foreignKey: "userId",
  as: "recipient"
});

Ride.hasMany(Notification, {
  foreignKey: "rideId",
  as: "notifications"
});

Notification.belongsTo(Ride, {
  foreignKey: "rideId",
  as: "ride"
});

module.exports = {
  User,
  Car,
  Ride,
  RefreshToken,
  SavedAddress,
  Notification
};