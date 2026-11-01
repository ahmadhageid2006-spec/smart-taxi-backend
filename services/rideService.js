const { Ride, User, Car } = require("../models/associations");
const sequelize = require("../config/database");
const { Transaction } = require("sequelize");
const routingService = require("./routingService");
const { calculatePrice } = require("./pricingService");
const AppError = require("../utils/appError");
const rideOfferService = require("./rideOfferService");
const notificationService = require("./notificationService");
const { emitNotification } = require("../socket/notificationEmitter");

const emitPersistedNotification = (result) => {
    if (!result || !result.created) {
        return;
    }

    try {
        emitNotification(result.notification, result.recipientRole);
    } catch (error) {
        console.error("Failed to emit persisted notification.");
    }
};

// تضع Middleware فحوص الهوية والدور الأولية، بينما تضيف عمليات Service
// فحوص الدور وقواعد الأعمال اللازمة حيث يطبقها التنفيذ؛ ويُمرر أثر dispatch
// إلى provider بعد نجاح عملية الأعمال.

// =========================
// Create Ride
// =========================
const createRide = async (
    userId,
    rideData,
    routingProvider = routingService,
    dispatchProvider = rideOfferService
) => {
    // نعيد فحص الدور من قاعدة البيانات داخل Service؛ فالتحقق في Middleware
    // وحده لا يكفي إذا استُخدمت الخدمة من مسار داخلي آخر.
    const user = await User.findByPk(userId, {
        attributes: ["id", "role"]
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    if (user.role !== "PASSENGER") {
        throw new AppError("Only passengers can create rides", 400);
    }

    if (
        !rideData.pickupAddress ||
        !rideData.destinationAddress
    ) {
        throw new AppError(
            "Pickup and destination addresses are required"
        , 400);
    }

    if (
        rideData.pickupAddress ===
        rideData.destinationAddress
    ) {
        throw new AppError(
            "Pickup and destination addresses cannot be the same"
        , 400);
    }

    if (
        !["NORMAL", "COMFORT"].includes(rideData.rideType)
    ) {
        throw new AppError(
            "Invalid ride type. Must be either 'NORMAL' or 'COMFORT'"
        , 400);
    }


    // =========================
    // Coordinates
    // =========================

    const {
        pickupLatitude,
        pickupLongitude,
        destinationLatitude,
        destinationLongitude
    } = rideData;

    if (
        pickupLatitude === undefined ||
        pickupLongitude === undefined ||
        destinationLatitude === undefined ||
        destinationLongitude === undefined
    ) {
        throw new AppError(
            "Pickup and destination coordinates are required"
        , 400);
    }


    // Validate Latitude

    if (
        pickupLatitude < -90 ||
        pickupLatitude > 90 ||
        destinationLatitude < -90 ||
        destinationLatitude > 90
    ) {
        throw new AppError("Invalid latitude", 400);
    }


    // Validate Longitude

    if (
        pickupLongitude < -180 ||
        pickupLongitude > 180 ||
        destinationLongitude < -180 ||
        destinationLongitude > 180
    ) {
        throw new AppError("Invalid longitude", 400);
    }


    // =========================
    // Scheduled Ride
    // =========================

    if (rideData.scheduledAt) {
        const scheduledDate = new Date(
            rideData.scheduledAt
        );

        if (Number.isNaN(scheduledDate.getTime())) {
            throw new AppError("Invalid scheduled date", 400);
        }

        if (scheduledDate <= new Date()) {
            throw new AppError(
                "Scheduled time must be in the future"
                , 400);
        }
    }


    // =========================
    // Calculate Road Distance
    // =========================

    // حساب المسافة قابل للاستبدال عبر provider، لكن إنشاء الرحلة والتسعير
    // يمران دائماً عبر هذه الخدمة ولا يتم تجاوز قواعدهما في الاختبارات.
    const distanceKm = await routingProvider.calculateRoadDistance(
        {
            latitude: pickupLatitude,
            longitude: pickupLongitude
        },
        {
            latitude: destinationLatitude,
            longitude: destinationLongitude
        }
    );


    // =========================
    // Calculate Price
    // =========================

    const price = calculatePrice(
        distanceKm,
        rideData.rideType
    );


    // =========================
    // Create Ride
    // =========================

    const ride = await Ride.create({
        userId,

        workerId: null,

        carId: null,

        status: "PENDING",

        pickupAddress: rideData.pickupAddress,

        destinationAddress: rideData.destinationAddress,

        pickupLatitude,

        pickupLongitude,

        destinationLatitude,

        destinationLongitude,

        rideType: rideData.rideType,

        scheduledAt: rideData.scheduledAt || null,

        distanceKm,

        price
    });

    // يبدأ dispatch بعد حفظ PENDING؛ ففشل بدء العروض لا يلغي الرحلة
    // المنشأة، لكنه يُسجل حتى لا يتحول الفشل إلى تجاهل صامت.
    dispatchProvider.startDispatch(ride.id).catch(() => {
        console.error(
            `Failed to initialize ride offer dispatch for ride ${ride.id}.`
        );
    });

    return ride;
};


// =========================
// Accept Ride
// =========================

const acceptRide = async (
    rideId,
    driverId,
    dispatchProvider = rideOfferService
) => {
    // قفل Ride أولاً ينسق طلبات القبول المتنافسة على السجل نفسه.
    // تحديث Ride وDriver داخل المعاملة يجعل التعيين وتحوّل ONLINE إلى BUSY
    // ينجحان أو يتراجعان معاً؛ أما إيقاف dispatch فيحدث بعد commit.
    let acceptanceNotification;
    const acceptedRide = await sequelize.transaction(async (transaction) => {
        const ride = await Ride.findByPk(rideId, {
            transaction,
            lock: Transaction.LOCK.UPDATE
        });

        if (!ride) {
            throw new AppError("Ride not found", 404);
        }

        if (ride.status !== "PENDING") {
            throw new AppError("Only pending rides can be accepted", 409);
        }

        const driver = await User.findByPk(driverId, {
            attributes: ["id", "role", "driverStatus", "isBlocked"],
            transaction,
            lock: Transaction.LOCK.UPDATE
        });

        if (!driver) {
            throw new AppError("Driver not found", 404);
        }

        if (driver.role !== "DRIVER") {
            throw new AppError("Only drivers can accept rides", 400);
        }

        if (driver.isBlocked) {
            throw new AppError("Blocked drivers cannot accept rides", 409);
        }

        if (driver.driverStatus !== "ONLINE") {
            throw new AppError("Driver must be ONLINE to accept rides", 409);
        }

        const car = await Car.findOne({
            where: { userId: driverId },
            attributes: ["id", "type"],
            transaction
        });

        if (!car) {
            throw new AppError("Driver does not have a car", 409);
        }

        if (
            ride.rideType === "COMFORT" &&
            car.type !== "COMFORT"
        ) {
            throw new AppError(
                "A COMFORT ride requires a COMFORT car",
                409
            );
        }

        // شرط PENDING ليس بديلاً عن القفل، بل safeguard إضافي يرفض
        // أي تحديث وصل بعد أن تغيّرت حالة الرحلة.
        const [affectedCount] = await Ride.update(
            {
                workerId: driverId,
                carId: car.id,
                status: "ACCEPTED"
            },
            {
                where: { id: rideId, status: "PENDING" },
                transaction
            }
        );

        if (affectedCount === 0) {
            throw new AppError(
                "Ride has already been accepted by another driver",
                409
            );
        }

        const [driverUpdated] = await User.update(
            { driverStatus: "BUSY" },
            {
                where: {
                    id: driverId,
                    role: "DRIVER",
                    driverStatus: "ONLINE"
                },
                transaction
            }
        );

        if (driverUpdated === 0) {
            throw new AppError(
                "Driver is no longer available to accept rides",
                409
            );
        }

        acceptanceNotification = await notificationService.createNotification({
            userId: ride.userId,
            recipientRole: "PASSENGER",
            type: notificationService.NOTIFICATION_TYPES.RIDE_ACCEPTED,
            rideId: ride.id,
            actorRole: "DRIVER",
            metadata: { actorId: driverId },
            transaction
        });

        return Ride.findByPk(rideId, { transaction });
    });

    dispatchProvider.stopDispatch(rideId);
    emitPersistedNotification(acceptanceNotification);
    return acceptedRide;
};


// =========================
// Start Ride
// =========================

const startRide = async (rideId, driverId) => {
    let startNotification;
    const startedRide = await sequelize.transaction(async (transaction) => {
        const ride = await Ride.findByPk(rideId, {
            transaction,
            lock: Transaction.LOCK.UPDATE
        });

        if (!ride) {
            throw new AppError("Ride not found", 404);
        }

        if (ride.status !== "ACCEPTED") {
            throw new AppError("Only accepted rides can be started", 409);
        }

        if (ride.workerId !== driverId) {
            throw new AppError(
                "Only the assigned driver can start the ride",
                403
            );
        }

        const driver = await User.findByPk(driverId, {
            attributes: ["id", "driverStatus"],
            transaction,
            lock: Transaction.LOCK.UPDATE
        });

        if (!driver || driver.driverStatus !== "BUSY") {
            throw new AppError(
                "Driver must be BUSY to start the ride",
                409
            );
        }

        ride.status = "IN_PROGRESS";
        ride.startAt = new Date();
        await ride.save({ transaction });

        startNotification = await notificationService.createNotification({
            userId: ride.userId,
            recipientRole: "PASSENGER",
            type: notificationService.NOTIFICATION_TYPES.RIDE_STARTED,
            rideId: ride.id,
            actorRole: "DRIVER",
            metadata: { actorId: driverId },
            transaction
        });

        return ride;
    });

    emitPersistedNotification(startNotification);
    return startedRide;
};


// =========================
// Complete Ride
// =========================

const completeRide = async (
    rideId,
    driverId,
    dispatchProvider = rideOfferService
) => {
    let completionNotification;
    const completedRide = await sequelize.transaction(async (transaction) => {
        const ride = await Ride.findByPk(rideId, {
            transaction,
            lock: Transaction.LOCK.UPDATE
        });

        if (!ride) {
            throw new AppError("Ride not found", 404);
        }

        if (!ride.workerId) {
            throw new AppError("Ride is not assigned to a driver", 409);
        }

        if (ride.status !== "IN_PROGRESS") {
            throw new AppError(
                "Only in-progress rides can be completed",
                409
            );
        }

        if (ride.workerId !== driverId) {
            throw new AppError(
                "Only the assigned driver can complete the ride",
                403
            );
        }

        const [driverUpdated] = await User.update(
            { driverStatus: "ONLINE" },
            {
                where: {
                    id: driverId,
                    role: "DRIVER",
                    driverStatus: "BUSY"
                },
                transaction
            }
        );

        if (driverUpdated === 0) {
            throw new AppError(
                "Driver is not currently handling this ride",
                409
            );
        }

        ride.status = "COMPLETED";
        ride.completedAt = new Date();
        await ride.save({ transaction });

        completionNotification = await notificationService.createNotification({
            userId: ride.userId,
            recipientRole: "PASSENGER",
            type: notificationService.NOTIFICATION_TYPES.RIDE_COMPLETED,
            rideId: ride.id,
            actorRole: "DRIVER",
            metadata: { actorId: driverId },
            transaction
        });

        return ride;
    });

    dispatchProvider.stopDispatch(rideId);
    emitPersistedNotification(completionNotification);
    return completedRide;
};


// =========================
// Cancel Ride
// =========================

const cancelRide = async (
    rideId,
    userId,
    role,
    cancelReason,
    dispatchProvider = rideOfferService
) => {
    let cancellationNotification;
    const cancelledRide = await sequelize.transaction(async (transaction) => {
        const ride = await Ride.findByPk(rideId, {
            transaction,
            lock: Transaction.LOCK.UPDATE
        });

        if (!ride) {
            throw new AppError("Ride not found", 404);
        }

        if (role === "PASSENGER") {
            if (ride.userId !== userId) {
                throw new AppError(
                    "You can only cancel your own ride",
                    403
                );
            }

            if (!["PENDING", "ACCEPTED"].includes(ride.status)) {
                throw new AppError(
                    "Only pending or accepted rides can be cancelled",
                    409
                );
            }
        } else if (role === "DRIVER") {
            if (ride.workerId !== userId) {
                throw new AppError(
                    "Only the assigned driver can cancel this ride",
                    403
                );
            }

            if (ride.status !== "ACCEPTED") {
                throw new AppError(
                    "Drivers can only cancel accepted rides",
                    409
                );
            }
        } else {
            throw new AppError(
                "Only passengers and drivers can cancel rides",
                400
            );
        }

        if (ride.status === "ACCEPTED") {
            const [driverUpdated] = await User.update(
                { driverStatus: "ONLINE" },
                {
                    where: {
                        id: ride.workerId,
                        role: "DRIVER",
                        driverStatus: "BUSY"
                    },
                    transaction
                }
            );

            if (driverUpdated === 0) {
                throw new AppError(
                    "Assigned driver is not currently handling this ride",
                    409
                );
            }
        }

        ride.status = "CANCELLED";
        ride.cancelAt = new Date();
        ride.cancelReason = cancelReason || null;
        await ride.save({ transaction });

        if (ride.status === "CANCELLED" && ride.workerId) {
            const recipientId = role === "PASSENGER" ? ride.workerId : ride.userId;
            const recipientRole = role === "PASSENGER" ? "DRIVER" : "PASSENGER";
            cancellationNotification = await notificationService.createNotification({
                userId: recipientId,
                recipientRole,
                type: notificationService.NOTIFICATION_TYPES.RIDE_CANCELLED,
                rideId: ride.id,
                actorRole: role,
                metadata: { actorId: userId },
                transaction
            });
        }

        return ride;
    });

    dispatchProvider.stopDispatch(rideId);
    emitPersistedNotification(cancellationNotification);
    return cancelledRide;
};const getAvailableRides = async (rideType) => {
    const where = {
        status: "PENDING"
    };

    if (rideType !== undefined) {
        if (!["NORMAL", "COMFORT"].includes(rideType)) {
            throw new AppError(
                "Invalid ride type. Must be either 'NORMAL' or 'COMFORT'"
                , 400);
        }

        where.rideType = rideType;
    }

    const rides = await Ride.findAll({
        where,
        include: [
            {
                model: User,
                as: "passenger",
                attributes: [
                    "id",
                    "fullName",
                    "phone"
                ]
            }
        ],
        order: [["createdAt", "DESC"]]
    });

    return rides;
};

const getRideById = async (rideId, userId, role) => {
    const ride = await Ride.findByPk(rideId, {
        include: [
            {
                model: User,
                as: "passenger",
                attributes: ["id", "fullName", "phone"]
            },
            {
                model: User,
                as: "driver",
                attributes: ["id", "fullName", "phone"]
            },
            {
                model: Car,
                as: "car",
                attributes: [
                    "id",
                    "type",
                    "manufacturer",
                    "model",
                    "color",
                    "plateNumber"
                ]
            }
        ]
    });

    if (!ride) {
        throw new AppError("Ride not found", 404);
    }

    if (role === "PASSENGER" && ride.userId !== userId) {
        throw new AppError("You can only view your own rides", 403);
    }

    if (role === "DRIVER" && ride.workerId !== userId) {
        throw new AppError("You can only view rides assigned to you", 403);
    }

    return ride;
};

const getMyRides = async (userId, role) => {
    let where = {};

    if (role === "PASSENGER") {
        where.userId = userId;
    } else if (role === "DRIVER") {
        where.workerId = userId;
    } else {
        throw new AppError(
            "Only passengers and drivers can view their rides"
            , 400);
    }

    const rides = await Ride.findAll({
        where,
        include: [
            {
                model: User,
                as: "passenger",
                attributes: [
                    "id",
                    "fullName",
                    "phone"
                ]
            },
            {
                model: User,
                as: "driver",
                attributes: [
                    "id",
                    "fullName",
                    "phone"
                ]
            },
            {
                model: Car,
                as: "car",
                attributes: [
                    "id",
                    "type",
                    "manufacturer",
                    "model",
                    "color",
                    "plateNumber"
                ]
            }
        ],
        order: [["createdAt", "DESC"]]
    });

    return rides;
};

// =========================
// Exports
// =========================

const createRideService = ({
    routingProvider = routingService,
    dispatchProvider = rideOfferService
} = {}) => ({
    createRide: (userId, rideData) =>
        createRide(userId, rideData, routingProvider, dispatchProvider),
    acceptRide: (rideId, driverId) =>
        acceptRide(rideId, driverId, dispatchProvider),
    startRide,
    completeRide: (rideId, driverId) =>
        completeRide(rideId, driverId, dispatchProvider),
    cancelRide: (rideId, userId, role, cancelReason) =>
        cancelRide(rideId, userId, role, cancelReason, dispatchProvider),
    getAvailableRides,
    getRideById,
    getMyRides
});

const defaultRideService = createRideService();

module.exports = {
    createRide,
    acceptRide,
    startRide,
    completeRide,
    cancelRide,
    getAvailableRides,
    getRideById,
    getMyRides,
    createRideService,
    defaultRideService
};