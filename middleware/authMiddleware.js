const jwt = require("jsonwebtoken");
const User = require("../models/user");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Access token is required."
    });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      error: "Invalid authorization header."
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "role", "isBlocked"]
    });

    if (!user || user.isBlocked) {
      return res.status(401).json({
        error: "Account is unavailable."
      });
    }

    req.user = {
      id: user.id,
      role: user.role
    };
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired token."
    });
  }

  next();
};

module.exports = authMiddleware;