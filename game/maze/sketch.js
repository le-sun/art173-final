const speed = 5;
const player_size = 50;
const canvas_w = 1200;
const canvas_h = 800;
const naturalKeyNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const ip = 'localhost';

var socket = io.connect(ip + ':8080');
var words;
var bg, start, button, red, green, blue, menu, canvas;

// Player Info
var player_name, player_id, player_id, player_rgb, player_x, player_y, player_info;
var player_score = 0;
var player_health = 100;
var player_direction = 'up';
var player_alive = true;

var in_game = false;
var players = {};
var bullets = {};
var shadows = [];
var sounds = [];

function preload() {
    bg = loadImage('assets/bg3.jpg')
    start = loadImage('assets/start.png')
    words = loadJSON('assets/words.json')
    for (let i = 0; i < naturalKeyNames.length; i++) {
      sounds.push(loadSound(String('assets/reg-' + naturalKeyNames[i] + '.mp3')));
    }
}

function setup() {
  canvas = createCanvas(canvas_w, canvas_h);
  let menu = select('.drop')
  let dropdown = select('.dropdown')
  let input_name = select('#name_i')
  let input_red = select('#red_i')
  let input_green = select('#green_i')
  let input_blue = select('#blue_i')
  let sub_name = select('#name_s')
  let sub_color = select('#color_s')

  menu.mouseOver(function() { dropdown.show(300) })
  menu.mouseOut(function() { dropdown.hide(300) })
  sub_name.mousePressed(function() { player_name = input_name.value() })
  sub_color.mousePressed(function() {
    player_rgb = [clean_color_input(input_red.value()),
                  clean_color_input(input_green.value()),
                  clean_color_input(input_blue.value())
                 ]
  })

  lobby()

  socket.on('sync', sync)
  socket.on('player_score', increment_score)
  socket.on('player_death', death)
}

function lobby() {
  player_id = Math.round(random(100000));
  player_x = 50 + random(canvas_w - 50);
  player_y = 35 + random(canvas_h/2 - 175);
  let r = random(255);
  let g = random(255);
  let b = random(255);

  player_name = words.words[Math.floor(Math.random()*words.words.length)] + ' ' + words.words[Math.floor(Math.random()*words.words.length)];
  player_rgb = [r, g, b];

  draw_player(player_name, player_x, player_y, player_rgb, player_health)
  console.log(player_name)
}


function draw_player(name, x, y, rgb, health) {
      fill('white');
      text(name, x - (25 + name.length), y - 30);
      fill(rgb);
      ellipse(x, y, player_size, player_size);
      fill('white')
      text(String(health), x - 9, y + 4)
}

function check_player_movement() {
    if (keyIsDown(UP_ARROW) && player_y >= 0) {
        move(-speed, 0, 'up')
    }
    if (keyIsDown(DOWN_ARROW) && player_y <= canvas_h) {
        move(speed, 0, 'down')
    }
    if (keyIsDown(RIGHT_ARROW) && player_x <= canvas_w) {
        move(0, speed, 'right')
    }
    if (keyIsDown(LEFT_ARROW) && player_x >= 0) {
        move(0, -speed, 'left')
    }
}

function package_player() {
  player_info = {'id': player_id,
                   'x': player_x,
                   'y': player_y,
                   'name': player_name,
                   'rgb': player_rgb,
                   'score': player_score,
                   'health': player_health,
                   'alive': player_alive,
                  }
}

function update_player() {
  if (player_info != undefined) {
    player_name = player_info['name']
    player_rgb = player_info['rgb']
    player_score = player_info['score']
    player_health = player_info['health']
    player_alive = player_info['alive']
  }
}

function check_start() {
  let start_x_left = canvas_w/2 - 50
  let start_x_right = canvas_w/2 + 50
  let start_y_top = canvas_h/2 - 50
  let start_y_bottom = canvas_h/2 + 50
  if (player_x >= start_x_left && 
      player_x <= start_x_right && 
      player_y <= start_y_bottom &&
      player_y >= start_y_top) {

    player_alive = true;
    in_game = true;
    player_health = 100;
    player_score = 0;
    package_player()

    socket.emit('player_new', player_info)
    socket.emit('sync')
  }
}

function draw() {
    background(bg)

    if (!in_game) {
      image(start, canvas_w/2 - 100, canvas_h/2 - 100, 200, 200)
      check_player_movement()
      check_start()
    } else {
      socket.emit('sync')
      tick()
    }
    draw_player(player_name, player_x, player_y, player_rgb, player_health)
}

function tick() {
  update_player()
  if (!player_alive) {
    text("YOU ARE DEAD", 500, 150, 100, 100)
    in_game = false
  }

  if (player_alive) {
    check_player_movement()
  }

  for (let key in players) {
    let player = players[key]
    let id = player['id']

    if (id != player_id) {
      let name = player['name']
      let x = player['x']
      let y = player['y']
      let rgb = player['rgb']
      let health = player['health']

      draw_player(name, x, y, rgb, health)
    }
  }

  for (let key in bullets) {
    let bullet = bullets[key]
    let x = bullet['x']
    let y = bullet['y']
    let color = bullet['color']
    let id = bullet['id']
    let bid = bullet['bid']

    fill(color)
    ellipse(x, y, 15, 15)
  }

  for (let key in shadows) {
    let shadow = shadows[key]
    let x = shadow['x']
    let y = shadow['y']
    let r1 = shadow['r1']
    let r2 = shadow['r2']

    fill(shadow['rgb'])
    star(x, y, r1, r2, 5); 
  }
}

function keyPressed() {
  if (keyCode === 32 && player_alive && in_game) {
      shoot()
  }
}

function move(v, h, d) {
    player_direction = d
    player_x += h
    player_y += v
    package_player()

    if (player_alive) {
      socket.emit('player_move', player_info)
    }
}

function shoot() {
    console.log('shoot')
    socket.emit('player_shoot', {'direction': player_direction, 'id': player_id, 'bid': Math.round(random(1000)), 'color': player_rgb})
}

function death(data) {
    console.log('YOU DIED')
    let death_id = data['id'];
    if (player_id === death_id) {
      sounds[Math.floor(random(7))].play()
      player_alive = false;
      in_game = false;
      player_x = 100
      player_y = 100
      player_health = 100
    }
}

function clean_color_input(color) {
  color = parseInt(color);
  if (isNaN(color)) {
    return random(255);
  }
  return color;
}

function changeColor() {
    if (player_alive) {
        player_rgb = [red.value(), green.value(), blue.value()]
        socket.emit('player_color_change', {'color': player_rgb, 'id': player_id})
    }
}

function playerInbounds() {
    if (player_x < canvas_w && player_x > 0 && player_y + 15 < canvas_h && player_y - 15 > 0) {
        return true;
    }
    return false;
}

function sync(data) {
    players = data['players']
    bullets = data['bullets']
    shadows = data['shadows']
    if (player_alive) {
      player_info = players[player_id]
    }
}

function increment_score(data) {
  console.log('scoreee')
  if (data['id'] == player_id) {
    // player_score += 5
    // package_player()
    // socket.emit('sync')
  }
}

function star(x, y, radius1, radius2, npoints) {
  var angle = TWO_PI / npoints;
  var halfAngle = angle/2.0;
  beginShape();
  for (var a = 0; a < TWO_PI; a += angle) {
    var sx = x + cos(a) * radius2;
    var sy = y + sin(a) * radius2;
    vertex(sx, sy);
    sx = x + cos(a+halfAngle) * radius1;
    sy = y + sin(a+halfAngle) * radius1;
    vertex(sx, sy);
  }
  endShape(CLOSE);
}

