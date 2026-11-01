const { body, param, query } = require("express-validator");

const nonEmptyString = (field, label = field) =>
  body(field)
    .exists()
    .withMessage(`${label} is required`)
    .bail()
    .isString()
    .withMessage(`${label} must be a string`)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(`${label} is required`);

const optionalNonEmptyString = (field, label = field) =>
  body(field)
    .optional()
    .isString()
    .withMessage(`${label} must be a string`)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(`${label} cannot be empty`);

const positiveId = param("id")
  .isInt({ min: 1 })
  .withMessage("id must be a positive integer");

const registerValidation = [
  nonEmptyString("fullName"),
  nonEmptyString("phone"),
  body("password")
    .exists()
    .withMessage("password is required")
    .bail()
    .isString()
    .withMessage("password must be a string")
    .bail()
    .isLength({ min: 6 })
    .withMessage("password must be at least 6 characters"),
  body("email").optional().isEmail().withMessage("email must be valid"),
  body("role")
    .optional()
    .isIn(["PASSENGER", "DRIVER"])
    .withMessage("role must be PASSENGER or DRIVER")
];

const loginValidation = [
  nonEmptyString("phone"),
  body("password")
    .exists()
    .withMessage("password is required")
    .bail()
    .isString()
    .withMessage("password is required")
    .bail()
    .notEmpty()
    .withMessage("password is required")
];

const profileValidation = [
  optionalNonEmptyString("fullName"),
  optionalNonEmptyString("phone"),
  body("email").optional().isEmail().withMessage("email must be valid")
];

const changePasswordValidation = [
  body("currentPassword")
    .exists()
    .withMessage("currentPassword is required")
    .bail()
    .isString()
    .withMessage("currentPassword is required")
    .bail()
    .notEmpty()
    .withMessage("currentPassword is required"),
  body("newPassword")
    .exists()
    .withMessage("newPassword is required")
    .bail()
    .isString()
    .withMessage("newPassword is required")
    .bail()
    .isLength({ min: 6 })
    .withMessage("newPassword must be at least 6 characters")
];

const carCreateValidation = [
  body("type")
    .exists()
    .withMessage("type is required")
    .bail()
    .isIn(["NORMAL", "COMFORT"])
    .withMessage("type must be NORMAL or COMFORT"),
  nonEmptyString("manufacturer"),
  nonEmptyString("model"),
  nonEmptyString("color"),
  nonEmptyString("plateNumber")
];

const carUpdateValidation = [
  body("type")
    .optional()
    .isIn(["NORMAL", "COMFORT"])
    .withMessage("type must be NORMAL or COMFORT"),
  optionalNonEmptyString("manufacturer"),
  optionalNonEmptyString("model"),
  optionalNonEmptyString("color"),
  optionalNonEmptyString("plateNumber")
];

const rideCreateValidation = [
  nonEmptyString("pickupAddress"),
  nonEmptyString("destinationAddress"),
  body("pickupLatitude")
    .exists()
    .withMessage("pickupLatitude is required")
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage("pickupLatitude must be between -90 and 90"),
  body("pickupLongitude")
    .exists()
    .withMessage("pickupLongitude is required")
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage("pickupLongitude must be between -180 and 180"),
  body("destinationLatitude")
    .exists()
    .withMessage("destinationLatitude is required")
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage("destinationLatitude must be between -90 and 90"),
  body("destinationLongitude")
    .exists()
    .withMessage("destinationLongitude is required")
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage("destinationLongitude must be between -180 and 180"),
  body("rideType")
    .exists()
    .withMessage("rideType is required")
    .bail()
    .isIn(["NORMAL", "COMFORT"])
    .withMessage("rideType must be NORMAL or COMFORT"),
  body("scheduledAt")
    .optional()
    .isISO8601()
    .withMessage("scheduledAt must be a valid ISO-8601 date")
];

const rideTypeValidation = [
  query("rideType")
    .optional()
    .isIn(["NORMAL", "COMFORT"])
    .withMessage("rideType must be NORMAL or COMFORT")
];

const cancelRideValidation = [
  positiveId,
  optionalNonEmptyString("cancelReason")
];

const refreshTokenValidation = [
  body("refreshToken")
    .exists()
    .withMessage("refreshToken is required")
    .bail()
    .isString()
    .withMessage("refreshToken must be a string")
    .bail()
    .notEmpty()
    .withMessage("refreshToken cannot be empty")
];

const blockUserValidation = [
  positiveId,
  body("reason")
    .optional()
    .isString()
    .withMessage("reason must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("reason cannot be empty")
    .bail()
    .isLength({ max: 500 })
    .withMessage("reason must be at most 500 characters")
];

const unblockUserValidation = [positiveId];

const driverStatusValidation = [
  body("status")
    .exists()
    .withMessage("status is required")
    .bail()
    .isIn(["ONLINE", "OFFLINE"])
    .withMessage("status must be ONLINE or OFFLINE")
];

const driverLocationValidation = [
  body("latitude")
    .exists()
    .withMessage("latitude is required")
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be between -90 and 90")
    .toFloat(),
  body("longitude")
    .exists()
    .withMessage("longitude is required")
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be between -180 and 180")
    .toFloat()
];

const savedAddressCreateValidation = [
  body("label")
    .exists()
    .withMessage("label is required")
    .bail()
    .isString()
    .withMessage("label must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("label is required")
    .bail()
    .isLength({ max: 100 })
    .withMessage("label must be at most 100 characters"),
  body("address")
    .exists()
    .withMessage("address is required")
    .bail()
    .isString()
    .withMessage("address must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("address is required")
    .bail()
    .isLength({ max: 500 })
    .withMessage("address must be at most 500 characters"),
  body("latitude")
    .exists()
    .withMessage("latitude is required")
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be between -90 and 90")
    .toFloat(),
  body("longitude")
    .exists()
    .withMessage("longitude is required")
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be between -180 and 180")
    .toFloat(),
  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be a boolean")
    .toBoolean()
];

const savedAddressUpdateValidation = [
  positiveId,
  body("label")
    .optional()
    .isString()
    .withMessage("label must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("label cannot be empty")
    .bail()
    .isLength({ max: 100 })
    .withMessage("label must be at most 100 characters"),
  body("address")
    .optional()
    .isString()
    .withMessage("address must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("address cannot be empty")
    .bail()
    .isLength({ max: 500 })
    .withMessage("address must be at most 500 characters"),
  body("latitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be between -90 and 90")
    .toFloat(),
  body("longitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be between -180 and 180")
    .toFloat()
];

const savedAddressIdValidation = [positiveId];

const notificationListValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("limit must be between 1 and 50")
    .toInt(),
  query("unreadOnly")
    .optional()
    .isBoolean()
    .withMessage("unreadOnly must be a boolean")
    .toBoolean()
];

module.exports = {
  positiveId,
  registerValidation,
  loginValidation,
  profileValidation,
  changePasswordValidation,
  carCreateValidation,
  carUpdateValidation,
  rideCreateValidation,
  rideTypeValidation,
  cancelRideValidation,
  refreshTokenValidation,
  blockUserValidation,
  unblockUserValidation,
  driverStatusValidation,
  driverLocationValidation,
  savedAddressCreateValidation,
  savedAddressUpdateValidation,
  savedAddressIdValidation,
  notificationListValidation
};
