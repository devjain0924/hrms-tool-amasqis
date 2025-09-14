import { getTenantCollections } from "../../config/db.js";
import { ObjectId } from "mongodb";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { format } from "date-fns";

function getDateRange(filter) {
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
}

const getDashboardData = async (
  companyId,
  filter = "week",
  dateRange = null,
  pipelineFilter = "thisWeek",
  dealsStageFilter = "thisWeek",
  companiesFilter = "thisWeek",
  topDealsFilter = "thisWeek",
  countryFilter = "thisMonth",
  wonDealsFilter = "salesPipeline",
  selectedPipelineYear = null
) => {
  try {
    const now = new Date();
    console.log("[DealsDashboard] Fetching data for companyId:", companyId);
    
    const collections = getTenantCollections(companyId);
    const dealsCollection = collections.deals;
    const companiesCollection = collections.companies;
    const activitiesCollection = collections.activities;
    const employeesCollection = collections.employees;
    
    // Build date filter based on dateRange
    let dateFilter = {};
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

    // Base query for deals
    const baseQuery = {
      companyId: companyId,
      isDeleted: { $ne: true },
      ...dateFilter
    };

    console.log("[DealsDashboard] Base query:", JSON.stringify(baseQuery));

    // Get total deals count
    const totalDeals = await dealsCollection.countDocuments(baseQuery);
    
    // Get deals by status
    const wonDeals = await dealsCollection.countDocuments({
      ...baseQuery,
      status: "Won"
    });
    
    const lostDeals = await dealsCollection.countDocuments({
      ...baseQuery,
      status: "Lost"
    });

    // Get total deal value and revenue
    const dealValueAggregation = await dealsCollection.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$dealValue" },
          averageValue: { $avg: "$dealValue" },
          wonValue: {
            $sum: {
              $cond: [{ $eq: ["$status", "Won"] }, "$dealValue", 0]
            }
          }
        }
      }
    ]).toArray();

    const totalDealValue = dealValueAggregation[0]?.totalValue || 0;
    const averageDealSize = dealValueAggregation[0]?.averageValue || 0;
    const revenueThisMonth = dealValueAggregation[0]?.wonValue || 0;

    // Calculate conversion rate
    const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;

    // Active deals (Open status)
    const activeDeals = await dealsCollection.countDocuments({
      ...baseQuery,
      status: "Open"
    });

    // Deals by stage aggregation
    const dealsByStageAgg = await dealsCollection.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$stage",
          count: { $sum: 1 },
          value: { $sum: "$dealValue" }
        }
      }
    ]).toArray();

    const dealsByStage = {
      New: 0,
      Prospect: 0,
      Proposal: 0,
      Won: 0,
      Lost: 0,
      monthlyData: {
        new: new Array(12).fill(0),
        prospect: new Array(12).fill(0),
        proposal: new Array(12).fill(0),
        won: new Array(12).fill(0),
        lost: new Array(12).fill(0),
        revenue: new Array(12).fill(0),
      }
    };

    dealsByStageAgg.forEach(stage => {
      if (dealsByStage.hasOwnProperty(stage._id)) {
        dealsByStage[stage._id] = stage.value || 0;
      }
    });

    // Monthly data for charts
    const monthlyDealsAgg = await dealsCollection.aggregate([
      {
        $match: {
          companyId: companyId,
          isDeleted: { $ne: true },
          createdAt: {
            $gte: new Date(selectedPipelineYear || now.getFullYear(), 0, 1),
            $lt: new Date((selectedPipelineYear || now.getFullYear()) + 1, 0, 1)
          }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            stage: "$stage"
          },
          count: { $sum: 1 },
          value: { $sum: "$dealValue" }
        }
      }
    ]).toArray();

    // Populate monthly data
    monthlyDealsAgg.forEach(item => {
      const monthIndex = item._id.month - 1;
      const stage = item._id.stage?.toLowerCase();
      
      if (dealsByStage.monthlyData[stage]) {
        dealsByStage.monthlyData[stage][monthIndex] = item.count;
      }
      if (stage === 'won') {
        dealsByStage.monthlyData.revenue[monthIndex] = item.value;
      }
    });

    // Deals by owner
    const dealsByOwnerAgg = await dealsCollection.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$owner.name",
          deals: { $sum: 1 },
          value: { $sum: "$dealValue" }
        }
      },
      { $sort: { value: -1 } },
      { $limit: 10 }
    ]).toArray();

    const dealsByOwner = dealsByOwnerAgg.map(owner => ({
      name: owner._id || "Unknown",
      deals: owner.deals,
      value: owner.value
    }));

    // Deals by source (if available in deal model)
    const dealsBySourceAgg = await dealsCollection.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
          value: { $sum: "$dealValue" }
        }
      },
      { $sort: { value: -1 } },
      { $limit: 5 }
    ]).toArray();

    const dealsBySource = dealsBySourceAgg.map(source => ({
      name: source._id || "Direct",
      count: source.count,
      value: source.value
    }));

    // Top deals
    const topDeals = await dealsCollection.find(baseQuery)
      .sort({ dealValue: -1 })
      .limit(10)
      .toArray();

    const topDealsFormatted = topDeals.map(deal => ({
      name: deal.name,
      value: deal.dealValue,
      owner: deal.owner?.name || "Unknown",
      stage: deal.stage
    }));

    // Recent deals
    const recentDeals = await dealsCollection.find(baseQuery)
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    const recentDealsFormatted = recentDeals.map(deal => ({
      name: deal.name,
      value: deal.dealValue,
      owner: deal.owner?.name || "Unknown",
      stage: deal.stage,
      closedDate: deal.expectedClosedDate || deal.createdAt
    }));

    // Deals by country (mock data for now - would need address parsing)
    const dealsByCountry = [
      { name: "United States", deals: Math.floor(Math.random() * 50) + 10, value: Math.floor(Math.random() * 500000) + 100000 },
      { name: "United Kingdom", deals: Math.floor(Math.random() * 30) + 5, value: Math.floor(Math.random() * 300000) + 50000 },
      { name: "Germany", deals: Math.floor(Math.random() * 25) + 3, value: Math.floor(Math.random() * 250000) + 40000 },
      { name: "France", deals: Math.floor(Math.random() * 20) + 2, value: Math.floor(Math.random() * 200000) + 30000 },
      { name: "Canada", deals: Math.floor(Math.random() * 15) + 1, value: Math.floor(Math.random() * 150000) + 20000 }
    ];

    // Won deals stage analysis
    const wonDealsStage = [
      { stage: "New to Won", percentage: 25, value: revenueThisMonth * 0.25 },
      { stage: "Prospect to Won", percentage: 35, value: revenueThisMonth * 0.35 },
      { stage: "Proposal to Won", percentage: 40, value: revenueThisMonth * 0.40 }
    ];

    // Recent activities
    const recentActivities = await activitiesCollection.find({
      companyId: companyId,
      type: { $in: ['deal', 'call', 'email', 'meeting'] }
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

    const recentActivitiesFormatted = recentActivities.map(activity => ({
      type: activity.type || 'deal',
      description: activity.description || `${activity.type} activity`,
      time: activity.createdAt ? format(activity.createdAt, 'MMM dd, HH:mm') : 'Just now',
      user: activity.user?.name || activity.createdBy || 'Unknown'
    }));

    const dashboardData = {
      totalDeals,
      totalDealValue,
      wonDeals,
      lostDeals,
      averageDealSize,
      conversionRate,
      revenueThisMonth,
      activeDeals,
      dealsByStage,
      dealsByOwner,
      dealsBySource,
      topDeals: topDealsFormatted,
      recentDeals: recentDealsFormatted,
      dealsByCountry,
      wonDealsStage,
      recentActivities: recentActivitiesFormatted,
    };

    console.log("[DealsDashboard] Dashboard data compiled successfully");
    return { done: true, data: dashboardData };

  } catch (error) {
    console.error("[DealsDashboard] Error fetching dashboard data:", error);
    return { 
      done: false, 
      error: "Failed to fetch deals dashboard data: " + error.message 
    };
  }
};

export { getDashboardData };