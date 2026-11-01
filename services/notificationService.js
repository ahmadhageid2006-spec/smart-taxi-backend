const { Op } = require("sequelize");
const { Notification } = require("../models/associations");
const AppError = require("../utils/appError");

const NOTIFICATION_TYPES = Object.freeze({
  RIDE_ACCEPTED: "RIDE_ACCEPTED",
  RIDE_STARTED: "RIDE_STARTED",
  RIDE_COMPLETED: "RIDE_COMPLETED",
  RIDE_CANCELLED: "RIDE_CANCELLED",
  NO_DRIVER_FOUND: "NO_DRIVER_FOUND"
});

const messageFor = (type, actorRole) => {
  const messages = {
    RIDE_ACCEPTED: ["تم قبول رحلتك", "تم قبول رحلتك من قبل السائق."],
    RIDE_STARTED: ["بدأت الرحلة", "بدأ السائق رحلتك."],
    RIDE_COMPLETED: ["اكتملت الرحلة", "اكتملت رحلتك بنجاح."],
    NO_DRIVER_FOUND: ["لم يتم العثور على سائق", "لم يتم العثور على سائق لرحلتك حالياً."],
    RIDE_CANCELLED:
      actorRole === "DRIVER"
        ? ["ألغى السائق الرحلة", "ألغى السائق الرحلة المقبولة."]
        : ["ألغى الراكب الرحلة", "ألغى الراكب الرحلة المقبولة."]
  };

  return messages[type];
};

const getDeduplicationKey = (rideId, type, userId) =>
  `ride:${rideId}:${type}:recipient:${userId}`;

const serializeNotification = (notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  metadata: notification.metadata,
  rideId: notification.rideId,
  readAt: notification.readAt,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt
});

const isDeduplicationError = (error) => {
  if (!error) {
    return false;
  }

  const fields = error.fields || {};
  if (
    error.name === "SequelizeUniqueConstraintError" &&
    Object.prototype.hasOwnProperty.call(fields, "deduplicationKey")
  ) {
    return true;
  }

  return (
    error.original &&
    error.original.code === "ER_DUP_ENTRY" &&
    String(error.original.message || "").includes("deduplicationKey")
  );
};

const createNotification = async ({
  userId,
  recipientRole,
  type,
  rideId,
  actorRole,
  metadata = {},
  transaction
}) => {
  if (!userId || !recipientRole || !NOTIFICATION_TYPES[type]) {
    throw new AppError("Invalid notification context", 500);
  }

  const [title, message] = messageFor(type, actorRole);
  const deduplicationKey = getDeduplicationKey(rideId, type, userId);
  const values = {
    userId,
    type,
    title,
    message,
    metadata: { ...metadata, rideId },
    rideId,
    deduplicationKey
  };

  try {
    const notification = await Notification.create(values, { transaction });
    return { notification, created: true, recipientRole };
  } catch (error) {
    if (!isDeduplicationError(error)) {
      throw error;
    }

    const existing = await Notification.findOne({
      where: { deduplicationKey },
      transaction,
      rejectOnEmpty: false
    });

    if (!existing) {
      throw error;
    }

    return { notification: existing, created: false, recipientRole };
  }
};

const listNotifications = async (userId, { page = 1, limit = 20, unreadOnly = false }) => {
  const where = { userId };
  if (unreadOnly) {
    where.readAt = { [Op.is]: null };
  }

  const result = await Notification.findAndCountAll({
    where,
    attributes: [
      "id",
      "type",
      "title",
      "message",
      "metadata",
      "rideId",
      "readAt",
      "createdAt",
      "updatedAt"
    ],
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit,
    offset: (page - 1) * limit
  });

  return {
    items: result.rows.map(serializeNotification),
    pagination: {
      page,
      limit,
      total: result.count,
      totalPages: Math.ceil(result.count / limit)
    }
  };
};

const countUnread = (userId) =>
  Notification.count({
    where: { userId, readAt: { [Op.is]: null } }
  });

const markAsRead = async (userId, notificationId) => {
  const notification = await Notification.findOne({
    where: { id: notificationId, userId },
    attributes: [
      "id",
      "type",
      "title",
      "message",
      "metadata",
      "rideId",
      "readAt",
      "createdAt",
      "updatedAt"
    ]
  });

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }

  return serializeNotification(notification);
};

const markAllAsRead = async (userId) => {
  const [updatedCount] = await Notification.update(
    { readAt: new Date() },
    { where: { userId, readAt: { [Op.is]: null } } }
  );
  return { updatedCount };
};

module.exports = {
  NOTIFICATION_TYPES,
  getDeduplicationKey,
  serializeNotification,
  createNotification,
  listNotifications,
  countUnread,
  markAsRead,
  markAllAsRead
};
