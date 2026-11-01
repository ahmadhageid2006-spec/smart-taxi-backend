/*
🎯 الهدف

الـ Service هي المسؤولة عن منطق التعامل مع السيارات، مثل:

إضافة سيارة للسائق.
التأكد إن المستخدم Driver.
التأكد إن السائق ما عنده سيارة مسبقاً.
التأكد إن رقم اللوحة غير مستخدم.
جلب سيارة السائق.
لاحقاً تعديل/حذف السيارة.

والـ Controller ما لازم يحتوي هالمنطق كله*/

const { Car, User, Ride } = require("../models/associations");
const AppError = require("../utils/appError");

const createCar = async (userId, carData) => {
    // التأكد إن المستخدم موجود
    const user = await User.findByPk(userId);
    if (!user) {
        throw new AppError("المستخدم غير موجود", 404);
    }

    // التأكد إن المستخدم Driver
    if (user.role !== "DRIVER") {
        throw new AppError("المستخدم ليس سائقاً", 400);
    }

    // التأكد إن السائق ما عنده سيارة مسبقاً
    const existingCar = await Car.findOne({
        where: {
            userId: userId,
        },
    });
    if (existingCar) {
        throw new AppError("السائق عنده سيارة مسبقاً", 409);
    }

    // التأكد إن رقم اللوحة غير مستخدم
    const existingPlate = await Car.findOne({
        where: {
            plateNumber: carData.plateNumber,
        },
    });
    if (existingPlate) {
        throw new AppError("رقم اللوحة مستخدم بالفعل", 409);
    }

    // إنشاء السيارة
    const car = await Car.create({
        ...carData,
        userId: userId,
    });

    return car;
};

const getMyCar = async (driverId) => {
    const car = await Car.findOne({
        where: {
            userId: driverId
        }
    });

    if (!car) {
        throw new AppError("Car not found", 404);
    }

    return car;
};

const updateMyCar = async (driverId, data) => {
    const car = await Car.findOne({
        where: {
            userId: driverId
        }
    });

    if (!car) {
        throw new AppError("Car not found", 404);
    }

    const {
        type,
        manufacturer,
        model,
        color,
        plateNumber
    } = data;

    if (type !== undefined) {
        if (!["NORMAL", "COMFORT"].includes(type)) {
            throw new AppError(
                "Invalid car type. Must be either 'NORMAL' or 'COMFORT'"
                , 400);
        }

        car.type = type;
    }

    if (manufacturer !== undefined) {
        car.manufacturer = manufacturer;
    }

    if (model !== undefined) {
        car.model = model;
    }

    if (color !== undefined) {
        car.color = color;
    }

    if (
        plateNumber !== undefined &&
        plateNumber !== car.plateNumber
    ) {
        const existingCar = await Car.findOne({
            where: {
                plateNumber
            }
        });

        if (existingCar) {
            throw new AppError(
                "Plate number is already in use"
                , 409);
        }

        car.plateNumber = plateNumber;
    }

    await car.save();

    return car;
};
const deleteMyCar = async (driverId) => {
    const car = await Car.findOne({
        where: {
            userId: driverId
        }
    });

    if (!car) {
        throw new AppError("Car not found", 404);
    }

    const driver = await User.findByPk(driverId, {
        attributes: ["id", "driverStatus"]
    });

    if (driver && ["ONLINE", "BUSY"].includes(driver.driverStatus)) {
        throw new AppError(
            "Driver cannot delete the car while ONLINE or BUSY.",
            409
        );
    }

    const rideCount = await Ride.count({
        where: {
            carId: car.id
        }
    });

    if (rideCount > 0) {
        throw new AppError(
            "Cannot delete a car that is associated with rides"
            , 409);
    }

    await car.destroy();

    return {
        message: "Car deleted successfully"
    };
};

module.exports = {
    createCar,
    getMyCar,
    updateMyCar,
    deleteMyCar
};