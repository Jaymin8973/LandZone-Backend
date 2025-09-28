
const mysql = require("mysql2")
const dotenv = require("dotenv")


dotenv.config();

async function testDB() {
  try {
    // ✅ mysql2/promise से connection बनाओ
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS || "", // अगर password empty है
      database: process.env.DB_NAME,
    });

    console.log("✅ Connected to MySQL!");

    // ✅ अब query await कर सकते हो
    const [rows] = await conn.execute("SELECT NOW() as now");
    console.log("Server time:", rows[0].now);

    await conn.end();
  } catch (err) {
    console.error("❌ DB connection failed:", err.message);
  }
}

testDB();
