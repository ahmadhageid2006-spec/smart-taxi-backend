const { Ride, User } = require("../models/associations");
const dispatchConfig = require("../config/dispatch");
const dispatchService = require("./dispatchService");
const { getIO } = require("../socket");
const notificationService = require("./notificationService");
const { emitNotification } = require("../socket/notificationEmitter");

const activeDispatches = new Map();

// هذه الحالة داخل العملية فقط: لا تمثل queue دائمة ولا تضمن إعادة إرسال
// العروض بعد إعادة تشغيل الخادم.
const getDriverRoom = (driverId) => `driver:${driverId}`;
const getPassengerRoom = (passengerId) => `customer:${passengerId}`;
const getNewCandidates = (candidates, notifiedDriverIds) =>
  candidates.filter(
    (candidate) => !notifiedDriverIds.has(candidate.driverId)
  );

const clearDispatchTimer = (dispatch) => {
  if (dispatch.timer) {
    clearTimeout(dispatch.timer);
    dispatch.timer = null;
  }
};

const stopDispatch = (rideId) => {
  const dispatch = activeDispatches.get(Number(rideId));

  if (!dispatch) {
    return;
  }

  // نضبط stopped قبل حذف الحالة، ثم نلغي المؤقت المسجل ونزيل dispatch
  // من الخريطة؛ أما العمل غير المتزامن الجاري فقد يستمر حتى يصل إلى
  // فحص مناسب أو ينهي تنفيذه، ولا يلغي هذا العلم عمليات قاعدة البيانات الجارية.
  dispatch.stopped = true;
  clearDispatchTimer(dispatch);
  activeDispatches.delete(Number(rideId));
};

const emitOffer = (io, ride, candidate) => {
  const room = getDriverRoom(candidate.driverId);
  const connectedSockets = io.sockets.adapter.rooms.get(room);

  // وجود المرشح في قاعدة البيانات لا يعني أنه متصل الآن؛ نرسل فقط إلى
  // room تحتوي sockets حالية، ولا يوجد هنا ACK أو ضمان معالجة من العميل.
  if (!connectedSockets || connectedSockets.size === 0) {
    return false;
  }

  io.to(room).emit("ride:offer", {
    rideId: ride.id,
    rideType: ride.rideType,
    pickupAddress: ride.pickupAddress,
    destinationAddress: ride.destinationAddress,
    pickupLatitude: Number(ride.pickupLatitude),
    pickupLongitude: Number(ride.pickupLongitude),
    distanceToPickupKm: candidate.distanceToPickupKm
  });

  return true;
};

const runStage = async (dispatch, stageIndex) => {
  if (dispatch.stopped) {
    return;
  }

  const stage = dispatchConfig.stages[stageIndex];
  if (!stage) {
    activeDispatches.delete(dispatch.rideId);
    return;
  }

  // كل مرحلة تعيد قراءة حالة الرحلة والسائقين، لذلك لا تعتمد على snapshot
  // قديم من مرحلة سابقة.
  const { ride, candidates } =
    await dispatchService.getEligibleDriversForRide(
      dispatch.rideId,
      stage.radiusKm
    );

  if (dispatch.stopped || !ride || ride.status !== "PENDING") {
    stopDispatch(dispatch.rideId);
    return;
  }

  const io = getIO();

  for (const candidate of getNewCandidates(
    candidates,
    dispatch.notifiedDriverIds
  )) {
    if (emitOffer(io, ride, candidate)) {
      dispatch.notifiedDriverIds.add(candidate.driverId);
    }
  }

  if (stageIndex === dispatchConfig.stages.length - 1) {
    // قد يشغّل المؤقت المرحلة التالية، أو يستدعي المعالجة النهائية بعد
    // آخر مرحلة؛ ويحتفظ stopDispatch بمرجعه لإلغائه عند القبول أو الإلغاء.
    dispatch.timer = setTimeout(() => {
      dispatch.timer = null;
      finalizeDispatch(dispatch).catch(() => {
        console.error(
          `Ride offer finalization failed for ride ${dispatch.rideId}.`
        );
        stopDispatch(dispatch.rideId);
      });
    }, stage.waitMs);
    return;
  }

  dispatch.timer = setTimeout(() => {
    dispatch.timer = null;
    runStage(dispatch, stageIndex + 1).catch(() => {
      console.error(
        `Ride offer stage ${stageIndex + 1} failed for ride ` +
        `${dispatch.rideId} at radius ${dispatchConfig.stages[stageIndex + 1].radiusKm} km.`
      );
      stopDispatch(dispatch.rideId);
    });
  }, stage.waitMs);
};

const finalizeDispatch = async (dispatch) => {
  if (dispatch.stopped) {
    return;
  }

  // الإشعار النهائي لا يصدر إلا إذا بقيت الرحلة PENDING وبقي الراكب
  // صالحاً؛ وإلا تُزال حالة dispatch بدلاً من إرسال نتيجة قديمة.
  const ride = await Ride.findByPk(dispatch.rideId, {
    attributes: ["id", "userId", "status"]
  });

  if (dispatch.stopped || !ride || ride.status !== "PENDING") {
    stopDispatch(dispatch.rideId);
    return;
  }

  const passenger = await User.findByPk(ride.userId, {
    attributes: ["id", "role", "isBlocked"]
  });

  if (
    dispatch.stopped ||
    !passenger ||
    passenger.role !== "PASSENGER" ||
    passenger.isBlocked
  ) {
    stopDispatch(dispatch.rideId);
    return;
  }

  const io = getIO();
  activeDispatches.delete(dispatch.rideId);

  let persistentNotification;
  try {
    persistentNotification = await notificationService.createNotification({
      userId: passenger.id,
      recipientRole: "PASSENGER",
      type: notificationService.NOTIFICATION_TYPES.NO_DRIVER_FOUND,
      rideId: ride.id,
      metadata: {},
    });
  } catch (error) {
    console.error(
      `Failed to persist no-driver notification for ride ${ride.id}.`
    );
  }

  if (persistentNotification && persistentNotification.created) {
    try {
      emitNotification(
        persistentNotification.notification,
        persistentNotification.recipientRole
      );
    } catch (error) {
      console.error("Failed to emit persisted notification.");
    }
  }

  io.to(getPassengerRoom(ride.userId)).emit("ride:no-driver-found", {
    rideId: ride.id
  });
};

const startDispatch = async (rideId) => {
  const normalizedRideId = Number(rideId);

  // هذا الحارس الموجود في الذاكرة يمنع محاولات dispatch المكررة لنفس الرحلة
  // داخل عملية Node.js الحالية، ولا يوفر تنسيقاً بين عمليات أو خوادم متعددة.
  if (activeDispatches.has(normalizedRideId)) {
    return;
  }

  const dispatch = {
    rideId: normalizedRideId,
    notifiedDriverIds: new Set(),
    timer: null,
    stopped: false
  };

  activeDispatches.set(normalizedRideId, dispatch);

  try {
    const ride = await Ride.findByPk(normalizedRideId, {
      attributes: ["id", "status"]
    });

    if (!ride || ride.status !== "PENDING") {
      stopDispatch(normalizedRideId);
      return;
    }

    await runStage(dispatch, 0);
  } catch (error) {
    stopDispatch(normalizedRideId);
    throw error;
  }
};

const stopAllDispatches = () => {
  for (const rideId of activeDispatches.keys()) {
    stopDispatch(rideId);
  }
};

module.exports = {
  startDispatch,
  stopDispatch,
  stopAllDispatches,
  getNewCandidates
};
