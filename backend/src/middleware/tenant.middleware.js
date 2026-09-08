export const requireCompany = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!req.user.companyId) {
    return res.status(403).json({
      success: false,
      message: "This account is not associated with a company.",
    });
  }

  req.companyId = req.user.companyId;

  next();
};