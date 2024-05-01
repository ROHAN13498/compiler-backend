import express from "express";
import { Redis } from "ioredis";
import WebSocket from "ws";
require('dotenv').config()

import cors from "cors"

interface CustomWebSocket extends WebSocket {
    userId?: string;
}

const app = express();
app.use(express.json());
app.use(cors());
const client = new Redis(process.env.REDIS_SERVER!);

const server = app.listen(3000, () => {
    console.log("App is listening on port 3000");
});
const wss = new WebSocket.Server({ server });

// Hashmap to store userId and WebSocket instance
const userSocketMap: { [userId: string]: CustomWebSocket } = {};

wss.on("connection", async (ws: CustomWebSocket, req) => {
    const userId = req.url ? new URL(req.url, 'http://localhost').searchParams.get('userId') : undefined;
    if (userId) {
        // Store userId in WebSocket instance
        ws.userId = userId;
        console.log("User connected:", userId);

        // Store userId and WebSocket instance in hashmap
        userSocketMap[userId] = ws;

        // Push userId to Redis for tracking
        await client.set(`wsUserId:${userId}`, 'true');
    }

    ws.on("message", async (message: string) => {
        //console.log(`Received message from userId ${ws.userId}: ${message}`);
        const parsedMessage = JSON.parse(message);
        if (parsedMessage && parsedMessage.code && parsedMessage.language) {
            // Push code submission to Redis list
            await pushCodeSubmissionToQueue(ws.userId, parsedMessage.code, parsedMessage.language);
        }
    });

    ws.on("close", async () => {
        console.log("Closing the WebSocket");
        if (userId) {
            // Remove userId from Redis upon WebSocket close
            await client.del(`wsUserId:${userId}`);
            // Remove userId and WebSocket instance from hashmap
            delete userSocketMap[userId];
        }
    });
});

async function pushCodeSubmissionToQueue(userId: string | undefined, code: string, language: string) {
    if (!userId) return; // No userId, skip handling submission
    console.log("pushing code",code)
    const submission = JSON.stringify({ userId, code, language });
    await client.lpush("submissions", submission);
}

// Health check endpoint
app.get("/", (req, res) => {
    return res.json({ message: "Healthy server" });
});

app.get("/redis",async (req,res)=>{
    const message=await client.brpop("submissions",0)
    return res.json({message})
})

app.post("/output", async (req, res) => {
    const { userId, output,error} = req.body;
    const ws = userSocketMap[userId];
    if (ws && ws.readyState === WebSocket.OPEN) {
        if(error){
            console.log(req.body)
            ws.send(error)
        }
        else{
            console.log("output",output)
            ws.send("\n"+output);
        }
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: "User not found or WebSocket connection is not open." });
    }
});
