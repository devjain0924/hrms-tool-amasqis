import * as dealService from "../../services/deal/deal.services.js";

// ----------------------
// Helpers for HTTP layer
// ----------------------
const getRequestUser = (req) => req.user || null;
const getRequestCompanyId = (req) => req.companyId || req.user?.publicMetadata?.companyId || null;

const ensureRole = (req, allowedRoles = []) => {
  const role = req.user?.publicMetadata?.role;
  return allowedRoles.includes(role);
};

const validateCompanyAccessHttp = (req) => {
  const userCompanyId = req.user?.publicMetadata?.companyId;
  const companyId = getRequestCompanyId(req);
  if (!companyId) throw new Error("Company ID not found in user metadata");
  const companyIdRegex = /^[a-zA-Z0-9_-]{3,50}$/;
  if (!companyIdRegex.test(companyId)) throw new Error("Invalid company ID format");
  if (userCompanyId !== companyId) throw new Error("Unauthorized: Company ID mismatch");
  return companyId;
};

// ----------------------
// HTTP Controllers
// ----------------------
export const createDealCtrl = async (req, res) => {
  try {
    if (!getRequestUser(req)) return res.status(401).json({ error: "Unauthorized" });
    if (!ensureRole(req, ["admin", "manager"])) return res.status(403).json({ error: "Forbidden" });
    const companyId = validateCompanyAccessHttp(req);
    
    // Additional validation for new schema required fields
    const { name, owner, dealValue, expectedClosedDate, stage, status, probability } = req.body || {};
    if (!name) return res.status(400).json({ error: "Deal name is required" });
    if (!owner || !owner.name) return res.status(400).json({ error: "Deal owner is required" });
    if (typeof dealValue !== "number" || dealValue < 0) return res.status(400).json({ error: "Deal value must be a number greater than or equal to 0" });
    if (!expectedClosedDate) return res.status(400).json({ error: "Expected closed date is required" });
    if (!["New", "Prospect", "Proposal", "Won", "Lost"].includes(stage)) return res.status(400).json({ error: "Invalid stage" });
    if (!["Won", "Lost", "Open"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    if (typeof probability !== "number" || probability < 0 || probability > 100) return res.status(400).json({ error: "Probability must be between 0 and 100" });
    
    const result = await dealService.createDeal(companyId, req.body || {});
    if (!result.done) return res.status(400).json({ error: result.error || "Failed to create deal" });
    return res.status(201).json(result);
  } catch (error) {
    if (error.message?.includes("Company ID")) return res.status(403).json({ error: error.message });
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getAllDealsCtrl = async (req, res) => {
  try {
    if (!getRequestUser(req)) return res.status(401).json({ error: "Unauthorized" });
    // Allow viewer+ roles; if no explicit viewer role exists, allow any authenticated role
    const companyId = validateCompanyAccessHttp(req);
    const filters = {
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      dueStartDate: req.query.dueStartDate || req.query.dueStart,
      dueEndDate: req.query.dueEndDate || req.query.dueEnd,
    };
    const result = await dealService.getAllDeals(companyId, filters);
    if (!result.done) return res.status(400).json({ error: result.error || "Failed to get deals" });
    return res.status(200).json(result);
  } catch (error) {
    if (error.message?.includes("Company ID")) return res.status(403).json({ error: error.message });
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getDealByIdCtrl = async (req, res) => {
  try {
    if (!getRequestUser(req)) return res.status(401).json({ error: "Unauthorized" });
    const companyId = validateCompanyAccessHttp(req);
    const { id } = req.params;
    const result = await dealService.getDealById(companyId, id);
    if (!result.done) {
      const status = result.error === "Deal not found" || result.error?.includes("Invalid deal ID") ? 404 : 400;
      return res.status(status).json({ error: result.error || "Failed to get deal" });
    }
    return res.status(200).json(result);
  } catch (error) {
    if (error.message?.includes("Company ID")) return res.status(403).json({ error: error.message });
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateDealCtrl = async (req, res) => {
  try {
    if (!getRequestUser(req)) return res.status(401).json({ error: "Unauthorized" });
    if (!ensureRole(req, ["admin", "manager"])) return res.status(403).json({ error: "Forbidden" });
    const companyId = validateCompanyAccessHttp(req);
    const { id } = req.params;
    const result = await dealService.updateDeal(companyId, id, req.body || {});
    if (!result.done) {
      const status = result.error === "Deal not found" || result.error?.includes("Invalid deal ID") ? 404 : 400;
      return res.status(status).json({ error: result.error || "Failed to update deal" });
    }
    return res.status(200).json(result);
  } catch (error) {
    if (error.message?.includes("Company ID")) return res.status(403).json({ error: error.message });
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteDealCtrl = async (req, res) => {
  try {
    if (!getRequestUser(req)) return res.status(401).json({ error: "Unauthorized" });
    if (!ensureRole(req, ["admin"])) return res.status(403).json({ error: "Forbidden" });
    const companyId = validateCompanyAccessHttp(req);
    const { id } = req.params;
    const result = await dealService.deleteDeal(companyId, id);
    if (!result.done) {
      const status = result.error === "Deal not found" || result.error?.includes("Invalid deal ID") ? 404 : 400;
      return res.status(status).json({ error: result.error || "Failed to delete deal" });
    }
    return res.status(204).send();
  } catch (error) {
    if (error.message?.includes("Company ID")) return res.status(403).json({ error: error.message });
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ----------------------
// Socket Controller (default export) - mirrors activities pattern
// ----------------------
const dealController = (socket, io) => {
  const validateCompanyAccess = (socket) => {
    if (!socket.companyId) {
      throw new Error("Company ID not found in user metadata");
    }
    const companyIdRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    if (!companyIdRegex.test(socket.companyId)) {
      throw new Error("Invalid company ID format");
    }
    if (socket.userMetadata?.companyId !== socket.companyId) {
      throw new Error("Unauthorized: Company ID mismatch");
    }
    return socket.companyId;
  };

  const isAdminOrManager = ["admin", "manager"].includes(socket.userMetadata?.role);

  socket.on("deal:create", async (data) => {
    try {
      if (!isAdminOrManager) throw new Error("Unauthorized: Admins or Managers only");
      const companyId = validateCompanyAccess(socket);
      
      // Additional validation for new schema required fields
      const { name, owner, dealValue, expectedClosedDate, stage, status, probability } = data || {};
      if (!name) throw new Error("Deal name is required");
      if (!owner || !owner.name) throw new Error("Deal owner is required");
      if (typeof dealValue !== "number" || dealValue < 0) throw new Error("Deal value must be a number greater than or equal to 0");
      if (!expectedClosedDate) throw new Error("Expected closed date is required");
      if (!["New", "Prospect", "Proposal", "Won", "Lost"].includes(stage)) throw new Error("Invalid stage");
      if (!["Won", "Lost", "Open"].includes(status)) throw new Error("Invalid status");
      if (typeof probability !== "number" || probability < 0 || probability > 100) throw new Error("Probability must be between 0 and 100");
      
      const result = await dealService.createDeal(companyId, data || {});
      socket.emit("deal:create-response", result);
      if (result.done) io.to(`admin_room_${companyId}`).emit("deal:deal-created", result);
    } catch (error) {
      socket.emit("deal:create-response", { done: false, error: error.message });
    }
  });

  socket.on("deal:getAll", async (filters = {}) => {
    try {
      const companyId = validateCompanyAccess(socket);
      const result = await dealService.getAllDeals(companyId, filters);
      socket.emit("deal:getAll-response", result);
    } catch (error) {
      socket.emit("deal:getAll-response", { done: false, error: error.message });
    }
  });

  socket.on("deal:getById", async (dealId) => {
    try {
      const companyId = validateCompanyAccess(socket);
      const result = await dealService.getDealById(companyId, dealId);
      socket.emit("deal:getById-response", result);
    } catch (error) {
      socket.emit("deal:getById-response", { done: false, error: error.message });
    }
  });

  socket.on("deal:update", async ({ dealId, update }) => {
    try {
      if (!isAdminOrManager) throw new Error("Unauthorized: Admins or Managers only");
      const companyId = validateCompanyAccess(socket);
      const result = await dealService.updateDeal(companyId, dealId, update || {});
      socket.emit("deal:update-response", result);
      if (result.done) io.to(`admin_room_${companyId}`).emit("deal:deal-updated", result);
    } catch (error) {
      socket.emit("deal:update-response", { done: false, error: error.message });
    }
  });

  socket.on("deal:delete", async ({ dealId }) => {
    try {
      if (socket.userMetadata?.role !== "admin") throw new Error("Unauthorized: Admins only");
      const companyId = validateCompanyAccess(socket);
      const result = await dealService.deleteDeal(companyId, dealId);
      socket.emit("deal:delete-response", result);
      if (result.done) io.to(`admin_room_${companyId}`).emit("deal:deal-deleted", result);
    } catch (error) {
      socket.emit("deal:delete-response", { done: false, error: error.message });
    }
  });

  // Deal Dashboard Events
  socket.on("deal:dashboard:getData", async (filters = {}) => {
    try {
      const companyId = validateCompanyAccess(socket);
      const result = await dealService.getDealDashboardData(companyId, filters);
      socket.emit("deal:dashboard:getData-response", result);
    } catch (error) {
      socket.emit("deal:dashboard:getData-response", { done: false, error: error.message });
    }
  });
};

export default dealController;


