const express = require('express')
const routes = require('routes')
const app = express()
var server = app.listen(8080)
var io = require('socket.io')(server);

const canvas_size = 1500;
const port = 3000
var players = {}
var bullets = {}
var shadows = {}

function collideCircleCircle(p1x, p1y, r1, p2x, p2y, r2) {
  let a;
  let x;
  let y;

  a = r1 + r2;
  x = p1x - p2x;
  y = p1y - p2y;

  if (a > Math.sqrt((x * x) + (y * y))) {
    return true;
  } else {
    return false;
  }
}

function tick() {
  for (let key in bullets) {
    let offset = 5;
    let bullet = bullets[key];
    let direction = bullet['direction'];

    if (direction === 'up') {
        bullet['y'] -= offset;
    } else if (direction === 'down') {
        bullet['y'] += offset;
    } else if (direction === 'left') {
        bullet['x'] -= offset;
    } else {
        bullet['x'] += offset;
    }

    if (bullet['x'] > canvas_size || bullet['x'] < 0) {
        delete bullets[key]
    }
    if (bullet['y'] > canvas_size || bullet['y'] < 0) {
        delete bullets[key]
    }

    for (let p_key in players) {
      let player = players[p_key]
      let player_x = player['x']
      let player_y = player['y']
      let killer_score = players[bullet['id']]['score']
      let x = bullet['x']
      let y = bullet['y']
      let hit = collideCircleCircle(x, y, 15, player_x, player_y, 15);
      
      if (hit && bullet['id'] != p_key) {
        player['health'] -= 20
        delete bullets[key]
        if (player['health'] <= 0) {
          player['alive'] = false
          players[bullet['id']]['score'] += 10
          shadows[Math.round(Math.random() * 10000)] = {'x': player_x,
                            'y': player_y, 'r1': 15 + (killer_score / 10) * 2,
                            'r2': 35 + (killer_score / 10) * 2,
                            'rgb': player['rgb'],
                            'duration': 2000
                          }

          io.sockets.emit('player_death', player)
          delete players[p_key]
        }
      }
    }
  }

  for (let key in shadows) {
    let shadow = shadows[key]
    shadow['duration'] -= 1
    shadow['rgb'] = [shadow['rgb'][0] + 0.2, shadow['rgb'][1] + 0.2, shadow['rgb'][2] + 0.2]
    if (shadow['duration'] <= 0) {
      delete shadows[key]
    }
  }

  io.sockets.emit('sync', {'players': players, 'bullets': bullets, 'shadows': shadows})
}


setInterval(function() {
  try {
    tick()
  } catch(err) {
    console.log(err)
  }
}, 10);

io.on('connection', function(socket) {

  socket.on('player_new', function(data) {
    let player_id = data['id'];
    players[player_id] = data;
  });
  
  socket.on('sync', function() {
    socket.emit('sync', {'players': players, 'bullets': bullets, 'shadows': shadows});
  })

  socket.on('player_move', function(data) {
    let player_id = data['id']
    players[player_id] = data;
  })

  socket.on('player_shoot', function(data) {
    let player = players[data['id']]
    let bid = data['bid']
    let id = data['id'];
    let direction = data['direction']
    let offset = 35;
    let x_offset = 0;
    let y_offset = 0;

    if (direction === 'up') {
        y_offset -= offset;
        x_offset += 0;
    } else if (direction === 'down') {
        y_offset += offset;
        x_offset += 0;
    } else if (direction === 'left') {
        x_offset -= offset;
        y_offset += 0;
    } else {
        x_offset += offset;
        y_offset += 0;
    }
    bullets[bid] = {'x': player['x'] + x_offset, 'y': player['y'] + y_offset, 'direction': direction, 'bid': bid, 'color': data['color'], 'id': id}
  })

  socket.on('player_hit', function(data) {
    delete bullets[data['bid']]
  })

  socket.on('player_die', function(data) {
    console.log(data)
    console.log('player has died')
    let player_id = data['pid']
    let killer_id = data['kid']
    delete players[player_id]
    socket.broadcast.emit('player_score', {'id': killer_id})
    socket.emit('player_death', data)
  })

  socket.on('player_color_change', function(data) {
    let player_id = data['id']
    players[player_id]['color'] = data['color']
    console.log('changing colors')
  })

  socket.on('dc', function() {
    socket.disconnect()
  })

  socket.on('disconnect', function(data) {
    console.log('player has disconnected')
    // delete players[player_id]
  });
});



app.get('/', (req, res) => res.send('  World!'))
app.use('/maze/', express.static('maze'))