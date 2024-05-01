"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ioredis_1 = require("ioredis");
const ws_1 = __importDefault(require("ws"));
const app = (0, express_1.default)();
const client = new ioredis_1.Redis();
const server = app.listen(3000, () => {
    console.log("App is listening on port 3000");
});
const wss = new ws_1.default.Server({ server });
wss.on("connection", (ws, req) => {
    const userId = req.url ? new URL(req.url, 'http://localhost').searchParams.get('userId') : undefined;
    if (userId) {
        ws.userId = userId;
    }
    ws.on("message", (message) => {
        console.log(`Received message from userId ${ws.userId}: ${message}`);
        // You can process the message here as needed
    });
    ws.on("close", () => {
        delete ws.userId;
    });
});
app.post("/output", (req, res) => {
    const { userId, output } = req.body;
    wss.clients.forEach((ws) => {
        if (ws.userId === userId && ws.readyState === ws_1.default.OPEN) {
            ws.send(output);
        }
    });
    res.json({ success: true });
});
// Route to handle code submissions
app.post("/submit", (req, res) => {
    const { problemId, userId, code, language } = req.body;
    client.lpush("submissions", JSON.stringify({ problemId, userId, code, language }));
    res.json({ message: "Submission received" });
});
// Health check endpoint
app.get("/", (req, res) => {
    return res.json({ message: "Healthy server" });
});
