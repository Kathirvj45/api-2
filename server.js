const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json()); // Allow JSON requests

const GEOCODE_API_KEY = "d6363f444b384201b35bb327964086ac";

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Redirect `/form` to `index.html`
app.get("/form", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});
// PostgreSQL connection (update with your Neon.tech credentials)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Store credentials in .env file
    ssl: { rejectUnauthorized: false }, // Required for Neon.tech
});

// 📌 Function to fetch coordinates
async function fetchCoordinates(location) {
    try {
        const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(location)}&key=${GEOCODE_API_KEY}`);
        const data = await response.json();

        if (data.results.length > 0) {
            return {
                latitude: data.results[0].geometry.lat,
                longitude: data.results[0].geometry.lng
            };
        }
    } catch (error) {
        console.error("Error fetching coordinates:", error);
    }
    return { latitude: null, longitude: null };
}

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
        let { crime_type, location, latitude, longitude } = req.body;

        // If coordinates are missing, fetch them
        if (!latitude || !longitude) {
            ({ latitude, longitude } = await fetchCoordinates(location));
        }

        // Fetch the total count of existing records
        const countResult = await pool.query("SELECT COUNT(*) FROM crimes");
        const newId = parseInt(countResult.rows[0].count) + 1; // Get the next ID

        const result = await pool.query(
            "INSERT INTO crimes (id, crime_type, location, latitude, longitude) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [newId, crime_type, location, latitude, longitude]
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
        const { crime_type, location, latitude, longitude } = req.body;

        await pool.query(
            "UPDATE crimes SET crime_type = $1, location = $2, latitude = $3, longitude = $4 WHERE id = $5",
            [crime_type, location, latitude, longitude, id]
        );
        res.send("Crime updated successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating crime");
    }
});

// 📌 DELETE a crime record
// 📌 DELETE a crime record and reorder IDs
app.delete("/crimes/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Delete the crime record
        await pool.query("DELETE FROM crimes WHERE id = $1", [id]);

        // Reorder IDs to maintain sequential numbering
        await pool.query(`
            WITH reordered AS (
                SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS new_id FROM crimes
            )
            UPDATE crimes c
            SET id = r.new_id
            FROM reordered r
            WHERE c.id = r.id
        `);

        res.send("Crime deleted and IDs reordered successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting crime");
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
