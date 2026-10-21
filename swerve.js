// ===== Satelite (jogador) =====
var FONT = 'Orbitron, monospace';
var SPRITES = new Image();
SPRITES.src = 'sprites.png';
var TAM = 64;
var FRAMES_SAT = [0, 7, 6, 0]; // quadro do satélite por número de vidas (índice = vidas)
var FRAME_EXPLOSAO = 8;        // primeiro quadro da explosão
var N_EXPLOSAO = 6;            // quantidade de quadros da explosão

function Satelite(x, y) {
  this.x = x;
  this.y = y;
  this.r = 12;
  this.vx = 0;          // velocidade atual (horizontal)
  this.vy = 0;          // velocidade atual (vertical)
  this.acel = 500;      // aceleração em px/s²
  this.atrito = 0.8;    // 0 = desliza para sempre; maior = para mais rápido
  this.velMax = 320;    // velocidade máxima em px/s
}

Satelite.prototype.atualizar = function (dt, teclas, W, H) {
  var dx = ((teclas.arrowright || teclas.d) ? 1 : 0) - ((teclas.arrowleft || teclas.a) ? 1 : 0);
  var dy = ((teclas.arrowdown || teclas.s) ? 1 : 0) - ((teclas.arrowup || teclas.w) ? 1 : 0);
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }

  // as teclas aceleram o satélite
  this.vx += dx * this.acel * dt;
  this.vy += dy * this.acel * dt;

  // atrito: reduz a velocidade aos poucos
  var f = Math.max(0, 1 - this.atrito * dt);
  this.vx *= f;
  this.vy *= f;

  // limita a velocidade máxima
  var v = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  if (v > this.velMax) {
    this.vx *= this.velMax / v;
    this.vy *= this.velMax / v;
  }

  // a velocidade move a posição
  this.x += this.vx * dt;
  this.y += this.vy * dt;

  // RN005: não sai do canvas (e perde a velocidade ao bater na borda)
  if (this.x < this.r) { this.x = this.r; this.vx = 0; }
  else if (this.x > W - this.r) { this.x = W - this.r; this.vx = 0; }
  if (this.y < this.r) { this.y = this.r; this.vy = 0; }
  else if (this.y > H - this.r) { this.y = H - this.r; this.vy = 0; }
};

Satelite.prototype.desenhar = function (ctx, vidas) {
  var t = 48;
  ctx.drawImage(SPRITES, FRAMES_SAT[vidas] * TAM, 0, TAM, TAM, this.x - t / 2, this.y - t / 2, t, t);
};

// ===== Lixo espacial =====
function Lixo(W, H, vel) {
  this.r = 10 + Math.random() * 16;
  var lado = Math.floor(Math.random() * 4);
  if (lado === 0) { this.x = -this.r; this.y = Math.random() * H; }
  else if (lado === 1) { this.x = W + this.r; this.y = Math.random() * H; }
  else if (lado === 2) { this.x = Math.random() * W; this.y = -this.r; }
  else { this.x = Math.random() * W; this.y = H + this.r; }
  var alvoX = W * (0.2 + Math.random() * 0.6);
  var alvoY = H * (0.2 + Math.random() * 0.6);
  var ang = Math.atan2(alvoY - this.y, alvoX - this.x);
  var v = vel * (0.7 + Math.random() * 0.6);
  this.vx = Math.cos(ang) * v;
  this.vy = Math.sin(ang) * v;
  this.rot = Math.random() * 6;
  this.giro = (Math.random() - 0.5) * 3;
  this.tipo = 1 + Math.floor(Math.random() * 5);
}

Lixo.prototype.atualizar = function (dt) {
  this.x += this.vx * dt;
  this.y += this.vy * dt;
  this.rot += this.giro * dt;
};

Lixo.prototype.foraDaTela = function (W, H) {
  var m = this.r * 2;
  return this.x < -m || this.x > W + m || this.y < -m || this.y > H + m;
};

Lixo.prototype.desenhar = function (ctx) {
  var t = this.r * 2.4;
  ctx.save();
  ctx.translate(this.x, this.y);
  ctx.rotate(this.rot);
  ctx.drawImage(SPRITES, this.tipo * TAM, 0, TAM, TAM, -t / 2, -t / 2, t, t);
  ctx.restore();
};

// ===== Jogo =====
function Jogo(canvas) {
  var self = this;
  this.ctx = canvas.getContext('2d');
  this.W = canvas.width;
  this.H = canvas.height;
  this.estado = 'inicio'; // inicio | jogando | pausa | fim
  this.recorde = 0;       // RF09: maior pontuação da sessão
  this.teclas = {};
  this.estrelas = [];
  for (var i = 0; i < 60; i++) {
    this.estrelas.push({ x: Math.random() * this.W, y: Math.random() * this.H, t: Math.random() * 2 + 0.5 });
  }
  document.addEventListener('keydown', function (e) { self.tecla(e, true); });
  document.addEventListener('keyup', function (e) { self.tecla(e, false); });
  this.ultimo = 0;
  requestAnimationFrame(function (t) { self.ultimo = t; self.loop(t); });
}

Jogo.prototype.tecla = function (e, down) {
  var k = e.key.toLowerCase();
  this.teclas[k] = down;
  if (k.indexOf('arrow') === 0 || k === ' ') e.preventDefault();
  if (!down) return;
  if ((k === 'enter' || k === ' ') && (this.estado === 'inicio' || this.estado === 'fim')) {
    this.iniciar();
  } else if (k === 'p') { // RF10: pausar e retomar
    if (this.estado === 'jogando') this.estado = 'pausa';
    else if (this.estado === 'pausa') this.estado = 'jogando';
  }
};

Jogo.prototype.iniciar = function () {
  this.sat = new Satelite(this.W / 2, this.H / 2);
  this.lixos = [];
  this.vidas = 3;       // RN001
  this.pontos = 0;
  this.tempo = 0;
  this.invul = 0;
  this.proxLixo = 0;
  this.nivel = 0;
  this.estado = 'jogando';
};

Jogo.prototype.fim = function () {
  this.estado = 'fim';
  this.recorde = Math.max(this.recorde, Math.floor(this.pontos)); // RN006
};

Jogo.prototype.atualizar = function (dt) {
  if (this.estado === 'explodindo') {
  this.tempoExp += dt;
  for (var j = 0; j < this.lixos.length; j++) this.lixos[j].atualizar(dt);
  if (this.tempoExp >= 0.9) this.fim();
  return;
}
if (this.estado !== 'jogando') return;
  this.tempo += dt;
  this.pontos += 10 * dt;                                // RN003
  this.nivel = Math.min(8, Math.floor(this.tempo / 15)); // RN004
  this.sat.atualizar(dt, this.teclas, this.W, this.H);

  this.proxLixo -= dt;
  if (this.proxLixo <= 0) {
    this.lixos.push(new Lixo(this.W, this.H, 90 + this.nivel * 75));
    this.proxLixo = Math.max(0.35, 1.1 - this.nivel * 0.09);
  }
  if (this.invul > 0) this.invul -= dt;

  for (var i = this.lixos.length - 1; i >= 0; i--) {
    var l = this.lixos[i];
    l.atualizar(dt);
    if (l.foraDaTela(this.W, this.H)) { this.lixos.splice(i, 1); continue; }
    var dist = Math.sqrt(Math.pow(l.x - this.sat.x, 2) + Math.pow(l.y - this.sat.y, 2));
    if (this.invul <= 0 && dist < l.r * 0.85 + this.sat.r * 0.8) { // RF04
      this.vidas--;      // RN002
      this.invul = 2;
      if (this.vidas <= 0) { this.estado = 'explodindo'; this.tempoExp = 0; return; }
    }
  }
};

Jogo.prototype.texto = function (t, y, tam, cor) {
  this.ctx.fillStyle = cor || '#ffffff';
  this.ctx.font = 'bold ' + tam + 'px ' + FONT;
  this.ctx.textAlign = 'center';
  this.ctx.fillText(t, this.W / 2, y);
};

Jogo.prototype.desenhar = function () {
  var c = this.ctx, i;
  c.clearRect(0, 0, this.W, this.H);
  c.fillStyle = '#ffffff';
  for (i = 0; i < this.estrelas.length; i++) {
    c.fillRect(this.estrelas[i].x, this.estrelas[i].y, this.estrelas[i].t, this.estrelas[i].t);
  }

  if (this.estado === 'inicio') {
    this.texto('SWERVE', 180, 64, '#6f00ff');
    this.texto('Tente desviar do lixo espacial pelo maior tempo possível.', 255, 18);
    this.texto('Mas você não pode evitá-lo para sempre.', 280, 18);
    this.texto('Setas ou WASD: mover   |   P: pausar', 340, 16, '#aab4d4');
    this.texto('Pressione ENTER ou ESPAÇO para começar', 400, 22, '#ffd166');
    return;
  }

  for (i = 0; i < this.lixos.length; i++) this.lixos[i].desenhar(c);
  if (this.estado === 'explodindo') {
  var q = Math.min(N_EXPLOSAO - 1, Math.floor(this.tempoExp / 0.9 * N_EXPLOSAO));
  var t = 110;
  c.drawImage(SPRITES, (FRAME_EXPLOSAO + q) * TAM, 0, TAM, TAM, this.sat.x - t / 2, this.sat.y - t / 2, t, t);
} else if (this.estado !== 'fim' && (this.invul <= 0 || Math.floor(this.invul * 10) % 2 === 0)) {
  this.sat.desenhar(c, this.vidas);
}

  c.font = '18px ' + FONT;
  c.fillStyle = '#ffffff';
  c.textAlign = 'left';
  c.fillText('Pontos: ' + Math.floor(this.pontos), 16, 28);
  c.textAlign = 'right';
  c.fillText('Vidas: ' + this.vidas, this.W - 16, 28);

  if (this.estado === 'pausa' || this.estado === 'fim') {
    c.fillStyle = 'rgba(4, 5, 13, 0.7)';
    c.fillRect(0, 0, this.W, this.H);
  }
  if (this.estado === 'pausa') {
    this.texto('PAUSADO', 245, 48, '#9ad1ff');
    this.texto('Pressione P para continuar', 290, 20);
  }
  if (this.estado === 'fim') {
    this.texto('FIM DE JOGO', 200, 54, '#ff6b6b');
    this.texto('Pontuação: ' + Math.floor(this.pontos), 255, 24);
    this.texto('Recorde da sessão: ' + this.recorde, 290, 20, '#ffd166');
    this.texto('ENTER ou ESPAÇO para jogar de novo', 350, 20);
  }
};

Jogo.prototype.loop = function (t) {
  var self = this;
  var dt = Math.min((t - this.ultimo) / 1000, 0.05);
  this.ultimo = t;
  this.atualizar(dt);
  this.desenhar();
  requestAnimationFrame(function (x) { self.loop(x); });
};

new Jogo(document.getElementById('tela'));
