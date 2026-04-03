const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// Import models
const User = require("../schemas/users");
const Role = require("../schemas/roles");

// DB Connection
const MONGO_URI = "mongodb://localhost:27017/nnptud-c6";

// Nodemailer config
// This uses Mailtrap/Ethereal from your existing senMailHandler.js
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 25,
    secure: false, // Use true for port 465, false for port 587
    auth: {
        user: "", // ADD YOUR MAILTRAP USER HERE IF YOU HAVE ONE
        pass: "", // ADD YOUR MAILTRAP PASS HERE IF YOU HAVE ONE
    },
});

const generateRandomPassword = (length = 16) => {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
};

const sendPasswordEmail = async (email, username, password) => {
    try {
        await transporter.sendMail({
            from: '"System Admin" <admin@hehehe.com>',
            to: email,
            subject: "Your New Account Credentials",
            text: `Hello ${username},\n\nYour account has been created.\nUsername: ${username}\nPassword: ${password}\n\nPlease keep this password safe.`,
            html: `
                <h3>Hello ${username},</h3>
                <p>Your account has been created successfully.</p>
                <ul>
                    <li><strong>Username:</strong> ${username}</li>
                    <li><strong>Password:</strong> ${password}</li>
                </ul>
                <p>Please keep this password safe.</p>
            `,
        });
        console.log(`Email sent to ${email}`);
    } catch (error) {
        console.error(`Failed to send email to ${email}:`, error.message);
    }
};

const importUsers = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        // Find or create 'user' role
        let roleUser = await Role.findOne({ name: "user" });
        if (!roleUser) {
            console.log("Role 'user' not found. Creating it...");
            roleUser = new Role({
                name: "user",
                description: "Standard User Role"
            });
            await roleUser.save();
        }

        const roleId = roleUser._id;
        console.log(`Role 'user' ID: ${roleId}`);

        // Generate and import 99 users
        const usersToInsert = [];
        
        for (let i = 1; i <= 99; i++) {
            const numStr = i.toString().padStart(2, "0");
            const username = `user${numStr}`;
            const email = `user${numStr}@haha.com`;
            const password = generateRandomPassword(16);

            // Check if user already exists
            const existingUser = await User.findOne({ 
                $or: [{ username }, { email }] 
            });

            if (!existingUser) {
                // Create new user document
                const newUser = new User({
                    username,
                    email,
                    password, // The pre-save hook in the schema will hash this
                    role: roleId
                });

                await newUser.save();
                console.log(`User created: ${username} (${email}) - Password: ${password}`);

                // Send email
                await sendPasswordEmail(email, username, password);
                
                usersToInsert.push(newUser);
            } else {
                console.log(`User ${username} or email ${email} already exists. Skipping.`);
            }
        }

        console.log(`\nImport Process Finished! Total users created in this run: ${usersToInsert.length}`);

    } catch (error) {
        console.error("Error during user import:", error);
    } finally {
        // Disconnect from database
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB");
        process.exit();
    }
};

importUsers();
