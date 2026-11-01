/*
هل المستخدم موجود؟
        ↓
Hash password
        ↓
Create User
        ↓
Return User */

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Transaction } = require("sequelize");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const AppError = require("../utils/appError");
const { revokeUserSockets } = require("../socket");
const sequelize = require("../config/database");
const RefreshToken = require("../models/refreshToken");

const REFRESH_TOKEN_ERROR = "Invalid or expired refresh token.";

const hashPassword = async (password) => {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
}

const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const isUserBlocked = (user) =>
  user.isBlocked === true ||
  (user.blockedAt !== undefined && user.blockedAt !== null);

const getRefreshTokenExpiry = () => {
  const days = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30);
  const validDays = Number.isFinite(days) && days > 0 ? days : 30;
  return new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);
};

const createRefreshToken = async (userId, transaction) => {
  const rawToken = crypto.randomBytes(64).toString("hex");

  await RefreshToken.create(
    {
      userId,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt: getRefreshTokenExpiry()
    },
    { transaction }
  );

  return rawToken;
};


const register = async ({ fullName, phone, password, email }) => {
  if (typeof password !== "string" || password.length < 6) {
    throw new AppError(
      "Password must be at least 6 characters",
      400
    );
  }

  // التحقق من وجود المستخدم بالفعل
  const existingUser = await User.findOne({ where: { phone } });
  if (existingUser) {
  throw new AppError("User with this phone number already exists", 409);
}

  if (email) {
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      throw new AppError("User with this email already exists", 409);
    }
  }

  // 2️⃣ نعمل Hash للـ password
  const hashedPassword = await hashPassword(password);

  // 3️⃣ ننشئ المستخدم بقاعدة البيانات
  const user = await User.create({
    fullName,
    phone,
    password: hashedPassword,
    email
    });
    return user ;  
};


const login = async ({ phone, password }) => {
  // التحقق من وجود المستخدم
  const user = await User.findOne({ where: { phone } });
  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }
  // التحقق من صحة كلمة المرور
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }
  if (isUserBlocked(user)) {
    throw new AppError("Account is unavailable.", 401);
  }
const token = generateAccessToken(user);
const refreshToken = await createRefreshToken(user.id);

return {
  user,
  token,
  refreshToken
};

};

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m"
    }
  );
};

const refreshSession = async (rawRefreshToken) => {
  const tokenHash = hashRefreshToken(rawRefreshToken);

  return sequelize.transaction(async (transaction) => {
    const storedToken = await RefreshToken.findOne({
      where: { tokenHash },
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] }
        }
      ],
      transaction,
      lock: Transaction.LOCK.UPDATE
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date() ||
      !storedToken.user ||
      isUserBlocked(storedToken.user)
    ) {
      throw new AppError(REFRESH_TOKEN_ERROR, 401);
    }

    storedToken.revokedAt = new Date();
    await storedToken.save({ transaction });

    const newRefreshToken = await createRefreshToken(
      storedToken.user.id,
      transaction
    );
    const token = generateAccessToken(storedToken.user);

    return {
      user: storedToken.user,
      token,
      refreshToken: newRefreshToken
    };
  });
};

const revokeRefreshToken = async (rawRefreshToken) => {
  await RefreshToken.update(
    { revokedAt: new Date() },
    {
      where: {
        tokenHash: hashRefreshToken(rawRefreshToken),
        revokedAt: null
      }
    }
  );
};

const revokeUserRefreshTokens = async (userId) => {
  await RefreshToken.update(
    { revokedAt: new Date() },
    {
      where: {
        userId,
        revokedAt: null
      }
    }
  );
};

const blockUser = async (targetUserId, reason, adminUserId) => {
  if (targetUserId === adminUserId) {
    throw new AppError("Administrators cannot block their own account", 400);
  }

  const blockedUser = await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(targetUserId, {
      transaction,
      lock: Transaction.LOCK.UPDATE
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const now = new Date();
    user.isBlocked = true;
    user.blockedAt = now;
    user.blockReason = reason || null;
    await user.save({ transaction });

    await RefreshToken.update(
      { revokedAt: now },
      {
        where: {
          userId: targetUserId,
          revokedAt: null
        },
        transaction
      }
    );

    return user;
  });

  revokeUserSockets(blockedUser.id);
  return blockedUser;
};

const unblockUser = async (targetUserId) => {
  return sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(targetUserId, {
      transaction,
      lock: Transaction.LOCK.UPDATE
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    user.isBlocked = false;
    user.blockedAt = null;
    user.blockReason = null;
    await user.save({ transaction });

    return user;
  });
};
const updateProfile = async (userId, data) => {
    const user = await User.findByPk(userId);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    const { fullName, email, phone } = data;

    if (phone && phone !== user.phone) {
        const existingPhone = await User.findOne({
            where: { phone }
        });

        if (existingPhone) {
            throw new AppError(
                "Phone number is already in use"
                , 409);
        }
    }

    if (email && email !== user.email) {
        const existingEmail = await User.findOne({
            where: { email }
        });

        if (existingEmail) {
            throw new AppError(
                "Email is already in use"
                , 409);
        }
    }

    if (fullName !== undefined) {
        user.fullName = fullName;
    }

    if (phone !== undefined) {
        user.phone = phone;
    }

    if (email !== undefined) {
        user.email = email;
    }

    await user.save();

    return {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role
    };
};
  const changePassword = async (
    userId,
    currentPassword,
    newPassword
) => {
    const user = await User.findByPk(userId);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    const isPasswordCorrect = await bcrypt.compare(
        currentPassword,
        user.password
    );

    if (!isPasswordCorrect) {
        throw new AppError("Current password is incorrect", 400);
    }

    if (!newPassword || newPassword.length < 6) {
        throw new AppError(
            "New password must be at least 6 characters"
            , 400);
    }

    const hashedPassword = await bcrypt.hash(
        newPassword,
        10
    );

    user.password = hashedPassword;

    await user.save();
    await revokeUserRefreshTokens(userId);

    return {
        message: "Password changed successfully"
    };
};
  module.exports = {
    register,
    login,
    refreshSession,
    revokeRefreshToken,
    blockUser,
    unblockUser,
    updateProfile,
    changePassword
  };