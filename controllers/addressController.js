const addressService = require("../services/addressService");

const createAddress = async (req, res, next) => {
  // Controller يمرر هوية المستخدم التي ثبتها authMiddleware إلى Service؛
  // لذلك لا يستطيع body اختيار مالك مختلف للعنوان.
  try {
    const address = await addressService.createAddress(req.user.id, req.body);
    res.status(201).json(address);
  } catch (error) {
    next(error);
  }
};

const getMyAddresses = async (req, res, next) => {
  // الاستعلام مقيد بهوية الجلسة، وليس بمعرّف يرسله العميل في الطلب.
  try {
    const addresses = await addressService.getMyAddresses(req.user.id);
    res.status(200).json(addresses);
  } catch (error) {
    next(error);
  }
};

const getAddressById = async (req, res, next) => {
  // يترك Controller تحقق الملكية ووجود السجل لطبقة Service، ويمرر
  // المعرفين معاً للحفاظ على قاعدة الوصول نفسها في كل العمليات.
  try {
    const address = await addressService.getAddressById(
      req.user.id,
      req.params.id
    );
    res.status(200).json(address);
  } catch (error) {
    next(error);
  }
};

const updateAddress = async (req, res, next) => {
  try {
    const address = await addressService.updateAddress(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(200).json(address);
  } catch (error) {
    next(error);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    const result = await addressService.deleteAddress(
      req.user.id,
      req.params.id
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const setDefaultAddress = async (req, res, next) => {
  // تغيير العنوان الافتراضي عملية أعمال؛ نجاحها أو فشلها يحدد Service،
  // بينما يظل Controller مسؤولاً عن شكل HTTP وتمرير الخطأ إلى المعالج المركزي.
  try {
    const address = await addressService.setDefaultAddress(
      req.user.id,
      req.params.id
    );
    res.status(200).json(address);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAddress,
  getMyAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
