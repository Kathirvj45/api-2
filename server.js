const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const cors = require("cors");
const https = require("https"); // Native module for older Node.js versions
require("dotenv").config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const GEOCODE_API_KEY = "d6363f444b384201b35bb327964086ac";

app.use(express.static(path.join(__dirname)));

app.get("/form", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// PostgreSQL connection (Neon.tech)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// 📌 Function to fetch coordinates
async function fetchCoordinates(location) {
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(location)}&key=${GEOCODE_API_KEY}`;

    try {
        console.log(`Fetching coordinates for: ${location}`);

        // Check if fetch is available (Node.js 18+)
        if (globalThis.fetch) {
            const response = await fetch(url);
            const data = await response.json();
            return parseCoordinates(data);
        }

        // Fallback for older Node.js versions
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        resolve(parseCoordinates(JSON.parse(data)));
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on("error", reject);
        });

    } catch (error) {
        console.error("Error fetching coordinates:", error);
        return { latitude: null, longitude: null };
    }
}

// Helper function to parse coordinates from API response
function parseCoordinates(data) {
    if (data.results && data.results.length > 0) {
        return {
            latitude: data.results[0].geometry.lat,
            longitude: data.results[0].geometry.lng
        };
    }
    return { latitude: null, longitude: null };
}

// 📌 GET all crime records
app.get("/crimes", async (req, res) => {
    try {
        console.log("Fetching all crimes...");
        const result = await pool.query("SELECT * FROM crimes ORDER BY id DESC");
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching crimes:", error);
        res.status(500).json({ error: "Server Error" });
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

        const result = await pool.query(
            "INSERT INTO crimes (crime_type, location, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *",
            [crime_type, location, latitude, longitude]
        );

        console.log("New crime added:", result.rows[0]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error adding crime:", error);
        res.status(500).json({ error: "Error adding crime" });
    }
});

// 📌 PUT (Update) a crime record
app.put("/crimes/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { crime_type, location, latitude, longitude } = req.body;

        const updateResult = await pool.query(
            "UPDATE crimes SET crime_type = $1, location = $2, latitude = $3, longitude = $4 WHERE id = $5 RETURNING *",
            [crime_type, location, latitude, longitude, id]
        );

        if (updateResult.rowCount === 0) {
            return res.status(404).json({ error: "Crime not found" });
        }

        console.log("Crime updated:", updateResult.rows[0]);
        res.json(updateResult.rows[0]);
    } catch (error) {
        console.error("Error updating crime:", error);
        res.status(500).json({ error: "Error updating crime" });
    }
});

// 📌 DELETE a crime record
app.delete("/crimes/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const deleteResult = await pool.query("DELETE FROM crimes WHERE id = $1 RETURNING *", [id]);

        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ error: "Crime not found" });
        }

        console.log("Crime deleted:", deleteResult.rows[0]);
        res.json({ message: "Crime deleted successfully" });
    } catch (error) {
        console.error("Error deleting crime:", error);
        res.status(500).json({ error: "Error deleting crime" });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
