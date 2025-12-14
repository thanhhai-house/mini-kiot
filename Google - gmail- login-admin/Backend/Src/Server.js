import express from "express";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { makeGoogleVerifier } from "./auth.js";
import { requireAuth, requireAdmin } from "./middleware.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

if (!GOOGLE_CLIENT_ID || !JWT_SECRET || !ADMIN_EMAIL) {
  console.error("Missing env. Please set GOOGLE_CLIENT_ID, JWT_SECRET, ADMIN_EMAIL");
  process.exit(1);
}

const verifyGoogleIdToken = makeGoogleVerifier(GOOGLE_CLIENT_ID);

// (dev) cho frontend gọi backend ở máy local
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.post("/auth/google", async (req, res) => {
  try {
    const { id_token } = req.body;
    if (!id_token) return res.status(400).json({ error: "Missing id_token" });

    const user = await verifyGoogleIdToken(id_token);

    // ✅ Chỉ đúng email này là admin, còn lại là khách
    const isAdmin = user.email === ADMIN_EMAIL;

    const appToken = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: isAdmin ? "admin" : "user"
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token: appToken,
      user: { email: user.email, name: user.name, role: isAdmin ? "admin" : "user" }
    });
  } catch (e) {
    res.status(401).json({ error: e?.message || "Unauthorized" });
  }
});

app.get("/me", requireAuth(JWT_SECRET), (req, res) => {
  res.json({ user: req.user });
});

app.get("/admin/dashboard", requireAuth(JWT_SECRET), requireAdmin, (req, res) => {
  res.json({ ok: true, message: `Hello admin: ${req.user.email}` });
});

app.listen(PORT, () => {
  console.log(`Backend running http://localhost:${PORT}`);
});
