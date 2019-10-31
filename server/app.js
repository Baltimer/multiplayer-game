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
var PLAYER_LIST = [];

var Player = function(id) {
  var self = {
    x: 250,
    y: 250,
    id: id,
    number: "" + Math.floor(10 * Math.random()),
    pressingRight: false,
    pressingLeft: false,
    pressingUp: false,
    pressingDown: false,
    maxSpeed: 10
  }

  self.updatePosition = function() {
    if(self.pressingRight) self.x += self.maxSpeed;
    if(self.pressingLeft) self.x -= self.maxSpeed;
    if(self.pressingUp) self.y -= self.maxSpeed;
    if(self.pressingDown) self.y += self.maxSpeed;
  }

  return self;
}
// Socket.io config

var io = require('socket.io')(server, {});
io.sockets.on('connection', function(socket) {
  SOCKET_LIST.push(socket);

  var player = Player(socket.id);
  PLAYER_LIST.push(player);

  socket.on('disconnect', function() {
    SOCKET_LIST = SOCKET_LIST.filter((sock) => sock.id != socket.id)
    PLAYER_LIST = PLAYER_LIST.filter((play) => play.id != socket.id)
  });

  socket.on('keyPress', function(data) {
    if (data.inputId === 'left')
      player.pressingLeft = data.state;
    else if(data.inputId === 'right')
      player.pressingRight = data.state;
    else if(data.inputId === 'up')
      player.pressingUp = data.state;
    else if(data.inputId === 'down')
      player.pressingDown = data.state;
  });
});

setInterval(function() {
  var pack = [];
  PLAYER_LIST.forEach((player) => {
    player.updatePosition();
    pack.push({
      y: player.y,
      x: player.x,
      number: player.number
    });
  });

  SOCKET_LIST.forEach((socket) => {
    socket.emit('newPositions', pack);
  });
}, 1000/25);