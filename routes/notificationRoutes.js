const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const validate = require("../middleware/validationMiddleware");
const {
  positiveId,
  notificationListValidation
} = require("../middleware/validators");
const notificationController = require("../controllers/notificationController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", notificationListValidation, validate, notificationController.listNotifications);
router.get("/unread-count", notificationController.unreadCount);
router.patch("/read-all", notificationController.markAllAsRead);
router.patch("/:id/read", positiveId, validate, notificationController.markAsRead);

module.exports = router;
