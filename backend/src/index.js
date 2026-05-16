require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/rooms', require('./routes/rooms'));
app.use('/gifts', require('./routes/gifts'));
app.use('/coins', require('./routes/coins'));
app.use('/swipe', require('./routes/swipe'));
app.use('/feed', require('./routes/feed'));
app.use('/notifications', require('./routes/notifications'));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

require('./socket')(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`LMK server running on port ${PORT}`));
