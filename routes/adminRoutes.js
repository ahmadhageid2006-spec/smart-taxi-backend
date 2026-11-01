const express = require("express");
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validationMiddleware");
const {
  blockUserValidation,
  unblockUserValidation
} = require("../middleware/validators");

const router = express.Router();

router.patch(
  "/users/:id/block",
  authMiddleware,
  roleMiddleware("ADMIN"),
  blockUserValidation,
  validate,
  adminController.blockUser
);

router.patch(
  "/users/:id/unblock",
  authMiddleware,
  roleMiddleware("ADMIN"),
  unblockUserValidation,
  validate,
  adminController.unblockUser
);

module.exports = router;
