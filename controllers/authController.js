const OTP = require("../models/otpModel");
const sendEmail = require("../utils/sendEmail");
const{otpVerify}=require("../utils/verifyOtp")
const User=require("../models/userModel");
const bcrypt=require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

module.exports.sendOtp = async (req, res) => {
    try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        await OTP.create({ email, otp }); // Save OTP in DB

        const emailSent = await sendEmail(email, otp); // Send OTP via email
        if (!emailSent) {
            return res.status(500).json({ error: "Failed to send OTP" });
        }

        res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error sending OTP" });
    }
};

// 📌 Verify OTP
module.exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ error: "Email and OTP are required" });
        }

        const isValid = await otpVerify(email, otp);
        if (!isValid) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }
        res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error verifying OTP" });
    }
};
//after otp verification
module.exports.apiAuthRegister = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const file = req.file; // This may be undefined if no image is uploaded
  
        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }
  
        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email already registered" });
        }
  
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
  
        // Convert image to Base64 (if available)
        const imageBase64 = file ? file.buffer.toString("base64") : null;
  
        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            image: imageBase64, // Store Base64 image or null if no image is provided
        });
  
        await newUser.save();
        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error(error); // Log error for debugging
        res.status(500).json({ error: "Internal Server Error" });
    }
  }

module.exports.login_post=async (req, res) => {
    const { email, password } = req.body;
    console.log("details",email,password);
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });
  
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });
  
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  }

module.exports.googleAuthCallback=async (req, res) => {
    let user = await User.findOne({ email: req.user.email });

    if (!user) {
      user = new User({
        name: req.user.name,
        email: req.user.email, 
        googleId: req.user.id,
        role: "user",
        image: profile.photos[0].value
        
      });
      await user.save();
    }
    // Generate JWT
    const token = jwt.sign({name:user.name,email:user.email,image:user.image, userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
    res.cookie("token", token, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      sameSite: "Strict", // Prevent CSRF attacks
      maxAge: 60 * 60 * 1000, // 1-hour expiration
    });
    // Redirect user with token to frontend
    res.redirect(`http://localhost:5173/auth-success?token=${token}`);
  }


  