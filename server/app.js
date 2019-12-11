var mongojs = require('mongojs');
var db = mongojs('mongodb+srv://test:1234@testing-wp2z5.mongodb.net/test', ['account', 'progress']);

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
// app.use(express.static(path.resolve('client')));
app.use('/client', express.static(__dirname + '/client'));

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
    return Math.sqrt(Math.pow(self.x - pt.x, 2) + Math.pow(self.y - pt.y, 2));
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
  self.hp = 10;
  self.maxHp = 10;
  self.score = 0;

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

  self.getInitPack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      number: self.number,
      hp: self.hp,
      maxHp: self.maxHp,
      score: self.score
    };
  }

  self.getUpdatePack = function() {
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      hp: self.hp,
      score: self.score
    };
  }

  Player.list.push(self);
  
  initPack.player.push(self.getInitPack());

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

  var players = []
  Player.list.forEach(function(player){
    players.push(player.getInitPack());
  });

  var bullets = []
  Bullet.list.forEach(function(bullet){
    bullets.push(bullet.getInitPack());
  });

  socket.emit('init', {
    player: Player.getAllInitPack(),
    bullet: Bullet.getAllInitPack()
  });
}

Player.getAllInitPack = function() {
  var players = []
  Player.list.forEach(function(player){
    players.push(player.getInitPack());
  });
  return players;
}

Player.onDisconnect = function(socket) {
  Player.list = Player.list.filter((play) => play.id != socket.id);
  removePack.player.push(socket.id);
}
Player.update = function(){
  var pack = [];
  Player.list.forEach((player) => {
    player.update();
    pack.push(player.getUpdatePack());
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
        player.hp -= 1;
        if(player.hp <= 0) {
          var shooter = Player.list.find((p) => p.id == self.parent);
          if(shooter) shooter.score += 1;
          player.hp = player.maxHp;
          player.x = Math.random() * 500;
          player.y = Math.random() * 500;
        }
        self.toRemove = true;
      }
    });
  }

  self.getInitPack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      number: self.number
    };
  }

  self.getUpdatePack = function() {
    return {
      id: self.id,
      x: self.x,
      y: self.y
    };
  }

  Bullet.list.push(self);
  
  initPack.bullet.push(self.getInitPack());

  return self;
  // Bullet.list = Bullet.list.filter((bult) => bult.id != self.id)
}
Bullet.list = [];
Bullet.update = function(){ 
  var pack = [];
  Bullet.list.forEach((bullet) => {
    bullet.update();
    if(bullet.toRemove) {
      Bullet.list = Bullet.list.filter((bult) => bult.id != bullet.id);
      removePack.bullet.push(bullet.id);
    } else{
      pack.push(bullet.getUpdatePack());
    }
  });
  return pack;
}

Bullet.getAllInitPack = function() {
  var bullets = []
  Bullet.list.forEach(function(bullet){
    bullets.push(bullet.getInitPack());
  });
  return bullets;
}

var isValidPassword = function(data, cb) {
  db.account.find({username: data.username, password: data.password}, function(err, res) {
    if(res.length > 0){
      cb(true);
    } else {
      console.log(err);
      cb(false);
    }
  });
}

var isUsernameTaken = function(data, cb) {
  db.account.find({username: data.username}, function(err, res) {
    if(res.length > 0){
      cb(true);
    } else {
      console.log(err);
      cb(false);
    }
  });
}

var addUser = function(data, cb) {
  db.account.insert({username: data.username, password: data.password}, function(err, res) {
    if(res.length > 0){
      cb(true);
    } else {
      console.log(err);
      cb(false);
    }
  });
}

// Socket.io config
var io = require('socket.io')(server, {});
io.sockets.on('connection', function(socket) {
  SOCKET_LIST.push(socket);

  socket.on('signIn', function(data){
    isValidPassword(data, function(res){
      if(res){
        Player.onConnect(socket);    
        socket.emit('signInResponse', {success: true});
      } else {
        socket.emit('signInResponse', {success: false});
      }
    })
  });

  socket.on('signUp', function(data){
    isUsernameTaken(data, function(res){
      if(res){   
        socket.emit('signUpResponse', {success: false});
      } else {
        addUser(data, function(res){
          socket.emit('signUpResponse', {success: true});
        });
      }
    })
  });

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

var initPack = { player: [], bullet: [] };
var removePack = { player: [], bullet: [] };

setInterval(function() {
 var pack = {
   player: Player.update(),
   bullet: Bullet.update()
 }

  SOCKET_LIST.forEach((socket) => {
    socket.emit('init', initPack);
    socket.emit('update', pack);
    socket.emit('remove', removePack);
  });

  initPack.player = [];
  initPack.bullet = [];
  removePack.player = [];
  removePack.bullet = [];
}, 1000/25);