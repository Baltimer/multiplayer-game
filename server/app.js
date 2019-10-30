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

var SOCKET_LIST = [];
// Socket.io config

var io = require('socket.io')(server, {});
io.sockets.on('connection', function(socket) {
  socket.x = 0;
  socket.y = 0;
  SOCKET_LIST.push(socket);
});

setInterval(function() {
  var pack = [];
  SOCKET_LIST.forEach((socket) => {
    socket.x++;
    socket.y++;
    pack.push({
      y: socket.y,
      x: socket.x
    });

    socket.emit('newPositions', pack);
  });
}, 1000/25);