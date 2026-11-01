const { Transaction } = require("sequelize");
const { User, SavedAddress } = require("../models/associations");
const AppError = require("../utils/appError");

const getOwnedAddress = async (addressId, userId, transaction) => {
  const address = await SavedAddress.findOne({
    where: {
      id: addressId,
      userId
    },
    transaction,
    lock: transaction ? Transaction.LOCK.UPDATE : undefined
  });

  if (!address) {
    throw new AppError("Saved address not found", 404);
  }

  return address;
};

const lockUser = async (userId, transaction) => {
  const user = await User.findByPk(userId, {
    attributes: ["id"],
    transaction,
    lock: Transaction.LOCK.UPDATE
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }
};

const createAddress = async (userId, addressData) => {
  const data = {
    label: addressData.label,
    address: addressData.address,
    latitude: addressData.latitude,
    longitude: addressData.longitude,
    isDefault: addressData.isDefault === true
  };

  if (!data.isDefault) {
    return SavedAddress.create({
      ...data,
      userId
    });
  }

  return SavedAddress.sequelize.transaction(async (transaction) => {
    await lockUser(userId, transaction);

    await SavedAddress.update(
      { isDefault: false },
      {
        where: { userId, isDefault: true },
        transaction
      }
    );

    return SavedAddress.create(
      {
        ...data,
        userId
      },
      { transaction }
    );
  });
};

const getMyAddresses = async (userId) => {
  return SavedAddress.findAll({
    where: { userId },
    order: [["createdAt", "DESC"]]
  });
};

const getAddressById = async (userId, addressId) => {
  return getOwnedAddress(addressId, userId);
};

const updateAddress = async (userId, addressId, addressData) => {
  const address = await getOwnedAddress(addressId, userId);
  const allowedFields = ["label", "address", "latitude", "longitude"];

  for (const field of allowedFields) {
    if (addressData[field] !== undefined) {
      address[field] = addressData[field];
    }
  }

  await address.save();
  return address;
};

const deleteAddress = async (userId, addressId) => {
  const address = await getOwnedAddress(addressId, userId);
  await address.destroy();

  return { message: "Saved address deleted successfully" };
};

const setDefaultAddress = async (userId, addressId) => {
  return SavedAddress.sequelize.transaction(async (transaction) => {
    await lockUser(userId, transaction);
    const address = await getOwnedAddress(addressId, userId, transaction);

    await SavedAddress.update(
      { isDefault: false },
      {
        where: { userId, isDefault: true },
        transaction
      }
    );

    address.isDefault = true;
    await address.save({ transaction });

    return address;
  });
};

module.exports = {
  createAddress,
  getMyAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
