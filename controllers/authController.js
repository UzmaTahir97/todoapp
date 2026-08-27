const bcrypt = require("bcryptjs");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Resend } = require("resend");
const Task = require("../models/Task");

const resend = new Resend(process.env.RESEND_API_KEY);

// const signup = async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     // Check required fields
//     if (!name || !email || !password) {
//       return res.status(400).json({
//         message: "Name, email and password are required",
//       });
//     }

//     // Check if user already exists
//     const existingUser = await User.findOne({ email });

//     if (existingUser) {
//       return res.status(400).json({
//         message: "User already exists",
//       });
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Create user
//     const user = await User.create({
//       name,
//       email,
//       password: hashedPassword,
//       role: "worker",
//     });

//     res.status(201).json({
//       message: "User registered successfully",
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check required fields
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Find user
    const user = await User.findOne({ email });
    console.log("LOGIN USER:", user ? user.email : "USER NOT FOUND");

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Compare password
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
  {
    id: user._id,
    role: user.role,
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "1d",
  }
);


  res.cookie("token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000, // 1 day
});

res.status(200).json({
  message: "Login successful",
  token: token,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  },
});
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  res.status(200).json({
    message: "Logout successful",
  });
};


const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check email
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Generate secure random reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Hash token before saving to database
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Save hashed token + expiry
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

    await user.save();

    // Create password reset URL
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    // Send reset email using Resend
    const { data, error } = await resend.emails.send({
      from: "Todo App <onboarding@resend.dev>",
      to: [email],
      subject: "Reset Your Todo App Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <h2>Reset Your Password</h2>

          <p>You requested to reset your Todo App password.</p>

          <p>Click the button below to create a new password:</p>

          <a
            href="${resetUrl}"
            style="
              display: inline-block;
              padding: 12px 20px;
              background-color: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 6px;
            "
          >
            Reset Password
          </a>

          <p style="margin-top: 20px;">
            This link will expire in 15 minutes.
          </p>

          <p>
            If you did not request a password reset, you can ignore this email.
          </p>
        </div>
      `,
    });

    // Check Resend error
    if (error) {
      console.error("Resend error:", error);

      return res.status(500).json({
        message: "Unable to send password reset email",
      });
    }

    console.log("Reset email sent:", data);

    // Do NOT return resetToken
    res.status(200).json({
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};


const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Check password
    if (!password) {
      return res.status(400).json({
        message: "New password is required",
      });
    }

    // Hash the token received from the user
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find user with valid token that has not expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    user.password = hashedPassword;

    // Clear reset token
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;

    await user.save();

    res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

const getWorkers = async (req, res) => {
  try {
    const workers = await User.find(
      { role: "worker" },
      "name email role"
    );

    res.status(200).json({
      workers,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

const createWorker = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const worker = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "worker",
    });

    res.status(201).json({
      message: "Worker created successfully",
      worker: {
        id: worker._id,
        name: worker.name,
        email: worker.email,
        role: worker.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

const deleteWorker = async (req, res) => {
  try {
    const worker = await User.findOne({
      _id: req.params.id,
      role: "worker",
    });

    if (!worker) {
      return res.status(404).json({
        message: "Worker not found",
      });
    }

    // Check if worker has any unfinished task
    const activeTask = await Task.findOne({
      assignedTo: worker._id,
      status: { $in: ["Pending", "Process"] },
    });

    if (activeTask) {
      return res.status(400).json({
        message:
          "This worker cannot be deleted because they still have an unfinished task.",
      });
    }

    await User.findByIdAndDelete(worker._id);

    res.status(200).json({
      message: "Worker deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
//   signup,
    login,
     logout,
      resetPassword,
    getWorkers,
      forgotPassword,
       createWorker,
         deleteWorker,
};