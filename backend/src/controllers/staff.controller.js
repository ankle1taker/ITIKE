import {
  createStaff,
  listStaff,
  getStaffById,
  updateStaff,
  updateStaffStatus,
  resetStaffPassword,
} from "../services/staff.service.js";
import {
  createStaffSchema,
  listStaffSchema,
  updateStaffSchema,
  updateStaffStatusSchema,
  resetStaffPasswordSchema,
} from "../validators/staff.validator.js";

const getCompanyId = (req) => {
  if (!req.companyId) {
    const error = new Error("Company context is required.");
    error.statusCode = 403;
    throw error;
  }
  return req.companyId;
};

const getActorId = (req) => {
  if (!req.user?.id) {
    const error = new Error("User not authenticated.");
    error.statusCode = 401;
    throw error;
  }
  return req.user.id;
};

export const create = async (req, res, next) => {
  try {
    const data = createStaffSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const staff = await createStaff({ ...data, companyId, actorId });

    res.status(201).json({
      success: true,
      message: "Staff account created successfully.",
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const query = listStaffSchema.parse(req.query);
    const companyId = getCompanyId(req);

    const result = await listStaff({ ...query, companyId });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const staff = await getStaffById({
      id: req.params.id,
      companyId,
    });

    res.status(200).json({ success: true, data: { staff } });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const data = updateStaffSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const staff = await updateStaff({
      ...data,
      id: req.params.id,
      companyId,
      actorId,
    });

    res.status(200).json({
      success: true,
      message: "Staff account updated successfully.",
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { isActive } = updateStaffStatusSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const staff = await updateStaffStatus({
      id: req.params.id,
      companyId,
      actorId,
      isActive,
    });

    res.status(200).json({
      success: true,
      message: "Staff status updated successfully.",
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { password } = resetStaffPasswordSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const staff = await resetStaffPassword({
      id: req.params.id,
      companyId,
      actorId,
      password,
    });

    res.status(200).json({
      success: true,
      message: "Staff password reset successfully.",
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};