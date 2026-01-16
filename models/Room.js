// name=models/Room.js
const mongoose = require("mongoose");
const RoomSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ["call","meeting","space"], default: "call" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  participants: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, joinedAt: Date }],
  meta: Object,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model("Room", RoomSchema);

// name=models/CallLog.js
const CallLogSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  startedAt: Date,
  endedAt: Date,
  participants: [{ userId: String, joinedAt: Date, leftAt: Date }],
  stats: Object
});
module.exports = mongoose.model("CallLog", CallLogSchema);