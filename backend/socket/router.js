import superAdminController from "../controllers/superadmin/superadmin.controller.js";
import adminController from "../controllers/admin/admin.controller.js";
import hrDashboardController from "../controllers/hr/hr.controller.js";
import invoiceSocketController from "../controllers/invoice/invoice.socket.controller.js";
import leadController from "../controllers/lead/lead.controller.js";
import pipelineController from "../controllers/pipeline/pipeline.controllers.js";
import clientController from "../controllers/client/client.controllers.js";
import activityController from "../controllers/activities/activities.controllers.js";
import dealController from "../controllers/deal/deal.controller.js";
import { ChatController } from "../controllers/chat/chat.controller.js";
import { ChatUsersController } from "../controllers/chat/users.controller.js";

import userSocketController from "../controllers/user/user.socket.controller.js";
import socialFeedSocketController from "../controllers/socialfeed/socialFeed.socket.controller.js";
import employeeController from "../controllers/employee/employee.controller.js";
import notesController from "../controllers/employee/notes.controller.js";
import { handleDealsDashboardSocket } from "./dealsDashboard.socket.js";

const router = (socket, io, role) => {
  console.log(`Setting up socket router for role: ${role}`);
  console.log(`Socket data:`, {
    id: socket.id,
    role: socket.role,
    companyId: socket.companyId,
    userMetadata: socket.userMetadata,
  });

  // Initialize chat controller for all authenticated users
  if (socket.companyId) {
    console.log("Attaching chat controller...");
    new ChatController(socket, io);
    new ChatUsersController(socket, io);
  }

  switch (role) {
    case "superadmin":
      console.log("Attaching superadmin controller...");
      superAdminController(socket, io);
      console.log("Attaching social feed controller for superadmin...");
      socialFeedSocketController(socket, io);
      break;
    case "guest":
      console.log("Attaching social feed controller for guest...");
      socialFeedSocketController(socket, io);
      break;
    case "admin":
      console.log("Attaching HR controller...");
      hrDashboardController(socket, io);
      console.log("Attaching admin controller...");
      adminController(socket, io);
      invoiceSocketController(socket, io);
      console.log("Attaching lead controller for admin...");
      leadController(socket, io);
      console.log("Attaching client controller for admin...");
      clientController(socket, io);
      console.log("Attaching activity controller for admin...");
      activityController(socket, io);
      console.log("Attaching deal controller for admin...");
      dealController(socket, io);
      console.log("Attaching deals dashboard controller for admin...");
      handleDealsDashboardSocket(socket, io);
      console.log("Attaching deal controller for deals...");
      userSocketController(socket, io);
      console.log("Attaching social feed controller for admin...");
      socialFeedSocketController(socket, io);
      // Pipelines JS
      pipelineController(socket, io);
      console.log("Attaching admin notes controller...");
      notesController(socket, io);
      break;

    case "hr":
      console.log("Attaching HR controller...");
      invoiceSocketController(socket, io);
      hrDashboardController(socket, io);
      console.log("Attaching lead controller for hr...");
      leadController(socket, io);
      console.log("Attaching client controller for hr...");
      clientController(socket, io);
      console.log("Attaching activity controller for hr...");
      activityController(socket, io);
      console.log("Attaching deal controller for hr...");
      dealController(socket, io);
      console.log("Attaching deals dashboard controller for hr...");
      handleDealsDashboardSocket(socket, io);
      userSocketController(socket, io);
      console.log("Attaching social feed controller for hr...");
      socialFeedSocketController(socket, io);
      console.log("Attaching hr notes controller...");
      notesController(socket, io);
      break;
    case "leads":
      console.log("Attaching leads controller...");
      leadController(socket, io);
      userSocketController(socket, io);
      console.log("Attaching social feed controller for leads...");
      socialFeedSocketController(socket, io);
      console.log("Attaching deal controller for leads...");
      dealController(socket, io);
      break;
    case "employee":
      console.log("Attaching Employee controller...");
      employeeController(socket, io);
      console.log("Attaching deals dashboard controller for employee...");
      handleDealsDashboardSocket(socket, io);
      break;
    default:
      console.log(
        `No controller available for role: ${role}, attaching basic social feed for public access`
      );
      socialFeedSocketController(socket, io);
      break;
  }

  socket.onAny((event, data) => {
    console.log(`[${socket.id}][${role}] Event: ${event}`);
  });
};

export default router;
