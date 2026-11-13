/**
 * Branch-scope middleware.
 *
 * Rules:
 * - COMPANY_ADMIN: no branchId in JWT → access to ALL branches of their company
 * - COMPANY_OPERATOR with branchId: scoped to their branch only
 * - COMPANY_OPERATOR without branchId: scoped to company-wide (rare; fallback)
 * - CUSTOMER / PLATFORM_ADMIN: rejected with 403
 *
 * Sets on req:
 * - req.companyId (from JWT, required for company users)
 * - req.branchId (null for company admin, set for branch-scoped operator)
 */

export const requireCompanyAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }
  if (req.user.role !== "COMPANY_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Only company administrators can perform this action.",
    });
  }
  if (!req.user.companyId) {
    return res.status(403).json({
      success: false,
      message: "Company context is required.",
    });
  }
  req.companyId = req.user.companyId;
  req.branchId = null;
  next();
};

export const requireBranchAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }
  if (
    req.user.role !== "COMPANY_ADMIN" &&
    req.user.role !== "COMPANY_OPERATOR"
  ) {
    return res.status(403).json({
      success: false,
      message: "This action requires a company account.",
    });
  }
  if (!req.user.companyId) {
    return res.status(403).json({
      success: false,
      message: "Company context is required.",
    });
  }

  req.companyId = req.user.companyId;

  if (req.user.role === "COMPANY_OPERATOR" && req.user.branchId) {
    req.branchId = req.user.branchId;
  } else {
    req.branchId = null;
  }

  next();
};

/**
 * Verify a resource's branch is accessible to the caller.
 * Use in controllers before mutating branch-scoped resources.
 * Throws 404 (not 403) — leaking existence is a security smell.
 */
export const assertBranchInScope = (req, resourceBranchId) => {
  if (req.branchId === null) {
    return; // company admin scope — no restriction
  }
  if (req.branchId !== resourceBranchId) {
    const error = new Error("Resource not found in your branch.");
    error.statusCode = 404;
    throw error;
  }
};