// main server with Socket.IO handlers for presence, typing, delivery/read receipts
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');

const Message = require('../models/Message');
const messageRoutes = require('../routes/messages');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_ORIGIN || 'https://realtime-collab-comments-frontend.vercel.app', methods: ['GET', 'POST'] }
});

mongoose.connect(process.env.MONGO_URI || '', {})
app.use(cors());
app.use(express.json());
app.use('/messages', messageRoutes);

// In-memory presence map: { socketId: { userId, username, status, lastActive } }
// For multi-node, replace with Redis or similar.
const presenceBySocket = new Map();
const usersInRoom = new Map(); // roomId -> Map(userId -> { username, lastSeen, onlineCount })

function emitPresenceList(roomId) {
  const map = usersInRoom.get(roomId) || new Map();
  const list = Array.from(map.values()).map(v => ({ userId: v.userId, username: v.username, lastSeen: v.lastSeen, online: v.onlineCount > 0 }));
  io.to(roomId).emit('presence:list', list);
}

io.on('connection', (socket) => {
  // Expect client to pass query: ?userId=...&username=...
  const { userId, username } = socket.handshake.query;
  socket.data.user = { userId, username };

  socket.on('join', ({ conversationId }) => {
    // join socket room
    socket.join(conversationId);
    // update presence
    presenceBySocket.set(socket.id, { userId, username, status: 'online', lastActive: new Date() });
    // track users in room
    const map = usersInRoom.get(conversationId) || new Map();
    const entry = map.get(userId) || { userId, username, lastSeen: new Date(), onlineCount: 0 };
    entry.username = username;
    entry.onlineCount = (entry.onlineCount || 0) + 1;
    entry.lastSeen = new Date();
    map.set(userId, entry);
    usersInRoom.set(conversationId, map);
    emitPresenceList(conversationId);
  });

  socket.on('leave', ({ conversationId }) => {
    socket.leave(conversationId);
    const map = usersInRoom.get(conversationId);
    if (map) {
      const entry = map.get(userId);
      if (entry) {
        entry.onlineCount = Math.max(0, (entry.onlineCount || 1) - 1);
        entry.lastSeen = new Date();
        map.set(userId, entry);
      }
      usersInRoom.set(conversationId, map);
      emitPresenceList(conversationId);
    }
  });

  socket.on('typing', ({ conversationId, typing }) => {
    // Broadcast typing status to others in room
    socket.to(conversationId).emit('typing', { userId, username, typing });
  });

  socket.on('message:send', async ({ conversationId, content }) => {
    try {
      // Build initial statuses: sender -> read, others -> sent
      const participantsMap = usersInRoom.get(conversationId) || new Map();
      const statuses = [];
      // add sender as read
      statuses.push({ userId, status: 'read', updatedAt: new Date() });
      // other known users -> sent
      for (const [uid, info] of participantsMap) {
        if (uid === userId) continue;
        statuses.push({ userId: uid, status: 'sent', updatedAt: new Date() });
      }
      const msg = await Message.create({
        conversationId,
        senderId: userId,
        senderName: username,
        content,
        statuses
      });
      // broadcast new message to room
      io.to(conversationId).emit('message:new', msg);
    } catch (err) {
      console.error('message:send error', err);
      socket.emit('error', { error: 'message send failed' });
    }
  });

  socket.on('message:delivered', async ({ messageId }) => {
    try {
      if (!messageId) return;
      const msg = await Message.findById(messageId);
      if (!msg) return;
      // find or add status for this user
      const s = msg.statuses.find(st => st.userId === userId);
      if (s) {
        s.status = 'delivered';
        s.updatedAt = new Date();
      } else {
        msg.statuses.push({ userId, status: 'delivered', updatedAt: new Date() });
      }
      await msg.save();
      io.to(msg.conversationId).emit('message:status', { messageId: msg._id, userId, status: 'delivered' });
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('message:read', async ({ messageId }) => {
    try {
      if (!messageId) return;
      const msg = await Message.findById(messageId);
      if (!msg) return;
      const s = msg.statuses.find(st => st.userId === userId);
      if (s) {
        s.status = 'read';
        s.updatedAt = new Date();
      } else {
        msg.statuses.push({ userId, status: 'read', updatedAt: new Date() });
      }
      await msg.save();
      io.to(msg.conversationId).emit('message:status', { messageId: msg._id, userId, status: 'read' });
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('disconnect', () => {
    // cleanup presenceBySocket & usersInRoom entries
    presenceBySocket.delete(socket.id);
    // decrement onlineCount for rooms this socket belonged to
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    for (const roomId of rooms) {
      const map = usersInRoom.get(roomId);
      if (!map) continue;
      const entry = map.get(userId);
      if (!entry) continue;
      entry.onlineCount = Math.max(0, (entry.onlineCount || 1) - 1);
      entry.lastSeen = new Date();
      map.set(userId, entry);
      usersInRoom.set(roomId, map);
      emitPresenceList(roomId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
