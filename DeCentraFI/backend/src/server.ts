import app from "./app.js";
import { connectDb } from "./config/db.js";

const PORT = Number(process.env.PORT) || 3001;

connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });
