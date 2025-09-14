import { getTenantCollections } from "../../config/db.js";
import { ObjectId } from "mongodb";

const ALLOWED_STATUSES = ["Open", "Won", "Lost", "deleted"];
const ALLOWED_STAGES = ["New", "Prospect", "Proposal", "Won", "Lost"];

const parseDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
};

const normalizeDealInput = (input = {}) => {
  const now = new Date();
  
  // Handle both old and new field names for backward compatibility
  const dealValue = typeof input.dealValue === "number" ? input.dealValue : 
                   (typeof input.value === "number" ? input.value : 
                   (typeof input.price === "number" ? input.price : 0));

  // Normalize owner - handle both string and object formats
  let owner = input.owner;
  if (typeof owner === "string") {
    owner = { name: owner.trim() };
  } else if (!owner || typeof owner !== "object") {
    owner = { name: "" };
  }

  // Normalize contact - ensure it's an object
  let contact = input.contact;
  if (!contact || typeof contact !== "object") {
    contact = {};
  }

  return {
    name: (input.name || input.dealName || "").trim(),
    initials: (input.initials || "").trim(),
    stage: ALLOWED_STAGES.includes(input.stage) ? input.stage : "New",
    status: ALLOWED_STATUSES.includes(input.status) ? input.status : "Open",
    probability: typeof input.probability === "number" ? Math.max(0, Math.min(100, input.probability)) : 0,
    dealValue,
    address: (input.address || "").trim(),
    contact,
    owner,
    tags: Array.isArray(input.tags) ? input.tags.filter(tag => typeof tag === "string") : [],
    expectedClosedDate: parseDate(input.expectedClosedDate || input.expectedClosingDate),
    
    // Legacy fields for backward compatibility
    pipeline: (input.pipeline || "").trim(),
    currency: (input.currency || "USD").trim(),
    period: (input.period || "").trim(),
    periodValue: typeof input.periodValue === "number" ? input.periodValue : undefined,
    contacts: Array.isArray(input.contacts) ? input.contacts : [],
    projects: Array.isArray(input.projects) ? input.projects : [],
    assignees: Array.isArray(input.assignees) ? input.assignees : [],
    dueDate: parseDate(input.dueDate),
    followupDate: parseDate(input.followupDate),
    source: (input.source || "").trim(),
    priority: input.priority && ["High","Medium","Low"].includes(input.priority) ? input.priority : "Medium",
    isPrivate: Boolean(input.isPrivate),
    description: (input.description || "").toString(),
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };
};

const validateCreate = (deal) => {
  // Required fields validation
  if (!deal.name) return "Deal name is required";
  if (!deal.owner || !deal.owner.name) return "Deal owner is required";
  if (typeof deal.dealValue !== "number" || deal.dealValue < 0) return "Deal value must be a number greater than or equal to 0";
  if (typeof deal.probability !== "number" || deal.probability < 0 || deal.probability > 100) return "Probability must be between 0 and 100";
  if (!deal.expectedClosedDate) return "Expected closed date is required";
  if (!ALLOWED_STAGES.includes(deal.stage)) return "Invalid stage";
  if (!ALLOWED_STATUSES.includes(deal.status)) return "Invalid status";
  
  // Date validation
  if (deal.dueDate && deal.expectedClosedDate && deal.expectedClosedDate < deal.dueDate) {
    return "Expected closed date must be after due date";
  }
  
  return null;
};

export const createDeal = async (companyId, data) => {
  try {
    const collections = getTenantCollections(companyId);
    console.log("[DealService] createDeal", { companyId, data });
    const toInsert = normalizeDealInput(data);
    toInsert.companyId = companyId;

    const validationError = validateCreate(toInsert);
    if (validationError) {
      console.error("[DealService] Validation error", { validationError });
      return { done: false, error: validationError };
    }

    const result = await collections.deals.insertOne(toInsert);
    if (!result.insertedId) {
      console.error("[DealService] Failed to insert deal");
      return { done: false, error: "Failed to create deal" };
    }
    const created = await collections.deals.findOne({ _id: result.insertedId });
    // Ensure dates are Date objects
    const processed = created ? {
      ...created,
      createdAt: created.createdAt ? new Date(created.createdAt) : null,
      updatedAt: created.updatedAt ? new Date(created.updatedAt) : null,
      dueDate: created.dueDate ? new Date(created.dueDate) : null,
      expectedClosedDate: created.expectedClosedDate ? new Date(created.expectedClosedDate) : null,
      followupDate: created.followupDate ? new Date(created.followupDate) : null,
    } : null;
    return { done: true, data: processed };
  } catch (error) {
    console.error("[DealService] Error in createDeal", { error: error.message });
    return { done: false, error: error.message };
  }
};

export const getAllDeals = async (companyId, filters = {}) => {
  try {
    const collections = getTenantCollections(companyId);
    console.log("[DealService] getAllDeals", { companyId, filters });
    const query = { companyId, isDeleted: { $ne: true } };

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query.status = { $in: filters.status.filter((s) => ALLOWED_STATUSES.includes(s)) };
      } else if (ALLOWED_STATUSES.includes(filters.status)) {
        query.status = filters.status;
      }
    }

    // createdAt range
    const start = parseDate(filters.startDate);
    const end = parseDate(filters.endDate);
    if (start || end) {
      query.createdAt = {};
      if (start) query.createdAt.$gte = start;
      if (end) query.createdAt.$lte = end;
    }

    // dueDate range (optional)
    const dueStart = parseDate(filters.dueStartDate || filters.dueStart);
    const dueEnd = parseDate(filters.dueEndDate || filters.dueEnd);
    if (dueStart || dueEnd) {
      query.dueDate = {};
      if (dueStart) query.dueDate.$gte = dueStart;
      if (dueEnd) query.dueDate.$lte = dueEnd;
    }

    const sort = { createdAt: -1 };
    const deals = await collections.deals.find(query).sort(sort).toArray();
    console.log("[DealService] found deals", { count: deals.length });
    const processedDeals = deals.map((d) => ({
      ...d,
      createdAt: d.createdAt ? new Date(d.createdAt) : null,
      updatedAt: d.updatedAt ? new Date(d.updatedAt) : null,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      expectedClosedDate: d.expectedClosedDate ? new Date(d.expectedClosedDate) : null,
      followupDate: d.followupDate ? new Date(d.followupDate) : null,
    }));
    return { done: true, data: processedDeals };
  } catch (error) {
    console.error("[DealService] Error in getAllDeals", { error: error.message });
    return { done: false, error: error.message };
  }
};

export const getDealById = async (companyId, id) => {
  try {
    console.log("[DealService] getDealById", { companyId, id });
    if (!ObjectId.isValid(id)) return { done: false, error: "Invalid deal ID format" };
    const collections = getTenantCollections(companyId);
    const deal = await collections.deals.findOne({ _id: new ObjectId(id), companyId, isDeleted: { $ne: true } });
    if (!deal) return { done: false, error: "Deal not found" };
    const processed = {
      ...deal,
      createdAt: deal.createdAt ? new Date(deal.createdAt) : null,
      updatedAt: deal.updatedAt ? new Date(deal.updatedAt) : null,
      dueDate: deal.dueDate ? new Date(deal.dueDate) : null,
      expectedClosedDate: deal.expectedClosedDate ? new Date(deal.expectedClosedDate) : null,
      followupDate: deal.followupDate ? new Date(deal.followupDate) : null,
    };
    return { done: true, data: processed };
  } catch (error) {
    console.error("[DealService] Error in getDealById", { error: error.message });
    return { done: false, error: error.message };
  }
};

export const updateDeal = async (companyId, id, updates = {}) => {
  try {
    console.log("[DealService] updateDeal", { companyId, id, updates });
    if (!ObjectId.isValid(id)) return { done: false, error: "Invalid deal ID format" };
    const collections = getTenantCollections(companyId);

    // Validate status if present
    if (typeof updates.status !== "undefined" && !ALLOWED_STATUSES.includes(updates.status)) {
      return { done: false, error: "Invalid status" };
    }

    const set = { ...updates };

    // Normalize dealValue - handle both old and new field names
    if (typeof set.price === "number" && typeof set.dealValue !== "number") {
      set.dealValue = set.price;
      delete set.price;
    }
    if (typeof set.value === "number" && typeof set.dealValue !== "number") {
      set.dealValue = set.value;
      delete set.value;
    }
    if (typeof set.dealValue === "number" && set.dealValue < 0) {
      return { done: false, error: "Deal value must be greater than or equal to 0" };
    }

    // Normalize owner - handle both string and object formats
    if (set.owner && typeof set.owner === "string") {
      set.owner = { name: set.owner.trim() };
    }

    // Normalize contact - ensure it's an object
    if (set.contact && typeof set.contact !== "object") {
      set.contact = {};
    }

    // Normalize dates
    ["dueDate", "expectedClosedDate", "followupDate"].forEach((k) => {
      if (set[k]) {
        const dt = parseDate(set[k]);
        if (!dt) delete set[k]; else set[k] = dt;
      }
    });

    // Date logic if both present
    if (set.dueDate && set.expectedClosedDate && set.expectedClosedDate < set.dueDate) {
      return { done: false, error: "Expected closed date must be after due date" };
    }

    set.updatedAt = new Date();

    const result = await collections.deals.updateOne(
      { _id: new ObjectId(id), companyId, isDeleted: { $ne: true } },
      { $set: set }
    );

    if (result.matchedCount === 0) return { done: false, error: "Deal not found" };
    const updated = await collections.deals.findOne({ _id: new ObjectId(id) });
    const processed = updated ? {
      ...updated,
      createdAt: updated.createdAt ? new Date(updated.createdAt) : null,
      updatedAt: updated.updatedAt ? new Date(updated.updatedAt) : null,
      dueDate: updated.dueDate ? new Date(updated.dueDate) : null,
      expectedClosedDate: updated.expectedClosedDate ? new Date(updated.expectedClosedDate) : null,
      followupDate: updated.followupDate ? new Date(updated.followupDate) : null,
    } : null;
    return { done: true, data: processed };
  } catch (error) {
    console.error("[DealService] Error in updateDeal", { error: error.message });
    return { done: false, error: error.message };
  }
};

export const deleteDeal = async (companyId, id) => {
  try {
    console.log("[DealService] deleteDeal", { companyId, id });
    if (!ObjectId.isValid(id)) return { done: false, error: "Invalid deal ID format" };
    const collections = getTenantCollections(companyId);

    const result = await collections.deals.updateOne(
      { _id: new ObjectId(id), companyId, isDeleted: { $ne: true } },
      { $set: { status: "deleted", isDeleted: true, deletedAt: new Date(), updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) return { done: false, error: "Deal not found" };
    const doc = await collections.deals.findOne({ _id: new ObjectId(id) });
    return { done: true, data: doc };
  } catch (error) {
    console.error("[DealService] Error in deleteDeal", { error: error.message });
    return { done: false, error: error.message };
  }
};

// Helper function to get date range based on filter
const getDateRange = (filter) => {
  const now = new Date();
  let start, end;
  switch (filter) {
    case "week":
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      break;
    default:
      start = null;
      end = null;
  }
  return { start, end };
};

// Get comprehensive deal dashboard data
export const getDealDashboardData = async (companyId, filters = {}) => {
  try {
    console.log("[DealDashboard] Fetching dashboard data for companyId:", companyId);
    const collections = getTenantCollections(companyId);
    
    // Build date filter
    let dateFilter = {};
    const { filter = "month", dateRange } = filters;
    
    if (dateRange && dateRange.start && dateRange.end) {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      dateFilter = {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      };
    } else {
      const { start, end } = getDateRange(filter);
      if (start && end) {
        dateFilter = {
          createdAt: {
            $gte: start,
            $lt: end
          }
        };
      }
    }

    // Base query - exclude deleted deals
    const baseQuery = { companyId, isDeleted: { $ne: true } };
    const queryWithDate = { ...baseQuery, ...dateFilter };

    // 1. Total Deals Metrics
    const totalDeals = await collections.deals.countDocuments(baseQuery);
    const totalDealsInPeriod = await collections.deals.countDocuments(queryWithDate);
    
    // Deals by status
    const wonDeals = await collections.deals.countDocuments({ ...queryWithDate, status: "Won" });
    const lostDeals = await collections.deals.countDocuments({ ...queryWithDate, status: "Lost" });
    const openDeals = await collections.deals.countDocuments({ ...queryWithDate, status: "Open" });

    // 2. Deal Value Metrics
    const dealValueAgg = await collections.deals.aggregate([
      { $match: queryWithDate },
      { 
        $group: {
          _id: null,
          totalValue: { $sum: "$dealValue" },
          avgValue: { $avg: "$dealValue" },
          wonValue: { 
            $sum: { 
              $cond: [{ $eq: ["$status", "Won"] }, "$dealValue", 0] 
            } 
          },
          lostValue: { 
            $sum: { 
              $cond: [{ $eq: ["$status", "Lost"] }, "$dealValue", 0] 
            } 
          },
          openValue: { 
            $sum: { 
              $cond: [{ $eq: ["$status", "Open"] }, "$dealValue", 0] 
            } 
          }
        }
      }
    ]).toArray();

    const dealValues = dealValueAgg[0] || {
      totalValue: 0,
      avgValue: 0,
      wonValue: 0,
      lostValue: 0,
      openValue: 0
    };

    // 3. Deals by Stage
    const dealsByStage = await collections.deals.aggregate([
      { $match: queryWithDate },
      { $group: { _id: "$stage", count: { $sum: 1 }, value: { $sum: "$dealValue" } } },
      { $sort: { count: -1 } }
    ]).toArray();

    // 4. Deals by Owner
    const dealsByOwner = await collections.deals.aggregate([
      { $match: queryWithDate },
      { 
        $group: { 
          _id: "$owner.name", 
          count: { $sum: 1 }, 
          value: { $sum: "$dealValue" },
          wonCount: { $sum: { $cond: [{ $eq: ["$status", "Won"] }, 1, 0] } },
          lostCount: { $sum: { $cond: [{ $eq: ["$status", "Lost"] }, 1, 0] } },
          openCount: { $sum: { $cond: [{ $eq: ["$status", "Open"] }, 1, 0] } }
        }
      },
      { $sort: { value: -1 } },
      { $limit: 10 }
    ]).toArray();

    // 5. Monthly Deal Trends (for charts)
    const monthlyTrends = await collections.deals.aggregate([
      { 
        $match: { 
          companyId, 
          isDeleted: { $ne: true },
          createdAt: { 
            $gte: new Date(new Date().getFullYear(), 0, 1),
            $lt: new Date(new Date().getFullYear() + 1, 0, 1)
          }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            status: "$status"
          },
          count: { $sum: 1 },
          value: { $sum: "$dealValue" }
        }
      },
      { $sort: { "_id.month": 1 } }
    ]).toArray();

    // Process monthly data for frontend
    const monthlyData = {
      won: new Array(12).fill(0),
      lost: new Array(12).fill(0),
      open: new Array(12).fill(0),
      wonValue: new Array(12).fill(0),
      lostValue: new Array(12).fill(0),
      openValue: new Array(12).fill(0)
    };

    monthlyTrends.forEach(item => {
      const month = item._id.month - 1; // Convert to 0-based index
      const status = item._id.status.toLowerCase();
      if (monthlyData[status] !== undefined) {
        monthlyData[status][month] = item.count;
        monthlyData[`${status}Value`][month] = item.value;
      }
    });

    // 6. Recent Deals
    const recentDeals = await collections.deals
      .find(queryWithDate)
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    // 7. Deal Conversion Rate
    const totalDealsWithStatus = wonDeals + lostDeals;
    const conversionRate = totalDealsWithStatus > 0 ? (wonDeals / totalDealsWithStatus) * 100 : 0;

    // 8. Average Deal Cycle Time (days from creation to Won/Lost)
    const closedDealsWithDates = await collections.deals.aggregate([
      { 
        $match: { 
          ...queryWithDate, 
          status: { $in: ["Won", "Lost"] },
          expectedClosedDate: { $exists: true }
        }
      },
      {
        $project: {
          cycleDays: {
            $divide: [
              { $subtract: ["$updatedAt", "$createdAt"] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgCycleDays: { $avg: "$cycleDays" }
        }
      }
    ]).toArray();

    const avgDealCycle = closedDealsWithDates[0]?.avgCycleDays || 0;

    // 9. Top Performing Deals
    const topDeals = await collections.deals
      .find({ ...queryWithDate, status: "Won" })
      .sort({ dealValue: -1 })
      .limit(5)
      .toArray();

    // 10. Deals by Probability Range
    const probabilityRanges = await collections.deals.aggregate([
      { $match: queryWithDate },
      {
        $bucket: {
          groupBy: "$probability",
          boundaries: [0, 25, 50, 75, 100, 101],
          default: "Other",
          output: {
            count: { $sum: 1 },
            value: { $sum: "$dealValue" }
          }
        }
      }
    ]).toArray();

    return {
      done: true,
      data: {
        // Summary metrics
        totalDeals,
        totalDealsInPeriod,
        wonDeals,
        lostDeals,
        openDeals,
        dealValues,
        conversionRate: Math.round(conversionRate * 100) / 100,
        avgDealCycle: Math.round(avgDealCycle * 100) / 100,
        
        // Breakdown data
        dealsByStage,
        dealsByOwner,
        probabilityRanges,
        
        // Time-based data
        monthlyData,
        recentDeals,
        topDeals,
        
        // Filter info
        filter,
        dateRange: dateRange || { start: null, end: null }
      }
    };
    
  } catch (error) {
    console.error("[DealDashboard] Error in getDealDashboardData", { error: error.message });
    return { done: false, error: error.message };
  }
};


