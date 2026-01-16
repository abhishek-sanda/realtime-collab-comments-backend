const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Join room & relay offers/answers/ice
io.of("/ws/call").on("connection", (socket) => {
  const user = socket.handshake.query.username || null;
  const userId = socket.handshake.query.userId || null;

  console.log(`User ${user} (${userId}) connected for calls`);

  socket.on("join", ({ roomId }) => {
    socket.join(roomId);
    console.log(`${user} joined room ${roomId}`);
    
    // Notify others in room about new peer
    socket.to(roomId).emit("peer-joined", { 
      socketId: socket.id, 
      user,
      userId 
    });

    // Send existing peers to new user
    const room = socket.nsp.adapter.rooms.get(roomId);
    
    const peers = Array.from(room || [])
      .filter(id => id !== socket.id)
      .map(id => {
        const peerSocket = socket.nsp.sockets.get(id);
        return {
          socketId: id,
          user: peerSocket?.handshake.query.username || 'Unknown'
        };
      });
    
    socket.emit("peers", peers);
  });

  socket.on("signal", ({ roomId, to, signal }) => {
    // Forward signal to specific peer
    io.of("/ws/call").to(to).emit("signal", { 
      from: socket.id,
      roomId,
      signal 
    });
  });

  socket.on("leave", ({ roomId }) => {
    socket.leave(roomId);
    console.log(`${user} left room ${roomId}`);
    socket.to(roomId).emit("peer-left", { 
      socketId: socket.id,
      user 
    });
  });

  socket.on("disconnect", () => {
    console.log(`User ${user} disconnected`);
  });
});

server.listen(process.env.SIGNALING_PORT || 3002, () => {
  console.log(`Signaling server running on port ${process.env.SIGNALING_PORT || 3002}`);
});
