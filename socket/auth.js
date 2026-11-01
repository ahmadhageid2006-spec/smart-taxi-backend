const jwt = require("jsonwebtoken");
const User = require("../models/user");

const authenticateSocket = async (socket, next) => {
  // لا نثق بهوية يرسلها العميل داخل payload؛ مصدر الهوية الوحيد هو
  // JWT ثم User الموجود فعلياً في قاعدة البيانات.
  const token = socket.handshake.auth && socket.handshake.auth.token;

  if (typeof token !== "string" || !token) {
    return next(new Error("Authentication required"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return next(new Error("Authentication failed"));
    }

    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "role", "isBlocked"]
    });

    if (!user || user.isBlocked) {
      return next(new Error("Authentication failed"));
    }

    // تحفظ البيانات اللازمة للغرف فقط بعد نجاح التحقق من الحساب وحالته.
    socket.data.user = {
      id: user.id,
      role: user.role
    };

    return next();
  } catch (error) {
    return next(new Error("Authentication failed"));
  }
};

module.exports = authenticateSocket;
