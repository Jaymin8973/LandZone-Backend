const express = require("express");
const mysql = require("mysql2/promise")
const dotenv = require("dotenv")
const cors = require("cors")



dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Promise-based pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ✅ Init DB (tables create if not exist)
async function initDB() {
  try {
    const conn = await pool.getConnection();

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS teams (
        team_id INT AUTO_INCREMENT PRIMARY KEY,
        team_name VARCHAR(100) NOT NULL,
        team_logo_url VARCHAR(255),
        leader_in_game_name VARCHAR(100),
        leader_real_name VARCHAR(100),
        contact_number VARCHAR(20),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS players (
        player_id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT,
        player_slot TINYINT,
        in_game_name VARCHAR(100),
        bgmi_id VARCHAR(50),
        FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE
      )
    `);

    conn.release();
    console.log("✅ Database initialized successfully");
  } catch (err) {
    console.error("❌ Database init failed:", err.message);
  }
}
initDB();

// ================== ROUTES ===================

// Add new team
app.post("/teams", async (req, res) => {
  const {
    team_name,
    team_logo_url,
    leader_in_game_name,
    leader_real_name,
    contact_number,
    email,
    players,
  } = req.body;

  if (!team_name || !players || players.length !== 4) {
    return res.status(400).json({ error: "Team name & 4 players required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [teamResult] = await conn.execute(
      `INSERT INTO teams 
      (team_name, team_logo_url, leader_in_game_name, leader_real_name, contact_number, email)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        team_name,
        team_logo_url,
        leader_in_game_name,
        leader_real_name,
        contact_number,
        email,
      ]
    );

    const teamId = teamResult.insertId;

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      await conn.execute(
        `INSERT INTO players (team_id, player_slot, in_game_name, bgmi_id)
         VALUES (?, ?, ?, ?)`,
        [teamId, i + 1, p.in_game_name, p.bgmi_id]
      );
    }

    await conn.commit();
    res.json({ success: true, team_id: teamId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to save team" });
  } finally {
    conn.release();
  }
});

// Get all teams with players
app.get("/teams", async (req, res) => {
  try {
    const [teams] = await pool.query("SELECT * FROM teams");
    const [players] = await pool.query("SELECT * FROM players");

    const teamMap = {};
    teams.forEach((t) => (teamMap[t.team_id] = { ...t, players: [] }));
    players.forEach((p) => {
      if (teamMap[p.team_id]) teamMap[p.team_id].players.push(p);
    });

    res.json(Object.values(teamMap));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

// Get single team
app.get("/teams/:id", async (req, res) => {
  const teamId = req.params.id;
  try {
    const [teams] = await pool.query("SELECT * FROM teams WHERE team_id = ?", [
      teamId,
    ]);
    if (teams.length === 0) return res.status(404).json({ error: "Not found" });

    const [players] = await pool.query(
      "SELECT * FROM players WHERE team_id = ? ORDER BY player_slot",
      [teamId]
    );

    res.json({ ...teams[0], players });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch team" });
  }
});

// Start server
app.listen(process.env.PORT, () =>
  console.log(`🚀 Server running on port ${process.env.PORT}`)
);