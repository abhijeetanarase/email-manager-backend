import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./configs/connectdb";
import userRouter from "./routes/user";
import emailCredRouter from "./routes/emailcred";
import emailRouter from "./routes/email";
import SlackRouter from "./routes/slack"
import http from "http";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";

import cors from "cors";
import { startWatchingAllEmails } from "./utils/connectIMap";
import handleSocketConnection from "./utils/replyGeneration";

dotenv.config();

const app = express();
const PORT = process.env.PORT;

// Use CORS with explicit origin and credentials support
app.use(cors({
  origin: process.env.FRONTEND_URL ,
  credentials: false
}));

app.use(express.json());
app.use("/api/user", userRouter);
app.use("/api/emailcred", emailCredRouter);
app.use("/api/email", emailRouter);
app.use('/api/slack', SlackRouter);

connectDB();

app.get("/", (req, res) => {
  res.send("API is working 🚀");
});
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  let token = url.searchParams.get("token");
  if (!token) return ws.close(4001, "Token missing");

  // Trim "Bearer " if present
  if (token.startsWith("Bearer ")) {
    token = token.slice(7).trim();
  }

  // Ensure JWT_SECRET is a string and not undefined
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || typeof jwtSecret !== "string" || jwtSecret.trim() === "") {
    ws.close(4002, "JWT secret not configured");
    return;
  }

  try {
    // jwt.verify expects a string secret, not undefined
    const decoded = jwt.verify(token, jwtSecret) as { id: string };
    const userId = decoded.id;
    if (!userId) {
      ws.close(4002, "Invalid token");
      return;
    }
    handleSocketConnection(ws, userId);
  } catch (err) {
    console.error("JWT verification error:", err);
    ws.close(4002, "Invalid token");
  }
});

// Add this function to call OpenRouter API

server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await startWatchingAllEmails();
});
