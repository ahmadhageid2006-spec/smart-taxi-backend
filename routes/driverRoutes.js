const express = require("express");
const driverController = require("../controllers/driverController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validationMiddleware");
const {
  driverStatusValidation,
  driverLocationValidation
} = require("../middleware/validators");

const router = express.Router();

router.get(
  "/me/status",
  authMiddleware,
  roleMiddleware("DRIVER"),
  driverController.getStatus
);

router.patch(
  "/me/status",
  authMiddleware,
  roleMiddleware("DRIVER"),
  driverStatusValidation,
  validate,
  driverController.updateStatus
);

router.patch(
  "/me/location",
  authMiddleware,
  roleMiddleware("DRIVER"),
  driverLocationValidation,
  validate,
  driverController.updateLocation
);

module.exports = router;
