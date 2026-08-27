const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
  createTask,
  getTasks,
  updateTask,
  updateTaskStatus,
   deleteTask,
} = require("../controllers/taskController");

const router = express.Router();

// Admin test route
router.get(
  "/admin",
  authMiddleware,
  roleMiddleware(["admin"]),
  (req, res) => {
    res.status(200).json({
      message: "Welcome Admin. You have access.",
      user: req.user,
    });
  }
);

// Create Task - Admin only
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["admin"]),
  createTask
);

// Update Task - Admin only
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["admin"]),
  updateTask
);

// Update Task Status - Admin only
router.put(
  "/:id/status",
  authMiddleware,
  roleMiddleware(["admin", "worker"]),
  updateTaskStatus
);

// Delete Task - Admin only
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["admin"]),
  deleteTask
);

// Get All Tasks - Admin and Worker
router.get(
  "/",
  authMiddleware,
  roleMiddleware(["admin", "worker"]),
  getTasks
);

module.exports = router;