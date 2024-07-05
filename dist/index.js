"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ws_1 = __importDefault(require("ws"));
const ioredis_1 = require("ioredis");
const cors_1 = __importDefault(require("cors"));
require('dotenv').config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
const client = new ioredis_1.Redis(process.env.REDIS_SERVER);
// Create HTTP server
const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
// Create WebSocket server
const wss = new ws_1.default.Server({ server });
// Hashmap to store userId and WebSocket instance
const userSocketMap = {};
wss.on("connection", (ws, req) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.url ? new URL(req.url, `http://${req.headers.host}`).searchParams.get('userId') : undefined;
    if (userId) {
        // Store userId in WebSocket instance
        ws.userId = userId;
        console.log("User connected:", userId);
        // Store userId and WebSocket instance in hashmap
        userSocketMap[userId] = ws;
        // Push userId to Redis for tracking
        yield client.set(`wsUserId:${userId}`, 'true');
    }
    ws.on("message", (message) => __awaiter(void 0, void 0, void 0, function* () {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage && parsedMessage.code && parsedMessage.language) {
            // Push code submission to Redis list
            yield pushCodeSubmissionToQueue(ws.userId, parsedMessage.code, parsedMessage.language);
        }
    }));
    ws.on("close", () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Closing the WebSocket");
        if (userId) {
            // Remove userId from Redis upon WebSocket close
            yield client.del(`wsUserId:${userId}`);
            // Remove userId and WebSocket instance from hashmap
            delete userSocketMap[userId];
        }
    }));
}));
function pushCodeSubmissionToQueue(userId, code, language) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!userId)
            return; // No userId, skip handling submission
        console.log("Pushing code", code);
        const submission = JSON.stringify({ userId, code, language });
        yield client.lpush("submissions", submission);
    });
}
// Health check endpoint
app.get("/", (req, res) => {
    return res.json({ message: "Healthy server" });
});
app.get("/redis", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const message = yield client.brpop("submissions", 0);
    return res.json({ message });
}));
app.post("/output", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, output, error } = req.body;
    const ws = userSocketMap[userId];
    if (ws && ws.readyState === ws_1.default.OPEN) {
        if (error) {
            ws.send(error);
        }
        else {
            ws.send("\n" + output);
        }
        res.json({ success: true });
    }
    else {
        res.status(404).json({ success: false, message: "User not found or WebSocket connection is not open." });
    }
}));
