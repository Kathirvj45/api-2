const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json()); // Allow JSON requests

// PostgreSQL connection (update with your Neon.tech credentials)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Store credentials in .env file
    ssl: { rejectUnauthorized: false }, // Required for Neon.tech
});

// 📌 GET all crime records
app.get("/crimes", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM crimes ORDER BY id DESC");
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

// 📌 POST a new crime record
app.post("/crimes", async (req, res) => {
    try {
        const { crime_type, location } = req.body;
        const result = await pool.query(
            "INSERT INTO crimes (crime_type, location) VALUES ($1, $2) RETURNING *",
            [crime_type, location]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error adding crime");
    }
});

// 📌 PUT (Update) a crime record
app.put("/crimes/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { crime_type, location } = req.body;
        await pool.query(
            "UPDATE crimes SET crime_type = $1, location = $2 WHERE id = $3",
            [crime_type, location, id]
        );
        res.send("Crime updated successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating crime");
    }
});

// 📌 DELETE a crime record
app.delete("/crimes/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM crimes WHERE id = $1", [id]);
        res.send("Crime deleted successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting crime");
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
