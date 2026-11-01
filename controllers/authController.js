const authService = require("../services/authService");



const register = async (req, res, next) => {
  try {
    const { fullName, phone, password, email } = req.body;

    if (!fullName || !phone || !password) {
      return res.status(400).json({
        error: "Full name, phone, and password are required."
      });
    }

    const user = await authService.register({
      fullName,
      phone,
      password,
      email
    });

    const userData = {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      email: user.email,
      role: user.role
    };

    return res.status(201).json(userData);
  } catch (error) {
    console.error("Register error:", error);
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        error: "Phone and password are required."
      });
    }

    const {user, token, refreshToken} = await authService.login({ phone, password });

    return res.status(200).json({
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      token: token,
      refreshToken: refreshToken
    });
  } catch (error) {
    console.error("Login error:", error);
    return next(error);
  }
};
const refresh = async (req, res, next) => {
  try {
    const result = await authService.refreshSession(req.body.refreshToken);

    return res.status(200).json({
      id: result.user.id,
      phone: result.user.phone,
      fullName: result.user.fullName,
      email: result.user.email,
      role: result.user.role,
      token: result.token,
      refreshToken: result.refreshToken
    });
  } catch (error) {
    next(error);
  }
};
const logout = async (req, res, next) => {
  try {
    await authService.revokeRefreshToken(req.body.refreshToken);
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};
const updateProfile = async (req, res, next) => {
    try {
        const user = await authService.updateProfile(
            req.user.id,
            req.body
        );

        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
};
const changePassword = async (req, res, next) => {
    try {
        const result = await authService.changePassword(
            req.user.id,
            req.body.currentPassword,
            req.body.newPassword
        );

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
module.exports = {
  register,
  login,
  refresh,
  logout,
  updateProfile,
  changePassword
};
