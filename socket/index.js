const { Server } = require("socket.io");
const corsOptions = require("../config/cors");
const authenticateSocket = require("./auth");
const { joinPrivateRoom } = require("./rooms");

let io;
const socketsByUserId = new Map();

const registerSocket = (socket) => {
  const userId = socket.data && socket.data.user && socket.data.user.id;

  if (!userId) {
    return;
  }

  // قد يملك المستخدم أكثر من اتصال؛ Set يمنع تكرار نفس socket ويسمح
  // بإلغاء جميع جلساته عند حظره.
  const sockets = socketsByUserId.get(userId) || new Set();
  sockets.add(socket);
  socketsByUserId.set(userId, sockets);
};

const unregisterSocket = (socket) => {
  const userId = socket.data && socket.data.user && socket.data.user.id;
  const sockets = socketsByUserId.get(userId);

  if (!sockets) {
    return;
  }

  sockets.delete(socket);
  if (sockets.size === 0) {
    socketsByUserId.delete(userId);
  }
};

const revokeUserSockets = (userId) => {
  const sockets = socketsByUserId.get(userId);

  if (!sockets) {
    return;
  }

  for (const socket of [...sockets]) {
    socket.disconnect(true);
  }
};

const initializeSocket = (httpServer) => {
  if (io) {
    return io;
  }

  // تعيد initializeSocket المرجع الموجود ما دام io مضبوطاً؛ وإغلاق instance
  // لا يصفر هذا المرجع تلقائياً، لذلك لا يجوز افتراض أن إعادة التهيئة
  // داخل العملية نفسها ستعمل دون دعم صريح لذلك.
  io = new Server(httpServer, {
    cors: corsOptions
  });

  io.use(authenticateSocket);

  io.on("connection", async (socket) => {
    try {
      await joinPrivateRoom(socket);
    } catch (error) {
      console.error("Failed to join authenticated socket room.");
      socket.disconnect(true);
      return;
    }

    registerSocket(socket);
    socket.on("disconnect", () => unregisterSocket(socket));
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }

  return io;
};

module.exports = {
  initializeSocket,
  getIO,
  registerSocket,
  unregisterSocket,
  revokeUserSockets
};
