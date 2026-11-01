const { Transaction } = require("sequelize");
const sequelize = require("../config/database");
const { User, Car } = require("../models/associations");
const AppError = require("../utils/appError");

const getDriver = async (driverId, transaction) => {
  const driver = await User.findByPk(driverId, {
    attributes: ["id", "role", "driverStatus"],
    transaction,
    lock: transaction ? Transaction.LOCK.UPDATE : undefined
  });

  if (!driver) {
    throw new AppError("Driver not found", 404);
  }

  if (driver.role !== "DRIVER") {
    throw new AppError("Only drivers can manage driver status", 403);
  }

  return driver;
};

const getStatus = async (driverId) => {
  const driver = await getDriver(driverId);
  return { driverStatus: driver.driverStatus };
};

const updateStatus = async (driverId, requestedStatus) => {
  if (!["ONLINE", "OFFLINE"].includes(requestedStatus)) {
    throw new AppError(
      "Drivers can only request ONLINE or OFFLINE status",
      400
    );
  }

  return sequelize.transaction(async (transaction) => {
    const driver = await getDriver(driverId, transaction);

    if (requestedStatus === "ONLINE") {
      const car = await Car.findOne({
        where: { userId: driverId },
        attributes: ["id"],
        transaction
      });

      if (!car) {
        throw new AppError(
          "Driver must have a registered car before going online",
          409
        );
      }

      if (driver.driverStatus === "BUSY") {
        throw new AppError(
          "Driver cannot go online while handling a ride",
          409
        );
      }
    }

    if (requestedStatus === "OFFLINE" && driver.driverStatus === "BUSY") {
      throw new AppError(
        "Driver cannot go offline while handling a ride",
        409
      );
    }

    driver.driverStatus = requestedStatus;
    await driver.save({ transaction });

    return { driverStatus: driver.driverStatus };
  });
};

const updateLocation = async (driverId, location) => {
  const driver = await User.findByPk(driverId, {
    attributes: ["id", "role", "isBlocked"]
  });

  if (!driver) {
    throw new AppError("Driver not found", 404);
  }

  if (driver.role !== "DRIVER") {
    throw new AppError("Only drivers can update driver location", 403);
  }

  if (driver.isBlocked) {
    throw new AppError("Blocked drivers cannot update their location", 409);
  }

  await driver.update({
    currentLatitude: location.latitude,
    currentLongitude: location.longitude
  });

  return {
    currentLatitude: Number(driver.currentLatitude),
    currentLongitude: Number(driver.currentLongitude)
  };
};

module.exports = {
  getDriver,
  getStatus,
  updateStatus,
  updateLocation
};
