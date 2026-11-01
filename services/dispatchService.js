const { Op } = require("sequelize");
const { User, Car, Ride } = require("../models/associations");
const AppError = require("../utils/appError");
const { calculateHaversineDistance } = require("../utils/distance");

const hasValidCoordinatePair = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

const isCarCompatible = (carType, rideType) =>
  carType === "COMFORT" || (carType === "NORMAL" && rideType === "NORMAL");

const selectEligibleDrivers = (ride, drivers, radiusKm) => {
  // يتم استبعاد السجل مبكراً عند غياب إحداثيات pickup، لأن ترتيب السائقين
  // لا معنى له دون نقطة جغرافية صالحة.
  const pickupLatitude = Number(ride.pickupLatitude);
  const pickupLongitude = Number(ride.pickupLongitude);

  if (!hasValidCoordinatePair(pickupLatitude, pickupLongitude)) {
    return [];
  }

  return drivers
    .map((driver) => {
      // الأهلية مركبة: الدور والحظر والحالة والسيارة والموقع والتوافق
      // كلها شروط لازمة قبل حساب المسافة وإدخال السائق في النتائج.
      if (
        driver.currentLatitude === null ||
        driver.currentLatitude === undefined ||
        driver.currentLongitude === null ||
        driver.currentLongitude === undefined
      ) {
        return null;
      }

      const driverLatitude = Number(driver.currentLatitude);
      const driverLongitude = Number(driver.currentLongitude);

      if (
        driver.role !== "DRIVER" ||
        driver.isBlocked ||
        driver.driverStatus !== "ONLINE" ||
        !driver.car ||
        !isCarCompatible(driver.car.type, ride.rideType) ||
        !hasValidCoordinatePair(driverLatitude, driverLongitude)
      ) {
        return null;
      }

      const distanceToPickupKm = calculateHaversineDistance(
        driverLatitude,
        driverLongitude,
        pickupLatitude,
        pickupLongitude
      );

      // هذه الخدمة تطبق نصف القطر الذي استلمته وتستبعد السائق الخارج عنه؛
      // أما المؤقتات والانتقال إلى أنصاف أقطار لاحقة فتديرها rideOfferService.
      if (distanceToPickupKm > radiusKm) {
        return null;
      }

      return {
        driverId: driver.id,
        distanceToPickupKm: Number(distanceToPickupKm.toFixed(2))
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.distanceToPickupKm - right.distanceToPickupKm);
};

const getEligibleDriversForRide = async (rideId, radiusKm) => {
  const ride = await Ride.findByPk(rideId, {
    attributes: [
      "id",
      "userId",
      "status",
      "rideType",
      "pickupAddress",
      "pickupLatitude",
      "pickupLongitude",
      "destinationAddress"
    ]
  });

  if (!ride || ride.status !== "PENDING") {
    return { ride, candidates: [] };
  }

  // required: true يجعل وجود Car المسجلة جزءاً من الاستعلام نفسه،
  // فلا تصل إلى مرحلة الحساب سجلات سائقين بلا مركبة.
  const drivers = await User.findAll({
    where: {
      role: "DRIVER",
      isBlocked: false,
      driverStatus: "ONLINE"
    },
    attributes: [
      "id",
      "role",
      "isBlocked",
      "driverStatus",
      "currentLatitude",
      "currentLongitude"
    ],
    include: [{
      model: Car,
      as: "car",
      attributes: ["type"],
      required: true
    }]
  });

  return {
    ride,
    candidates: selectEligibleDrivers(ride, drivers, radiusKm)
  };
};

const getDispatchCandidates = async (driverId) => {
  const driver = await User.findByPk(driverId, {
    attributes: [
      "id",
      "role",
      "isBlocked",
      "driverStatus",
      "currentLatitude",
      "currentLongitude"
    ],
    include: [{
      model: Car,
      as: "car",
      attributes: ["id", "type"],
      required: false
    }]
  });

  if (!driver) {
    throw new AppError("Driver not found", 404);
  }

  if (driver.role !== "DRIVER") {
    throw new AppError("Only drivers can view dispatch rides", 403);
  }

  if (driver.isBlocked) {
    throw new AppError("Blocked drivers cannot view dispatch rides", 409);
  }

  if (driver.driverStatus !== "ONLINE") {
    throw new AppError("Driver must be ONLINE for dispatch", 409);
  }

  if (!driver.car) {
    throw new AppError("Driver must have a registered car for dispatch", 409);
  }

  const driverLatitude = Number(driver.currentLatitude);
  const driverLongitude = Number(driver.currentLongitude);

  if (
    driver.currentLatitude === null ||
    driver.currentLongitude === null ||
    !hasValidCoordinatePair(driverLatitude, driverLongitude)
  ) {
    throw new AppError(
      "Driver location is required for dispatch",
      409
    );
  }

  // Comfort تقبل النوعين، أما Normal فلا تقبل إلا Normal؛ هذه قاعدة
  // العرض للسائق وليست عملية حجز أو تعيين للرحلة.
  const rideTypes =
    driver.car.type === "COMFORT" ? ["NORMAL", "COMFORT"] : ["NORMAL"];

  const rides = await Ride.findAll({
    where: {
      status: "PENDING",
      rideType: { [Op.in]: rideTypes }
    },
    attributes: [
      "id",
      "rideType",
      "pickupAddress",
      "destinationAddress",
      "pickupLatitude",
      "pickupLongitude",
      "createdAt"
    ],
    order: [["createdAt", "ASC"]]
  });

  return rides
    .map((ride) => {
      const pickupLatitude = Number(ride.pickupLatitude);
      const pickupLongitude = Number(ride.pickupLongitude);

      if (!hasValidCoordinatePair(pickupLatitude, pickupLongitude)) {
        return null;
      }

      return {
        id: ride.id,
        rideType: ride.rideType,
        pickupAddress: ride.pickupAddress,
        destinationAddress: ride.destinationAddress,
        pickupLatitude: pickupLatitude,
        pickupLongitude: pickupLongitude,
        distanceToPickupKm: Number(
          calculateHaversineDistance(
            driverLatitude,
            driverLongitude,
            pickupLatitude,
            pickupLongitude
          ).toFixed(2)
        ),
        createdAt: ride.createdAt
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.distanceToPickupKm - right.distanceToPickupKm);
};

module.exports = {
  getDispatchCandidates,
  getEligibleDriversForRide,
  hasValidCoordinatePair,
  isCarCompatible,
  selectEligibleDrivers
};
