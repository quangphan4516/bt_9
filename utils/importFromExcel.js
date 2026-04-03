const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const path = require("path");
const xlsx = require("xlsx"); // Import xlsx library

// Import models
const User = require("../schemas/users");
const Role = require("../schemas/roles");

// DB Connection
const MONGO_URI = "mongodb://localhost:27017/nnptud-c6";

// Nodemailer config
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

const importUsersFromExcel = async () => {
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

        // Read Excel File
        const excelFilePath = path.join(__dirname, "../user.xlsx");
        console.log(`Reading Excel file from: ${excelFilePath}`);

        const workbook = xlsx.readFile(excelFilePath);
        const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
        const sheet = workbook.Sheets[sheetName];

        // Convert sheet to JSON array
        // This assumes the first row has headers 'username' and 'email'
        const usersData = xlsx.utils.sheet_to_json(sheet);
        console.log(`Found ${usersData.length} users in the Excel file.`);

        const usersToInsert = [];
        
        for (const row of usersData) {
            // Trim whitespace just in case
            const username = row.username ? row.username.toString().trim() : null;
            const email = row.email ? row.email.toString().trim() : null;

            if (!username || !email) {
                console.log(`Skipping invalid row: ${JSON.stringify(row)}`);
                continue;
            }

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

importUsersFromExcel();
