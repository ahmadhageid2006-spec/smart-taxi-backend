const authService = require("../services/authService");

const blockUser = async (req, res, next) => {
  try {
    await authService.blockUser(
      Number(req.params.id),
      req.body.reason,
      req.user.id
    );

    res.status(200).json({ message: "User blocked successfully." });
  } catch (error) {
    next(error);
  }
};

const unblockUser = async (req, res, next) => {
  try {
    await authService.unblockUser(Number(req.params.id));

    res.status(200).json({ message: "User unblocked successfully." });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  blockUser,
  unblockUser
};
