/* ============================================================
   ABDULLAH.IO — SPACE SNAKE GAME
   script.js — Complete Game Engine
   ============================================================ */

"use strict";

/* ============================================================
   CONSTANTS & CONFIG
   ============================================================ */
const CFG = {
  MAP_W: 6000,
  MAP_H: 6000,
  FOOD_COUNT: 600,
  AI_COUNT: 10,
  SNAKE_SPEED: 2.8,
  BOOST_SPEED: 5.2,
  BOOST_DRAIN: 0.15,
  BOOST_REGEN: 0.08,
  SEGMENT_GAP: 6,
  HEAD_RADIUS: 12,
  FOOD_TYPES: [
    { type: 'dot',    radius: 5,  score: 1,  color: '#00d4ff' },
    { type: 'star',   radius: 8,  score: 3,  color: '#ffd700' },
    { type: 'planet', radius: 14, score: 8,  color: '#aa00ff' },
    { type: 'energy', radius: 7,  score: 5,  color: '#00ff88' },
    { type: 'cosmic', radius: 18, score: 15, color: '#ff00aa' },
  ],
  SKINS: [
    { head: '#00d4ff', body: '#0044ff', glow: '#00d4ff' },
    { head: '#ff8800', body: '#ff4400', glow: '#ff8800' },
    { head: '#ff00aa', body: '#aa0066', glow: '#ff00aa' },
    { head: '#00ff88', body: '#00aa55', glow: '#00ff88' },
    { head: '#ffd700', body: '#aa8800', glow: '#ffd700' },
  ],
  AI_NAMES: [
    'VoidSerpent','NebulaBeast','StarEater','CosmicKing','PulsarWyrm',
    'GalaxyFang','AstroViper','OrbitalPet','StarlordX','DarkMatter',
    'ZeroGhost','LunarShade','NovaDrake','PlasmaBite','CometSlash',
  ],
};

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */
const rand    = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b));
const lerp    = (a, b, t) => a + (b - a) * t;
const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist2   = (ax, ay, bx, by) => (ax-bx)**2 + (ay-by)**2;
const dist    = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

/* ============================================================
   PARTICLE SYSTEM
   ============================================================ */
class Particle {
  constructor(x, y, vx, vy, color, life, radius) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.radius = radius;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.life -= 1;
  }
  draw(ctx, camX, camY) {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camX, this.y - camY, this.radius * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ============================================================
   FOOD CLASS
   ============================================================ */
class Food {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const t = CFG.FOOD_TYPES[Math.floor(Math.random() ** 2 * CFG.FOOD_TYPES.length)];
    this.type   = t.type;
    this.radius = t.radius;
    this.score  = t.score;
    this.color  = t.color;
    this.pulse  = rand(0, Math.PI * 2);
    this.bobAmp = rand(1, 4);
    this.bobY   = 0;
    // tiny orbit for planets
    this.orbit  = this.type === 'planet' ? { angle: rand(0, Math.PI*2), r: rand(8,20) } : null;
    this.alive  = true;
  }
  update(dt) {
    this.pulse += 0.04;
    this.bobY = Math.sin(this.pulse) * this.bobAmp;
    if (this.orbit) this.orbit.angle += 0.02;
  }
  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY + this.bobY;
    const pr = this.radius + Math.sin(this.pulse) * 2;

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(sx, sy, pr, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(sx - pr * 0.25, sy - pr * 0.25, pr * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Orbit ring for planet
    if (this.orbit) {
      ctx.strokeStyle = `${this.color}55`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(sx, sy, this.orbit.r, this.orbit.r * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Moon
      const mx = sx + Math.cos(this.orbit.angle) * this.orbit.r;
      const my = sy + Math.sin(this.orbit.angle) * this.orbit.r * 0.4;
      ctx.fillStyle = '#ffffff88';
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Star sparkle
    if (this.type === 'star') {
      const spk = Math.abs(Math.sin(this.pulse));
      ctx.strokeStyle = `${this.color}${Math.floor(spk * 255).toString(16).padStart(2,'0')}`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + this.pulse * 0.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(ang) * pr * 2, sy + Math.sin(ang) * pr * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/* ============================================================
   SNAKE CLASS (Player & AI)
   ============================================================ */
class Snake {
  constructor(x, y, name, skinIdx, isPlayer) {
    this.x = x;
    this.y = y;
    this.name    = name;
    this.skin    = CFG.SKINS[skinIdx % CFG.SKINS.length];
    this.isPlayer = isPlayer;
    this.angle   = rand(0, Math.PI * 2);
    this.speed   = CFG.SNAKE_SPEED;
    this.score   = 0;
    this.kills   = 0;
    this.alive   = true;
    this.boost   = 100;  // 0..100
    this.boosting = false;
    this.minLength = 20;

    // Segments: array of {x, y}
    this.segments = [];
    for (let i = 0; i < this.minLength; i++) {
      this.segments.push({ x: x - i * CFG.SEGMENT_GAP, y });
    }

    // AI state
    this.ai = isPlayer ? null : {
      targetAngle: rand(0, Math.PI * 2),
      state: 'wander',   // wander | chase | flee
      stateTimer: 0,
      target: null,
    };
  }

  get length() { return this.segments.length; }
  get headRadius() { return CFG.HEAD_RADIUS + Math.log(this.length) * 1.2; }

  update(dt, foods, snakes, mouseAngle) {
    if (!this.alive) return;

    if (this.isPlayer) {
      this._updatePlayer(mouseAngle);
    } else {
      this._updateAI(foods, snakes);
    }

    // Move head
    const curSpeed = this.boosting ? CFG.BOOST_SPEED : CFG.SNAKE_SPEED;
    this.x += Math.cos(this.angle) * curSpeed;
    this.y += Math.sin(this.angle) * curSpeed;

    // Wrap to world bounds
    this.x = clamp(this.x, 50, CFG.MAP_W - 50);
    this.y = clamp(this.y, 50, CFG.MAP_H - 50);

    // Push head to front
    this.segments.unshift({ x: this.x, y: this.y });

    // Trim tail (unless growing)
    while (this.segments.length > this.minLength) {
      this.segments.pop();
    }

    // Boost management
    if (this.boosting && this.boost > 0) {
      this.boost = Math.max(0, this.boost - CFG.BOOST_DRAIN);
      if (this.boost <= 0) this.boosting = false;
      // Shed mass while boosting
      if (this.minLength > 20 && Math.random() < 0.3) {
        this.minLength -= 1;
      }
    } else if (!this.boosting) {
      this.boost = Math.min(100, this.boost + CFG.BOOST_REGEN);
    }
  }

  _updatePlayer(mouseAngle) {
    // Smooth angle towards mouse
    let diff = mouseAngle - this.angle;
    while (diff > Math.PI)  diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnSpeed = 0.1;
    this.angle += clamp(diff, -turnSpeed, turnSpeed) * 2.5;
  }

  _updateAI(foods, snakes) {
    const ai = this.ai;
    ai.stateTimer--;

    const hr = this.headRadius;

    // Evaluate state every 30 frames
    if (ai.stateTimer <= 0) {
      ai.stateTimer = 30 + randInt(0, 20);
      ai.state = 'wander';
      ai.target = null;

      // Look for threats (bigger snakes near head)
      for (const s of snakes) {
        if (s === this || !s.alive) continue;
        const d = dist(this.x, this.y, s.x, s.y);
        if (s.headRadius > hr * 1.2 && d < 200) {
          ai.state = 'flee';
          ai.target = s;
          break;
        }
      }

      // Look for prey (smaller snakes)
      if (ai.state === 'wander') {
        for (const s of snakes) {
          if (s === this || !s.alive) continue;
          const d = dist(this.x, this.y, s.x, s.y);
          if (s.headRadius < hr * 0.85 && d < 350) {
            ai.state = 'chase';
            ai.target = s;
            break;
          }
        }
      }

      // Look for food
      if (ai.state === 'wander') {
        let bestFood = null;
        let bestScore = -Infinity;
        for (const f of foods) {
          if (!f.alive) continue;
          const d = dist(this.x, this.y, f.x, f.y);
          if (d < 500) {
            const sc = f.score / (d + 1);
            if (sc > bestScore) { bestScore = sc; bestFood = f; }
          }
        }
        if (bestFood) {
          ai.state = 'food';
          ai.target = bestFood;
        }
      }
    }

    // Steer towards target
    let targetAngle = ai.targetAngle;

    if (ai.state === 'flee' && ai.target && ai.target.alive) {
      targetAngle = Math.atan2(this.y - ai.target.y, this.x - ai.target.x);
      this.boosting = this.boost > 20;
    } else if ((ai.state === 'chase' || ai.state === 'food') && ai.target) {
      const tAlive = ai.target.alive !== undefined ? ai.target.alive : true;
      if (tAlive) {
        targetAngle = Math.atan2(ai.target.y - this.y, ai.target.x - this.x);
        this.boosting = ai.state === 'chase' && this.boost > 30;
      } else {
        ai.state = 'wander';
      }
    } else {
      // Wander with wall avoidance
      if (this.x < 200) targetAngle = 0;
      else if (this.x > CFG.MAP_W - 200) targetAngle = Math.PI;
      else if (this.y < 200) targetAngle = Math.PI * 0.5;
      else if (this.y > CFG.MAP_H - 200) targetAngle = -Math.PI * 0.5;
      else {
        targetAngle = ai.targetAngle + (Math.random() - 0.5) * 0.15;
      }
      ai.targetAngle = targetAngle;
      this.boosting = false;
    }

    // Smooth turn
    let diff = targetAngle - this.angle;
    while (diff > Math.PI)  diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += clamp(diff, -0.08, 0.08);
  }

  eatFood(food) {
    this.score += food.score;
    this.minLength += food.score * 2;
    food.alive = false;
  }

  grow(amount) {
    this.minLength += amount;
    this.score += amount;
  }

  draw(ctx, camX, camY) {
    if (!this.alive) return;
    const segs = this.segments;
    const n    = segs.length;
    if (n < 2) return;

    const skin = this.skin;
    const hr   = this.headRadius;

    ctx.save();

    // Draw body
    for (let i = n - 1; i >= 1; i--) {
      const seg = segs[i];
      const sx = seg.x - camX;
      const sy = seg.y - camY;
      const t  = i / n;
      const r  = Math.max(4, hr * (0.65 + 0.35 * (1 - t)) - t * 2);

      // Gradient color from head to tail
      const alpha = 0.7 + 0.3 * (1 - t);
      ctx.globalAlpha = alpha;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = skin.glow;
      ctx.fillStyle   = skin.body;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      // Highlight stripe
      if (i % 4 === 0) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx - r * 0.25, sy - r * 0.25, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw head
    ctx.globalAlpha = 1;
    const hx = segs[0].x - camX;
    const hy = segs[0].y - camY;

    ctx.shadowBlur  = 25;
    ctx.shadowColor = skin.glow;
    ctx.fillStyle   = skin.head;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();

    // Head highlight
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(hx - hr * 0.25, hy - hr * 0.28, hr * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeOff = hr * 0.38;
    const eyeAngle1 = this.angle + 0.6;
    const eyeAngle2 = this.angle - 0.6;
    const eyeR = hr * 0.22;

    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#fff';
    ctx.beginPath();
    ctx.arc(hx + Math.cos(eyeAngle1)*eyeOff, hy + Math.sin(eyeAngle1)*eyeOff, eyeR, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx + Math.cos(eyeAngle2)*eyeOff, hy + Math.sin(eyeAngle2)*eyeOff, eyeR, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(hx + Math.cos(eyeAngle1)*eyeOff + 1, hy + Math.sin(eyeAngle1)*eyeOff + 1, eyeR*0.55, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx + Math.cos(eyeAngle2)*eyeOff + 1, hy + Math.sin(eyeAngle2)*eyeOff + 1, eyeR*0.55, 0, Math.PI*2);
    ctx.fill();

    // Boost trail
    if (this.boosting) {
      for (let i = 0; i < 3; i++) {
        const bi = Math.min(i * 3, n - 1);
        const bx = segs[bi].x - camX;
        const by = segs[bi].y - camY;
        ctx.globalAlpha = 0.5 - i * 0.15;
        ctx.shadowBlur  = 20;
        ctx.shadowColor = skin.glow;
        ctx.fillStyle   = skin.glow;
        ctx.beginPath();
        ctx.arc(bx, by, hr * (0.5 - i * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Name tag (canvas text, not DOM)
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.font = `bold ${Math.max(10, hr * 0.9)}px Orbitron, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = skin.glow;
    ctx.fillText(this.name, hx, hy - hr - 6);
    ctx.restore();
  }
}

/* ============================================================
   BACKGROUND STARS & PLANETS
   ============================================================ */
class StarField {
  constructor() {
    this.stars   = [];
    this.planets = [];
    this.nebulae = [];
    this._generate();
  }
  _generate() {
    // Background stars (world-space)
    for (let i = 0; i < 2000; i++) {
      this.stars.push({
        x: rand(0, CFG.MAP_W),
        y: rand(0, CFG.MAP_H),
        r: rand(0.5, 2.5),
        brightness: rand(0.3, 1),
        twinkle: rand(0, Math.PI * 2),
      });
    }
    // Decorative planets
    const colors = ['#aa00ff','#ff6600','#0066ff','#ff00aa','#00ff88','#ff4444'];
    for (let i = 0; i < 20; i++) {
      this.planets.push({
        x: rand(200, CFG.MAP_W - 200),
        y: rand(200, CFG.MAP_H - 200),
        r: rand(30, 120),
        color: colors[randInt(0, colors.length)],
        ringAngle: rand(0.1, 0.5),
        hasRing: Math.random() > 0.4,
        pulse: rand(0, Math.PI * 2),
      });
    }
    // Nebula clouds
    for (let i = 0; i < 12; i++) {
      this.nebulae.push({
        x: rand(0, CFG.MAP_W),
        y: rand(0, CFG.MAP_H),
        rx: rand(200, 600),
        ry: rand(100, 400),
        color: ['#1a0033','#001a33','#001a00','#330011'][randInt(0,4)],
        angle: rand(0, Math.PI),
        pulse: rand(0, Math.PI * 2),
      });
    }
  }
  update() {
    for (const s of this.stars) s.twinkle += 0.03;
    for (const p of this.planets) p.pulse  += 0.005;
  }
  draw(ctx, camX, camY, vw, vh) {
    // Nebulae
    for (const n of this.nebulae) {
      const nx = n.x - camX * 0.3;  // parallax
      const ny = n.y - camY * 0.3;
      if (nx < -n.rx || nx > vw + n.rx || ny < -n.ry || ny > vh + n.ry) continue;
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(n.angle);
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, n.rx);
      grd.addColorStop(0,   n.color + 'cc');
      grd.addColorStop(0.5, n.color + '44');
      grd.addColorStop(1,   'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(0, 0, n.rx, n.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Stars (with parallax)
    for (const s of this.stars) {
      const sx = s.x - camX * 0.15;
      const sy = s.y - camY * 0.15;
      if (sx < 0 || sx > vw || sy < 0 || sy > vh) continue;
      const b  = s.brightness * (0.7 + 0.3 * Math.sin(s.twinkle));
      ctx.save();
      ctx.globalAlpha = b;
      ctx.fillStyle   = '#ffffff';
      ctx.shadowBlur  = s.r * 4;
      ctx.shadowColor = '#aaddff';
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Planets
    for (const p of this.planets) {
      const px = p.x - camX;
      const py = p.y - camY;
      if (px < -p.r * 3 || px > vw + p.r * 3 || py < -p.r * 3 || py > vh + p.r * 3) continue;

      ctx.save();
      ctx.shadowBlur  = 40;
      ctx.shadowColor = p.color + '88';

      // Planet body with gradient
      const grd = ctx.createRadialGradient(px - p.r*0.3, py - p.r*0.3, p.r*0.1, px, py, p.r);
      grd.addColorStop(0,   '#ffffff33');
      grd.addColorStop(0.3, p.color);
      grd.addColorStop(1,   '#00000088');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fill();

      // Ring
      if (p.hasRing) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.ringAngle);
        ctx.strokeStyle = p.color + 'aa';
        ctx.lineWidth   = p.r * 0.15;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 1.8, p.r * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // Grid lines
    ctx.save();
    ctx.strokeStyle = 'rgba(0,212,255,0.04)';
    ctx.lineWidth   = 1;
    const gs = 100;
    const sx = (-camX % gs + gs) % gs;
    const sy2 = (-camY % gs + gs) % gs;
    for (let x = sx; x < vw; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, vh); ctx.stroke();
    }
    for (let y = sy2; y < vh; y += gs) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(vw, y); ctx.stroke();
    }
    ctx.restore();
  }
}

/* ============================================================
   SOUND MANAGER (Web Audio)
   ============================================================ */
class SoundMgr {
  constructor() {
    try {
      this.ctx    = new (window.AudioContext || window.webkitAudioContext)();
      this.sfxOn  = true;
      this.musOn  = true;
      this._bgNode = null;
      this._bgGain = null;
    } catch(e) {
      this.ctx = null;
    }
  }
  _beep(freq, duration, type='sine', gain=0.18, detune=0) {
    if (!this.ctx || !this.sfxOn) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      g.gain.setValueAtTime(gain, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + duration);
    } catch(e) {}
  }
  eat()    { this._beep(440, 0.08, 'sine', 0.12); }
  die()    { this._beep(120, 0.5, 'sawtooth', 0.2); this._beep(80, 0.8, 'square', 0.15, -200); }
  kill()   { this._beep(660, 0.12, 'square', 0.14); this._beep(880, 0.08, 'sine', 0.1); }
  boost()  { this._beep(300, 0.06, 'triangle', 0.08); }

  startMusic() {
    if (!this.ctx || !this.musOn || this._bgNode) return;
    try {
      const bufSize = this.ctx.sampleRate * 4;
      const buffer  = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data    = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.02;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop   = true;
      const filt = this.ctx.createBiquadFilter();
      filt.type            = 'lowpass';
      filt.frequency.value = 400;
      const g = this.ctx.createGain();
      g.gain.value = 0.12;
      src.connect(filt); filt.connect(g); g.connect(this.ctx.destination);
      src.start();
      this._bgNode = src;
      this._bgGain = g;
    } catch(e) {}
  }
  stopMusic() {
    if (this._bgNode) { try { this._bgNode.stop(); } catch(e) {} this._bgNode = null; }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}

/* ============================================================
   GAME ENGINE
   ============================================================ */
class Game {
  constructor() {
    this.canvas   = document.getElementById('gameCanvas');
    this.ctx      = this.canvas.getContext('2d');
    this.minimap  = document.getElementById('minimap');
    this.mmCtx    = this.minimap.getContext('2d');
    this.sound    = new SoundMgr();

    this.running  = false;
    this.paused   = false;
    this.player   = null;
    this.snakes   = [];
    this.foods    = [];
    this.particles= [];
    this.stars    = null;
    this.frame    = 0;

    this.camX     = 0;
    this.camY     = 0;
    this.targetCamX = 0;
    this.targetCamY = 0;
    this.zoom     = 1.0;
    this.targetZoom = 1.0;

    this.mouseAngle = 0;
    this.mouseX    = 0;
    this.mouseY    = 0;
    this.touching  = false;
    this.touchAngle = 0;

    this.bestRank  = Infinity;
    this.aiCount   = 10;
    this.skinIdx   = 0;
    this.playerName = 'Player';

    this.killFeed  = document.createElement('div');
    this.killFeed.className = 'kill-popup';
    document.body.appendChild(this.killFeed);

    this._raf = null;
    this._bindEvents();
    this._initMenu();
  }

  /* -------- Menu Background -------- */
  _initMenu() {
    const menuCanvas = document.getElementById('menuBgCanvas');
    this._menuStars  = [];
    for (let i = 0; i < 200; i++) {
      this._menuStars.push({
        x: rand(0, 1), y: rand(0, 1),
        r: rand(0.5, 2.5), speed: rand(0.0001, 0.0004),
        brightness: rand(0.3, 1), twinkle: rand(0, Math.PI*2),
        color: ['#00d4ff','#ffffff','#aa00ff','#ffd700'][randInt(0,4)],
      });
    }
    this._menuSnakes = [];
    for (let i = 0; i < 6; i++) {
      this._menuSnakes.push({
        x: rand(0.1, 0.9), y: rand(0.1, 0.9),
        angle: rand(0, Math.PI*2),
        color: CFG.SKINS[i % CFG.SKINS.length].glow,
        segs: [],
      });
    }
    this._animateMenu(menuCanvas);
  }
  _animateMenu(canvas) {
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const ctx = canvas.getContext('2d');

    const loop = () => {
      if (!document.getElementById('mainMenu').classList.contains('active') &&
          !document.getElementById('gameOverScreen').classList.contains('active')) {
        requestAnimationFrame(loop);
        return;
      }
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Dark gradient BG
      const grd = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*0.7);
      grd.addColorStop(0, '#060c18');
      grd.addColorStop(1, '#020408');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      // Stars
      for (const s of this._menuStars) {
        s.twinkle += 0.02;
        s.x += s.speed;
        if (s.x > 1) s.x = 0;
        const b = s.brightness * (0.6 + 0.4 * Math.sin(s.twinkle));
        ctx.save();
        ctx.globalAlpha = b;
        ctx.shadowBlur  = s.r * 6;
        ctx.shadowColor = s.color;
        ctx.fillStyle   = s.color;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }

      // Floating snake silhouettes
      for (const sn of this._menuSnakes) {
        sn.angle += 0.008 + (Math.random() - 0.5) * 0.005;
        sn.x += Math.cos(sn.angle) * 0.0015;
        sn.y += Math.sin(sn.angle) * 0.001;
        sn.x = ((sn.x % 1) + 1) % 1;
        sn.y = ((sn.y % 1) + 1) % 1;
        sn.segs.unshift({ x: sn.x * w, y: sn.y * h });
        if (sn.segs.length > 40) sn.segs.pop();
        for (let i = 1; i < sn.segs.length; i++) {
          const seg = sn.segs[i];
          const t   = i / sn.segs.length;
          ctx.save();
          ctx.globalAlpha = (1 - t) * 0.3;
          ctx.shadowBlur  = 15;
          ctx.shadowColor = sn.color;
          ctx.fillStyle   = sn.color;
          ctx.beginPath();
          ctx.arc(seg.x, seg.y, 8 * (1 - t * 0.5), 0, Math.PI*2);
          ctx.fill();
          ctx.restore();
        }
      }

      requestAnimationFrame(loop);
    };
    loop();

    // Also wire up game-over screen bg
    const go2 = document.getElementById('menuBgCanvas2');
    if (go2) {
      const r2 = () => { go2.width = window.innerWidth; go2.height = window.innerHeight; };
      r2();
      window.addEventListener('resize', r2);
      const c2 = go2.getContext('2d');
      const l2 = () => {
        c2.drawImage(canvas, 0, 0);
        requestAnimationFrame(l2);
      };
      l2();
    }

    // Footer canvas
    this._animateFooter();
  }

  _animateFooter() {
    const fc = document.getElementById('footerCanvas');
    if (!fc) return;
    const resize = () => { fc.width = fc.parentElement.offsetWidth; fc.height = fc.parentElement.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const ctx = fc.getContext('2d');
    const fStars = [];
    for (let i = 0; i < 80; i++) {
      fStars.push({ x: rand(0,1), y: rand(0,1), r: rand(0.5,2), tw: rand(0,Math.PI*2), c: ['#00d4ff','#ffffff','#aa00ff'][randInt(0,3)] });
    }
    const fl = () => {
      const w = fc.width, h = fc.height;
      ctx.clearRect(0,0,w,h);
      for (const s of fStars) {
        s.tw += 0.03;
        const b = 0.4 + 0.6 * Math.abs(Math.sin(s.tw));
        ctx.save();
        ctx.globalAlpha = b * 0.7;
        ctx.shadowBlur  = 8;
        ctx.shadowColor = s.c;
        ctx.fillStyle   = s.c;
        ctx.beginPath();
        ctx.arc(s.x*w, s.y*h, s.r, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
      requestAnimationFrame(fl);
    };
    fl();
  }

  /* -------- Events -------- */
  _bindEvents() {
    window.addEventListener('resize', () => this._resize());
    this._resize();

    // Mouse
    this.canvas.addEventListener('mousemove', e => {
      const cx = this.canvas.width  / 2;
      const cy = this.canvas.height / 2;
      this.mouseAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    });
    this.canvas.addEventListener('mousedown', e => {
      if (e.button === 0) this._setBoost(true);
    });
    this.canvas.addEventListener('mouseup', () => this._setBoost(false));

    // Keyboard
    window.addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); this._setBoost(true); }
      if (e.code === 'Escape' || e.code === 'KeyP') this._togglePause();
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'Space') this._setBoost(false);
    });

    // Touch
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      this._setBoost(true);
      this.touching = true;
      this._handleTouch(e.touches[0]);
    }, { passive: false });
    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      this._handleTouch(e.touches[0]);
    }, { passive: false });
    this.canvas.addEventListener('touchend', () => {
      this._setBoost(false);
      this.touching = false;
    });
  }
  _handleTouch(t) {
    const cx = this.canvas.width  / 2;
    const cy = this.canvas.height / 2;
    this.mouseAngle = Math.atan2(t.clientY - cy, t.clientX - cx);
  }
  _setBoost(on) {
    if (this.player) this.player.boosting = on && this.player.boost > 5;
  }
  _togglePause() {
    if (!this.running) return;
    this.paused = !this.paused;
    showScreen(this.paused ? 'pauseScreen' : 'gameScreen');
  }
  _resize() {
    if (this.canvas) {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
    if (this.minimap) {
      const mm = parseInt(getComputedStyle(this.minimap).width);
      this.minimap.width  = mm || 160;
      this.minimap.height = mm || 160;
    }
  }

  /* -------- Init Game -------- */
  init(playerName, skinIdx, aiCount) {
    this.playerName = playerName || 'Player';
    this.skinIdx    = skinIdx || 0;
    this.aiCount    = aiCount || 10;

    this.frame      = 0;
    this.particles  = [];
    this.foods      = [];
    this.snakes     = [];
    this.bestRank   = Infinity;
    this.paused     = false;
    this.running    = true;

    this.stars = new StarField();

    // Player
    const px = rand(CFG.MAP_W * 0.2, CFG.MAP_W * 0.8);
    const py = rand(CFG.MAP_H * 0.2, CFG.MAP_H * 0.8);
    this.player = new Snake(px, py, this.playerName, this.skinIdx, true);
    this.snakes.push(this.player);

    // AI
    for (let i = 0; i < this.aiCount; i++) this._spawnAI();

    // Food
    this._populateFood();

    // Camera
    this.camX = this.player.x - this.canvas.width  / 2;
    this.camY = this.player.y - this.canvas.height / 2;

    // Start loop
    if (this._raf) cancelAnimationFrame(this._raf);
    this._loop();
  }

  _spawnAI() {
    let x, y, attempts = 0;
    do {
      x = rand(100, CFG.MAP_W - 100);
      y = rand(100, CFG.MAP_H - 100);
      attempts++;
    } while (this.player && dist(x, y, this.player.x, this.player.y) < 400 && attempts < 20);

    const nameIdx = randInt(0, CFG.AI_NAMES.length);
    const skinIdx = randInt(0, CFG.SKINS.length);
    const ai = new Snake(x, y, CFG.AI_NAMES[nameIdx], skinIdx, false);
    // Give AIs some random initial growth
    ai.minLength = 20 + randInt(0, 100);
    ai.score     = randInt(0, 500);
    this.snakes.push(ai);
    return ai;
  }

  _populateFood() {
    while (this.foods.length < CFG.FOOD_COUNT) {
      this.foods.push(new Food(rand(50, CFG.MAP_W - 50), rand(50, CFG.MAP_H - 50)));
    }
  }

  /* -------- Main Loop -------- */
  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    if (this.paused) return;
    if (!this.running) return;

    this.frame++;
    this._update();
    this._draw();
    this._updateHUD();
  }

  _update() {
    // Stars
    this.stars.update();

    // Refill food
    if (this.frame % 30 === 0) {
      const needed = CFG.FOOD_COUNT - this.foods.filter(f => f.alive).length;
      for (let i = 0; i < Math.min(needed, 10); i++) {
        this.foods.push(new Food(rand(50, CFG.MAP_W-50), rand(50, CFG.MAP_H-50)));
      }
      // Cull dead food
      if (this.foods.length > CFG.FOOD_COUNT * 2) {
        this.foods = this.foods.filter(f => f.alive);
      }
    }

    // Food update
    for (const f of this.foods) if (f.alive) f.update();

    // Snakes
    for (const s of this.snakes) {
      if (!s.alive) continue;
      s.update(1, this.foods, this.snakes, this.mouseAngle);
    }

    // Collisions: snake–food
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const hr = s.headRadius;
      for (const f of this.foods) {
        if (!f.alive) continue;
        if (dist2(s.x, s.y, f.x, f.y) < (hr + f.radius) ** 2) {
          s.eatFood(f);
          if (s.isPlayer) this.sound.eat();
          this._spawnParticles(f.x, f.y, f.color, 6);
        }
      }
    }

    // Collisions: head–body
    const alive = this.snakes.filter(s => s.alive);
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i];
      const ahr = a.headRadius;
      for (let j = 0; j < alive.length; j++) {
        if (i === j) continue;
        const b = alive[j];
        // Check if a's head hits b's body segments
        for (let k = 3; k < b.segments.length; k++) {
          const seg = b.segments[k];
          const segR = Math.max(4, b.headRadius * (0.65 + 0.35 * (1 - k / b.segments.length)));
          if (dist2(a.x, a.y, seg.x, seg.y) < (ahr + segR * 0.6) ** 2) {
            this._killSnake(a, b.isPlayer ? null : b);
            break;
          }
        }
        if (!a.alive) break;
      }
    }

    // Respawn dead AI
    if (this.frame % 180 === 0) {
      const deadAI = this.snakes.filter(s => !s.isPlayer && !s.alive);
      const liveAI = this.snakes.filter(s => !s.isPlayer && s.alive);
      if (liveAI.length < this.aiCount) {
        this._spawnAI();
      }
      // Clean up old dead AIs
      if (deadAI.length > 5) {
        this.snakes = this.snakes.filter(s => s.alive || s.isPlayer);
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    // Camera
    if (this.player && this.player.alive) {
      this.targetCamX = this.player.x - this.canvas.width  / 2;
      this.targetCamY = this.player.y - this.canvas.height / 2;
      // Dynamic zoom based on length
      this.targetZoom = clamp(1 - this.player.length * 0.0003, 0.55, 1.0);
    }
    this.camX = lerp(this.camX, this.targetCamX, 0.08);
    this.camY = lerp(this.camY, this.targetCamY, 0.08);
    this.zoom = lerp(this.zoom, this.targetZoom, 0.04);

    // Check player death
    if (this.player && !this.player.alive) {
      setTimeout(() => {
        if (!this.player.alive) this._showGameOver();
      }, 1200);
    }
  }

  _killSnake(snake, killer) {
    if (!snake.alive) return;
    snake.alive = false;
    this.sound.die();

    // Explode body into food
    const color = snake.skin.glow;
    for (let i = 0; i < snake.segments.length; i += 3) {
      const seg = snake.segments[i];
      const f   = new Food(seg.x, seg.y);
      f.color   = color;
      f.score   = 2;
      f.radius  = 8;
      f.type    = 'energy';
      this.foods.push(f);
      this._spawnParticles(seg.x, seg.y, color, 3);
    }

    // Flash explosion at head
    this._spawnParticles(snake.x, snake.y, color, 40);

    // Kill feed
    if (snake.isPlayer || (killer && killer.isPlayer)) {
      if (killer && killer.isPlayer) {
        killer.kills++;
        this.sound.kill();
        this._addKillFeed(`☠ ${killer.name} killed ${snake.name}`);
      } else {
        this._addKillFeed(`💀 ${snake.name} was eliminated`);
      }
    }
  }

  _spawnParticles(x, y, color, count) {
    const setting = document.getElementById('settingParticles')?.value || 'high';
    const mult = setting === 'high' ? 1 : setting === 'medium' ? 0.5 : 0.25;
    const n = Math.floor(count * mult);
    for (let i = 0; i < n; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(1, 5);
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color,
        rand(20, 50),
        rand(2, 6)
      ));
    }
  }

  _addKillFeed(msg) {
    const item = document.createElement('div');
    item.className = 'kill-item';
    item.textContent = msg;
    this.killFeed.appendChild(item);
    setTimeout(() => { if (item.parentNode) item.parentNode.removeChild(item); }, 3000);
  }

  /* -------- Draw -------- */
  _draw() {
    const ctx = this.ctx;
    const vw  = this.canvas.width;
    const vh  = this.canvas.height;

    ctx.clearRect(0, 0, vw, vh);

    // Background
    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, vw, vh);

    // Apply zoom
    ctx.save();
    const cx = vw / 2, cy = vh / 2;
    ctx.translate(cx, cy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-cx, -cy);

    // Stars & background
    this.stars.draw(ctx, this.camX, this.camY, vw, vh);

    // World boundary
    ctx.save();
    ctx.strokeStyle = 'rgba(0,212,255,0.3)';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00d4ff';
    ctx.strokeRect(-this.camX, -this.camY, CFG.MAP_W, CFG.MAP_H);
    ctx.restore();

    // Food
    for (const f of this.foods) {
      if (!f.alive) continue;
      const fx = f.x - this.camX;
      const fy = f.y - this.camY;
      if (fx < -50 || fx > vw + 50 || fy < -50 || fy > vh + 50) continue;
      f.draw(ctx, this.camX, this.camY);
    }

    // Particles
    for (const p of this.particles) {
      p.draw(ctx, this.camX, this.camY);
    }

    // Snakes (dead segments first, then alive)
    for (const s of this.snakes) {
      if (!s.alive) continue;
      // Culling
      const hx = s.x - this.camX;
      const hy = s.y - this.camY;
      if (hx < -300 || hx > vw + 300 || hy < -300 || hy > vh + 300) continue;
      s.draw(ctx, this.camX, this.camY);
    }

    ctx.restore();

    // Vignette
    const vig = ctx.createRadialGradient(vw/2, vh/2, vh*0.3, vw/2, vh/2, vh*0.9);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, vw, vh);

    // Minimap
    this._drawMinimap();
  }

  _drawMinimap() {
    const mm  = this.minimap;
    const ctx = this.mmCtx;
    const mw  = mm.width;
    const mh  = mm.height;
    const scaleX = mw / CFG.MAP_W;
    const scaleY = mh / CFG.MAP_H;

    ctx.clearRect(0, 0, mw, mh);
    ctx.fillStyle = 'rgba(2,8,20,0.9)';
    ctx.fillRect(0, 0, mw, mh);

    // Grid
    ctx.strokeStyle = 'rgba(0,212,255,0.06)';
    ctx.lineWidth   = 0.5;
    for (let x = 0; x < mw; x += mw/8) {
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,mh); ctx.stroke();
    }
    for (let y = 0; y < mh; y += mh/8) {
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(mw,y); ctx.stroke();
    }

    // Food dots
    for (const f of this.foods) {
      if (!f.alive) continue;
      ctx.fillStyle = f.color + '88';
      ctx.beginPath();
      ctx.arc(f.x * scaleX, f.y * scaleY, 1, 0, Math.PI*2);
      ctx.fill();
    }

    // Snakes
    for (const s of this.snakes) {
      if (!s.alive) continue;
      ctx.fillStyle = s.skin.glow;
      ctx.shadowBlur  = 4;
      ctx.shadowColor = s.skin.glow;
      ctx.beginPath();
      ctx.arc(s.x * scaleX, s.y * scaleY, s.isPlayer ? 4 : 2.5, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Camera rectangle (viewport)
    if (this.player) {
      const vw = this.canvas.width;
      const vh = this.canvas.height;
      ctx.strokeStyle = 'rgba(0,212,255,0.5)';
      ctx.lineWidth   = 1;
      ctx.strokeRect(
        this.camX * scaleX, this.camY * scaleY,
        vw * scaleX, vh * scaleY
      );
    }

    // Border
    ctx.strokeStyle = 'rgba(0,212,255,0.25)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(0, 0, mw, mh);
  }

  /* -------- HUD -------- */
  _updateHUD() {
    if (!this.player) return;
    const p = this.player;

    // Sort for rank
    const alive = this.snakes.filter(s => s.alive);
    alive.sort((a,b) => b.minLength - a.minLength);
    const rank = alive.indexOf(p) + 1;
    if (rank > 0 && rank < this.bestRank) this.bestRank = rank;

    document.getElementById('hudScore').textContent  = p.score;
    document.getElementById('hudKills').textContent  = p.kills;
    document.getElementById('hudLength').textContent = p.minLength;
    document.getElementById('hudRank').textContent   = `#${rank}`;

    // Boost fill
    const bf = document.getElementById('boostFill');
    if (bf) bf.style.width = p.boost + '%';

    // Live leaderboard
    const list = document.getElementById('liveBoardList');
    if (list) {
      list.innerHTML = '';
      const top = alive.slice(0, 8);
      for (let i = 0; i < top.length; i++) {
        const s   = top[i];
        const li  = document.createElement('li');
        if (s.isPlayer) li.classList.add('player-entry');
        li.innerHTML = `<span>${i+1}. ${s.name}</span><span>${s.minLength}</span>`;
        list.appendChild(li);
      }
    }
  }

  /* -------- Game Over -------- */
  _showGameOver() {
    this.running = false;
    document.getElementById('goScore').textContent  = this.player.score;
    document.getElementById('goKills').textContent  = this.player.kills;
    document.getElementById('goLength').textContent = this.player.minLength;
    document.getElementById('goRank').textContent   = `#${this.bestRank}`;

    // Save to leaderboard
    saveScore(this.playerName, this.player.score);

    showScreen('gameOverScreen');
    this.sound.die();
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}

/* ============================================================
   LEADERBOARD STORAGE
   ============================================================ */
function saveScore(name, score) {
  try {
    let board = JSON.parse(localStorage.getItem('abdullahio_lb') || '[]');
    board.push({ name, score, date: Date.now() });
    board.sort((a,b) => b.score - a.score);
    board = board.slice(0, 20);
    localStorage.setItem('abdullahio_lb', JSON.stringify(board));
  } catch(e) {}
}
function loadLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem('abdullahio_lb') || '[]');
  } catch(e) { return []; }
}
function renderLeaderboard() {
  const list  = document.getElementById('leaderboardList');
  const board = loadLeaderboard();
  list.innerHTML = '';
  if (board.length === 0) {
    list.innerHTML = '<li style="color:#6a8caa;text-align:center;font-size:0.8rem">No scores yet. Play a game!</li>';
    return;
  }
  for (let i = 0; i < board.length; i++) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${i+1}. ${board[i].name}</span><span>${board[i].score}</span>`;
    list.appendChild(li);
  }
}

/* ============================================================
   SCREEN MANAGER
   ============================================================ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');

  // Show footer only on main menu & game over
  const footer = document.getElementById('siteFooter');
  if (id === 'mainMenu' || id === 'gameOverScreen') {
    footer.style.display = 'block';
    document.body.style.overflow = 'auto';
  } else {
    footer.style.display = 'none';
    document.body.style.overflow = 'hidden';
  }
}

function closePanel(id) {
  document.getElementById(id).classList.remove('open');
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
let game = null;

window.addEventListener('DOMContentLoaded', () => {
  // Show main menu first
  showScreen('mainMenu');
  document.getElementById('siteFooter').style.display = 'block';
  document.body.style.overflow = 'auto';

  game = new Game();

  /* ---- Button Wiring ---- */
  document.getElementById('btnPlay').addEventListener('click', () => {
    const name    = document.getElementById('usernameInput').value.trim() || 'Player';
    const skinIdx = parseInt(document.getElementById('settingSkin')?.value || '0');
    const aiCount = parseInt(document.getElementById('settingAI')?.value || '10');
    game.sound.resume();
    game.sound.startMusic();
    showScreen('gameScreen');
    game.init(name, skinIdx, aiCount);
  });

  document.getElementById('btnLeaderboard').addEventListener('click', () => {
    renderLeaderboard();
    document.getElementById('leaderboardPanel').classList.add('open');
  });

  document.getElementById('btnSettings').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.add('open');
  });

  // Sound toggles
  const sndToggle = document.getElementById('toggleSound');
  sndToggle.addEventListener('click', () => {
    game.sound.sfxOn = !game.sound.sfxOn;
    sndToggle.querySelector('.toggle-knob').classList.toggle('on', game.sound.sfxOn);
    sndToggle.classList.toggle('active', game.sound.sfxOn);
  });

  const musToggle = document.getElementById('toggleMusic');
  musToggle.addEventListener('click', () => {
    game.sound.musOn = !game.sound.musOn;
    musToggle.querySelector('.toggle-knob').classList.toggle('on', game.sound.musOn);
    musToggle.classList.toggle('active', game.sound.musOn);
    if (game.sound.musOn) game.sound.startMusic();
    else game.sound.stopMusic();
  });

  // Respawn
  document.getElementById('btnRespawn').addEventListener('click', () => {
    const name    = game.playerName;
    const skinIdx = game.skinIdx;
    const aiCount = game.aiCount;
    showScreen('gameScreen');
    game.init(name, skinIdx, aiCount);
  });

  // Return to menu
  document.getElementById('btnMenuReturn').addEventListener('click', () => {
    game.stop();
    showScreen('mainMenu');
  });

  // Pause
  document.getElementById('btnPause').addEventListener('click', () => {
    game._togglePause();
  });
  document.getElementById('btnResume').addEventListener('click', () => {
    game.paused = false;
    showScreen('gameScreen');
  });
  document.getElementById('btnPauseMenu').addEventListener('click', () => {
    game.stop();
    showScreen('mainMenu');
  });
});
