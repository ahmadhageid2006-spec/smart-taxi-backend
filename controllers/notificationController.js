const notificationService = require("../services/notificationService");

const listNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.listNotifications(req.user.id, {
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
      unreadOnly: req.query.unreadOnly === true || req.query.unreadOnly === "true"
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const unreadCount = async (req, res, next) => {
  try {
    res.status(200).json({
      count: await notificationService.countUnread(req.user.id)
    });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    res.status(200).json(
      await notificationService.markAsRead(req.user.id, req.params.id)
    );
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    res.status(200).json(
      await notificationService.markAllAsRead(req.user.id)
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listNotifications,
  unreadCount,
  markAsRead,
  markAllAsRead
};
