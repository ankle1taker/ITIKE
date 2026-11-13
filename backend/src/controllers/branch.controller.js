import {
  createBranch,
  listBranches,
  getBranchById,
  updateBranch,
  updateBranchStatus,
  transferBus,
} from "../services/branch.service.js";
import {
  createBranchSchema,
  updateBranchSchema,
  updateBranchStatusSchema,
  transferBusSchema,
} from "../validators/branch.validator.js";

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
    const data = createBranchSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const branch = await createBranch({ ...data, companyId, actorId });

    res.status(201).json({
      success: true,
      message: "Branch created.",
      data: { branch },
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const includeInactive = req.query.includeInactive === "true";

    const branches = await listBranches({ companyId, includeInactive });

    res.status(200).json({ success: true, data: { branches } });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const branch = await getBranchById({ id: req.params.id, companyId });

    res.status(200).json({ success: true, data: { branch } });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const data = updateBranchSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const branch = await updateBranch({
      ...data,
      id: req.params.id,
      companyId,
      actorId,
    });

    res.status(200).json({
      success: true,
      message: "Branch updated.",
      data: { branch },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { isActive } = updateBranchStatusSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const branch = await updateBranchStatus({
      id: req.params.id,
      companyId,
      actorId,
      isActive,
    });

    res.status(200).json({
      success: true,
      message: "Branch status updated.",
      data: { branch },
    });
  } catch (error) {
    next(error);
  }
};

export const transferBusToBranch = async (req, res, next) => {
  try {
    const { targetBranchId } = transferBusSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const bus = await transferBus({
      busId: req.params.busId,
      companyId,
      actorId,
      targetBranchId,
    });

    res.status(200).json({
      success: true,
      message: "Bus transferred.",
      data: { bus },
    });
  } catch (error) {
    next(error);
  }
};