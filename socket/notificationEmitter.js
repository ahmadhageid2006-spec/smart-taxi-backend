const { getIO } = require("./index");
const { getPrivateRoomName } = require("./rooms");

const emitNotification = (notification, recipientRole) => {
  const room = getPrivateRoomName({
    id: notification.userId,
    role: recipientRole
  });

  if (!room) {
    throw new Error("A valid recipient role is required for notification delivery");
  }

  const payload = {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    metadata: notification.metadata,
    rideId: notification.rideId,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt
  };

  getIO().to(room).emit("notification:new", payload);
};

module.exports = { emitNotification };
