import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';

const prodcution = "production";  
const prodServer = 'http://3.26.2.125:3001';
const prodClient = ''

const baseUrl = prodcution === 'prodcution' ? prodServer : 'http://localhost:3001'; // Our Express API endpoints
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: prodcution === 'production' ? prodClient : 'http://localhost:3000', // Allow all origins
    credentials: true,
  }
});

// Use JWT for WebSocket authentication (no Passport here)
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  console.log('token : ', token);
  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }
  try {
    // Verify the token using our secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    // Attach the decoded payload and original token to the socket
    socket.user = decoded;
    socket.token = token;
    next();
  } catch (error) {
    console.error("JWT validation error:", error);
    return next(new Error("Authentication error: Invalid token"));
  }
});

io.on('connection', (socket) => {
  console.log("User connected:", socket.user);

  // Event: Fetch streams
  socket.on("getstreams", async (req) => {
    const { creatorId, playVideo, cookies } = req;
    try {
      // Use our endpoints: if playVideo is true, use the creatorId query; otherwise, use /streams/my
      const endpoint = playVideo ? `/streams?creatorId=${creatorId}` : `/streams/my`;
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "GET",
        headers: {
          Cookie: cookies || "",
          Authorization: `Bearer ${socket.token}`,
        },
      });
      const data = await response.json();
      socket.emit("streamsData", data);
    } catch (error) {
      console.error("Error fetching streams:", error);
    }
  });

  // Event: Create a stream
  socket.on("createstreams", async (req) => {
    const { creatorId, inputLink } = req;
    try {
      const response = await fetch(`${baseUrl}/streams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${socket.token}`,
        },
        body: JSON.stringify({ creatorId, url: inputLink }),
      });
      const data = await response.json();
      socket.emit("streamCreated", data);
      console.log("Stream creation result:", data);
    } catch (error) {
      console.error("Error creating stream:", error);
    }
  });

  // Event: Handle vote (upvote or downvote)
  socket.on("handlevote", async (req) => {
    const { id, isUpvote } = req;
    try {
      const endpoint = isUpvote ? "/streams/upvote" : "/streams/downvote";
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${socket.token}`,
        },
        body: JSON.stringify({ streamId: id }),
      });
      const data = await response.json();
      socket.emit("voteHandled", data);
    } catch (error) {
      console.error("Error handling vote:", error);
    }
  });

  // Event: Play the next stream
  socket.on("playnext", async () => {
    try {
      const response = await fetch(`${baseUrl}/streams/next`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${socket.token}`,
        },
      });

      console.log("response : ", response);
      const data = await response.json();
      socket.emit("nextStream", data);
    } catch (error) {
      console.error("Error playing next stream:", error);
    }
  });
});

const port = process.env.PORT || 8080;
httpServer.listen(port, () => {
  console.log(`> Ready on http://localhost:${port}`);
});
