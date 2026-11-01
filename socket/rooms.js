const getPrivateRoomName = (user) => {
  if (!user || !user.id) {
    return null;
  }

  // اسم الغرفة مشتق من هوية الخادم المصادق عليها، وليس من قيمة يختارها
  // العميل، لذلك تبقى الغرفة خاصة بالمستخدم نفسه.
  if (user.role === "DRIVER") {
    return `driver:${user.id}`;
  }

  if (user.role === "PASSENGER") {
    return `customer:${user.id}`;
  }

  return null;
};

const joinPrivateRoom = async (socket) => {
  const roomName = getPrivateRoomName(socket.data && socket.data.user);

  if (roomName) {
    await socket.join(roomName);
  }

  return roomName;
};

module.exports = {
  getPrivateRoomName,
  joinPrivateRoom
};
