import {
  getCompanyAnalytics,
  getPlatformAnalytics,
} from "../services/analytics.service.js";

const getCompanyId = (req) => {
  if (!req.companyId) {
    const error = new Error("Company context is required.");
    error.statusCode = 403;
    throw error;
  }
  return req.companyId;
};

export const companyOverview = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const data = await getCompanyAnalytics({ companyId });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const platformOverview = async (req, res, next) => {
  try {
    const data = await getPlatformAnalytics();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};