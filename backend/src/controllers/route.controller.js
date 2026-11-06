import {
  createRoute,
  listRoutes,
  getRouteById,
  updateRoute,
  updateRouteStatus,
  replaceRouteStops,
} from "../services/route.service.js";
import {
  createRouteSchema,
  listRoutesSchema,
  updateRouteSchema,
  updateRouteStatusSchema,
  replaceStopsSchema,
} from "../validators/route.validator.js";

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
    const data = createRouteSchema.parse(req.body);
    const actorId = getActorId(req);

    const route = await createRoute({ ...data, actorId });

    res.status(201).json({
      success: true,
      message: "Route created successfully.",
      data: { route },
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const query = listRoutesSchema.parse(req.query);

    const result = await listRoutes(query);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const route = await getRouteById({ id: req.params.id });

    res.status(200).json({ success: true, data: { route } });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const data = updateRouteSchema.parse(req.body);
    const actorId = getActorId(req);

    const route = await updateRoute({
      ...data,
      id: req.params.id,
      actorId,
    });

    res.status(200).json({
      success: true,
      message: "Route updated successfully.",
      data: { route },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { isActive } = updateRouteStatusSchema.parse(req.body);
    const actorId = getActorId(req);

    const route = await updateRouteStatus({
      id: req.params.id,
      actorId,
      isActive,
    });

    res.status(200).json({
      success: true,
      message: "Route status updated successfully.",
      data: { route },
    });
  } catch (error) {
    next(error);
  }
};

export const replaceStops = async (req, res, next) => {
  try {
    const { stops } = replaceStopsSchema.parse(req.body);
    const actorId = getActorId(req);

    const route = await replaceRouteStops({
      id: req.params.id,
      actorId,
      stops,
    });

    res.status(200).json({
      success: true,
      message: "Route stops replaced successfully.",
      data: { route },
    });
  } catch (error) {
    next(error);
  }
};