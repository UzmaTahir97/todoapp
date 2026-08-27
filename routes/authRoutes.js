const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
//   signup,
  login,
    logout,
     forgotPassword,
      resetPassword,
        createWorker,
  getWorkers,
    deleteWorker,
} = require("../controllers/authController");

const router = express.Router();

// router.post("/signup", signup);

router.post("/login", login);

router.post("/logout", logout);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password/:token", resetPassword);

// Get all workers - Admin only
router.get(
  "/workers",
  authMiddleware,
  roleMiddleware(["admin"]),
  getWorkers,
);

// Create worker - Admin only
router.post(
  "/workers",
  authMiddleware,
  roleMiddleware(["admin"]),
  createWorker
);


router.delete(
  "/workers/:id",
  authMiddleware,
  roleMiddleware(["admin"]),
  deleteWorker
);

module.exports = router;