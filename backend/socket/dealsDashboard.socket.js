import { getDashboardData } from "../controllers/deal/dealsDashboard.controller.js";

export const handleDealsDashboardSocket = (socket, io) => {
  console.log("[DealsDashboard Socket] Setting up deals dashboard handlers");

  // Handle deals dashboard data request
  socket.on("deal/dashboard/get-all-data", async (params) => {
    try {
      console.log("[DealsDashboard Socket] Received dashboard data request:", params);

      // Validate socket authentication and company access
      if (!socket.authenticated) {
        console.error("[DealsDashboard Socket] Unauthenticated request");
        socket.emit("deal/dashboard/get-all-data-response", {
          done: false,
          error: "Authentication required"
        });
        return;
      }

      if (!socket.companyId) {
        console.error("[DealsDashboard Socket] No company ID in socket");
        socket.emit("deal/dashboard/get-all-data-response", {
          done: false,
          error: "Company ID required"
        });
        return;
      }

      // Rate limiting check
      if (!socket.checkRateLimit()) {
        console.warn("[DealsDashboard Socket] Rate limit exceeded for user:", socket.userId);
        socket.emit("deal/dashboard/get-all-data-response", {
          done: false,
          error: "Rate limit exceeded. Please try again later."
        });
        return;
      }

      // Extract parameters with defaults
      const {
        filter = "week",
        dateRange = null,
        pipelineFilter = "thisWeek",
        dealsStageFilter = "thisWeek", 
        companiesFilter = "thisWeek",
        topDealsFilter = "thisWeek",
        countryFilter = "thisMonth",
        wonDealsFilter = "salesPipeline",
        selectedPipelineYear = new Date().getFullYear()
      } = params || {};

      console.log("[DealsDashboard Socket] Processing request with params:", {
        companyId: socket.companyId,
        filter,
        dateRange: dateRange ? `${dateRange.start} to ${dateRange.end}` : 'none',
        pipelineFilter,
        dealsStageFilter,
        selectedPipelineYear
      });

      // Get dashboard data
      const result = await getDashboardData(
        socket.companyId,
        filter,
        dateRange,
        pipelineFilter,
        dealsStageFilter,
        companiesFilter,
        topDealsFilter,
        countryFilter,
        wonDealsFilter,
        selectedPipelineYear
      );

      console.log("[DealsDashboard Socket] Dashboard data result:", {
        done: result.done,
        hasData: !!result.data,
        totalDeals: result.data?.totalDeals,
        error: result.error
      });

      // Send response
      socket.emit("deal/dashboard/get-all-data-response", result);

      // Log successful response
      if (result.done) {
        console.log("[DealsDashboard Socket] Successfully sent dashboard data to user:", socket.userId);
      }

    } catch (error) {
      console.error("[DealsDashboard Socket] Error handling dashboard request:", error);
      socket.emit("deal/dashboard/get-all-data-response", {
        done: false,
        error: "Internal server error while fetching dashboard data"
      });
    }
  });

  // Handle real-time updates when deals are modified
  socket.on("deal/dashboard/refresh", async () => {
    try {
      if (!socket.authenticated || !socket.companyId) {
        return;
      }

      console.log("[DealsDashboard Socket] Refreshing dashboard data for user:", socket.userId);

      // Get fresh dashboard data
      const result = await getDashboardData(socket.companyId);
      
      if (result.done) {
        socket.emit("deal/dashboard/data-updated", result.data);
      }
    } catch (error) {
      console.error("[DealsDashboard Socket] Error refreshing dashboard:", error);
    }
  });

  // Handle dashboard filter changes
  socket.on("deal/dashboard/filter-changed", async (filterParams) => {
    try {
      if (!socket.authenticated || !socket.companyId) {
        return;
      }

      console.log("[DealsDashboard Socket] Filter changed:", filterParams);

      // Get updated data with new filters
      const result = await getDashboardData(
        socket.companyId,
        filterParams.filter,
        filterParams.dateRange,
        filterParams.pipelineFilter,
        filterParams.dealsStageFilter,
        filterParams.companiesFilter,
        filterParams.topDealsFilter,
        filterParams.countryFilter,
        filterParams.wonDealsFilter,
        filterParams.selectedPipelineYear
      );

      if (result.done) {
        socket.emit("deal/dashboard/get-all-data-response", result);
      }
    } catch (error) {
      console.error("[DealsDashboard Socket] Error handling filter change:", error);
    }
  });

  console.log("[DealsDashboard Socket] Deals dashboard handlers registered for user:", socket.userId);
};