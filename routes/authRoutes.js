const express = require('express');
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { rateLimit } = require("express-rate-limit");
const validate = require("../middleware/validationMiddleware");
const {
  registerValidation,
  loginValidation,
  profileValidation,
  changePasswordValidation,
  refreshTokenValidation
} = require("../middleware/validators");

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

router.post(
  '/register',
  authRateLimiter,
  registerValidation,
  validate,
  authController.register
);
router.post(
  '/login',
  authRateLimiter,
  loginValidation,
  validate,
  authController.login
);
router.post(
  '/refresh',
  authRateLimiter,
  refreshTokenValidation,
  validate,
  authController.refresh
);
router.post(
  '/logout',
  refreshTokenValidation,
  validate,
  authController.logout
);
router.get('/test-auth', authMiddleware, (req, res) => {
  res.json({ message: "You are authenticated!", user: req.user });
  });
router.get('/test-role', authMiddleware, roleMiddleware('ADMIN'), (req, res) => {
  res.json({ message: "You have the required role!", user: req.user });
  });
router.patch(
  '/me',
  authMiddleware,
  profileValidation,
  validate,
  authController.updateProfile
);
router.patch(
  '/me/change-password',
  authRateLimiter,
  authMiddleware,
  changePasswordValidation,
  validate,
  authController.changePassword
);

module.exports = router;