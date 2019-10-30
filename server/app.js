var express = require('express');
var app = express();
var server = require('http').Server(app);

// Load ENV variables
const dotenv = require('dotenv');
dotenv.config();

var path = require('path');
app.get('/', function(req, res) {
  res.sendFile(path.resolve('client/index.html'));
});
app.use(express.static(path.resolve('client')));

server.listen(process.env.SERVER_PORT);
console.log('Server started on port: ' + process.env.SERVER_PORT);

// Socket.io config
var io = require('socket.io')(server, {});
io.sockets.on('connection', function(socket) {
  console.log(socket.id);
})