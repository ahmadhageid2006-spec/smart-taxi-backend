const express = require("express");
const addressController = require("../controllers/addressController");
const authMiddleware = require("../middleware/authMiddleware");
const validate = require("../middleware/validationMiddleware");
const {
  savedAddressCreateValidation,
  savedAddressUpdateValidation,
  savedAddressIdValidation
} = require("../middleware/validators");

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  savedAddressCreateValidation,
  validate,
  addressController.createAddress
);

router.get(
  "/",
  authMiddleware,
  addressController.getMyAddresses
);

router.patch(
  "/:id/default",
  authMiddleware,
  savedAddressIdValidation,
  validate,
  addressController.setDefaultAddress
);

router.get(
  "/:id",
  authMiddleware,
  savedAddressIdValidation,
  validate,
  addressController.getAddressById
);

router.patch(
  "/:id",
  authMiddleware,
  savedAddressUpdateValidation,
  validate,
  addressController.updateAddress
);

router.delete(
  "/:id",
  authMiddleware,
  savedAddressIdValidation,
  validate,
  addressController.deleteAddress
);

module.exports = router;
