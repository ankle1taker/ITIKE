import {
  createBusLayout,
  listBusLayouts,
  getBusLayoutById,
  updateBusLayout,
  updateBusLayoutStatus,
} from "../services/busLayout.service.js";
import {
  createBusLayoutSchema,
  updateBusLayoutSchema,
  updateBusLayoutStatusSchema,
  listBusLayoutsSchema,
} from "../validators/busLayout.validator.js";

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
    const data = createBusLayoutSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const layout = await createBusLayout({
      ...data,
      companyId,
      actorId,
    });

    res.status(201).json({
      success: true,
      message: "Bus layout created successfully.",
      data: { layout },
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const query = listBusLayoutsSchema.parse(req.query);
    const companyId = getCompanyId(req);

    const result = await listBusLayouts({ ...query, companyId });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const layout = await getBusLayoutById({
      id: req.params.id,
      companyId,
    });

    res.status(200).json({ success: true, data: { layout } });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const data = updateBusLayoutSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const layout = await updateBusLayout({
      ...data,
      id: req.params.id,
      companyId,
      actorId,
    });

    res.status(200).json({
      success: true,
      message: "Bus layout updated successfully.",
      data: { layout },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { isActive } = updateBusLayoutStatusSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const layout = await updateBusLayoutStatus({
      id: req.params.id,
      companyId,
      actorId,
      isActive,
    });

    res.status(200).json({
      success: true,
      message: "Bus layout status updated successfully.",
      data: { layout },
    });
  } catch (error) {
    next(error);
  }
};