const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const Document = require('./models/Document');
const commentRoutes = require('./routes/comments');
const documentRoutes = require('./routes/Document');
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const { attachAISockets } = require('./sockets/aiSocket');

const app = express();

const server = http.createServer(app);
mongoose.connect(process.env.MONGO_URI ||'' ,{});
app.use(cors());
app.use(express.json());

// Use routes
app.use('/comments', commentRoutes);
app.use('/document', documentRoutes);
app.use('/auth', authRoutes);
app.use('/ai', aiRoutes); // <-- AI endpoints

app.use(cors({
  origin: "http://localhost:5173",  // your frontend's port
  methods: ["GET", "POST"],
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  const username = socket.handshake.query.username || 'anonymous';
  console.log(`${username} connected`);

  socket.join('doc-room');

  socket.on('join-doc', async () => {
    const doc = await Document.findOne({});
    socket.emit('load-doc', doc?.content || '');
  });

  socket.on('send-changes', async (newContent) => {
    socket.broadcast.emit('receive-changes', newContent);
    await Document.findOneAndUpdate({}, { content: newContent }, { upsert: true });
  });

  socket.on('disconnect', () => {
    console.log(`${username} disconnected`);
  });
});

// Removed in-memory comments and REST routes for comments here

// Attach AI socket handlers (they will add additional listeners to same io)
attachAISockets(io);

server.listen(3001, () => {
  console.log(`Server listening on port http://localhost:3001/comments/shared-doc`);
});
