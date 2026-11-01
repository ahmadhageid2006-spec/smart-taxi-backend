const express = require('express');
const {
  createCar,
  getMyCar,
  updateMyCar,
  deleteMyCar
} = require("../controllers/carController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validationMiddleware");
const {
  carCreateValidation,
  carUpdateValidation
} = require("../middleware/validators");

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware("DRIVER"),
  carCreateValidation,
  validate,
  createCar
);

router.get(
  "/me",
  authMiddleware,
  roleMiddleware("DRIVER"),
  getMyCar
);
router.patch(
    "/me",
    authMiddleware,
    roleMiddleware("DRIVER"),
    carUpdateValidation,
    validate,
    updateMyCar
);
router.delete(
    "/me",
    authMiddleware,
    roleMiddleware("DRIVER"),
    deleteMyCar
);
module.exports = router;