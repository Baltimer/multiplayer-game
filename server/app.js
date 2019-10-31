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

// Entity class
var Entity = function() {
  var self = {
    x: 250,
    y: 250,
    xSpeed: 0,
    ySpeed: 0,
    id: ""
  }

  self.update = function() {
    self.updatePosition();
  }

  self.updatePosition = function() {
    self.x += self.xSpeed;
    self.y += self.ySpeed;
  }

  self.getDistance = function(pt) {
    return Math.sqrt(Math.pow(self.x - pt.x, 2) + Math.pow(self.y - pt.y));
  }

  return self;
}

// Player class
var Player = function(id) {
  var self = Entity();
  self.id = id;
  self.number = "" + Math.floor(10 * Math.random());
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.pressingAttack = false;
  self.mouseAngle = 0;
  self.maxSpeed = 10;

  var super_update = self.update;
  self.update = function() {
    self.updateSpeed();
    super_update();

    if(self.pressingAttack){
      self.shootBullet(self.mouseAngle);
    }
  }

  self.shootBullet = function(angle){
    var bullet = Bullet(self.id, angle);
    bullet.x = self.x;
    bullet.y = self.y;
  }

  self.updateSpeed = function() {
    if(self.pressingRight)
      self.xSpeed = self.maxSpeed;
    else if(self.pressingLeft)
      self.xSpeed = -self.maxSpeed;
    else
      self.xSpeed = 0;

    if(self.pressingUp)
      self.ySpeed = -self.maxSpeed;
    else if(self.pressingDown)
      self.ySpeed = self.maxSpeed;
    else
      self.ySpeed = 0;
  }

  Player.list.push(self);

  return self;
}

// Global Player config
Player.list = [];
Player.onConnect = function(socket){
  var player = Player(socket.id);

  socket.on('keyPress', function(data) {
    if (data.inputId === 'left')
      player.pressingLeft = data.state;
    else if(data.inputId === 'right')
      player.pressingRight = data.state;
    else if(data.inputId === 'up')
      player.pressingUp = data.state;
    else if(data.inputId === 'down')
      player.pressingDown = data.state;
    else if(data.inputId === 'attack')
      player.pressingAttack = data.state;
    else if(data.inputId === 'mouseAngle')
      player.mouseAngle = data.state;
  });
}
Player.onDisconnect = function(socket) {
  Player.list = Player.list.filter((play) => play.id != socket.id)
}
Player.update = function(){
  var pack = [];
  Player.list.forEach((player) => {
    player.update();
    pack.push({
      y: player.y,
      x: player.x,
      number: player.number
    });
  });
  return pack;
}

// Bullet class
var Bullet = function(parent, angle) {
  var self = Entity();
  self.id = Math.random();
  self.xSpeed = Math.cos(angle/180 * Math.PI) * 10;
  self.ySpeed = Math.sin(angle/180 * Math.PI) * 10;
  self.parent = parent;
  self.timer = 0;
  self.toRemove = false;
  var super_update = self.update;
  self.update = function() {
    if(self.timer++ > 100) self.toRemove = true;
    super_update();

    Player.list.forEach((player) => {
      if(self.getDistance(player) < 32 && self.parent !== player.id) {
        // handle collision. Ex: hp--; Future
        console.log('entra');
        self.toRemove = true;
      }
    });
  }
  Bullet.list.push(self);

  return self;
  // Bullet.list = Bullet.list.filter((bult) => bult.id != self.id)
}
Bullet.list = [];
Bullet.update = function(){
  var pack = [];
  Bullet.list.forEach((bullet) => {
    bullet.update();
    if(bullet.toRemove) 
      Bullet.list = Bullet.list.filter((bult) => bult.id != bullet.id);
    else
      pack.push({
        y: bullet.y,
        x: bullet.x
      });
  });
  return pack;
}

// Socket.io config
var io = require('socket.io')(server, {});
io.sockets.on('connection', function(socket) {
  SOCKET_LIST.push(socket);

  Player.onConnect(socket);
  socket.on('disconnect', function() {
    SOCKET_LIST = SOCKET_LIST.filter((sock) => sock.id != socket.id)
    Player.onDisconnect(socket);
  });

  socket.on('sendMsgToServer', function(data) {
    var playerName = ("" + socket.id).slice(2,7);
    SOCKET_LIST.forEach((socket) => {
      socket.emit('addToChat', playerName + ': ' + data);
    });
  });

  socket.on('evalServer', function(data) {
    if(!process.env.DEBUG) socket.emit('evalAnswer', 'Not in debug mode');
    var res = eval(data);
    socket.emit('evalAnswer', res);
  });
});

setInterval(function() {
 var pack = {
   player: Player.update(),
   bullet: Bullet.update()
 }

  SOCKET_LIST.forEach((socket) => {
    socket.emit('newPositions', pack);
  });
}, 1000/25);