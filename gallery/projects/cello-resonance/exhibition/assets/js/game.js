/**
 * 弦境回响 — Cello Resonance
 * 2D Narrative Puzzle Adventure Game
 * 
 * Concept: A lone explorer with an antique cello traverses a mystical forest,
 * using sound to interact with the environment:
 *   - Pitch creates translucent light bridges (音高光桥)
 *   - Heavy bow pressure shatters stone walls (弓压碎石)
 *   - Gentle tone grows luminous vines (轻音生藤)
 *   - Harmonic resonance defeats the spectral guardian (和声共鸣)
 *
 * Controls:
 *   - Mouse drag left/right = bow stroke (direction & speed)
 *   - Mouse Y position = pitch (higher position = higher note)
 *   - Drag intensity = bow pressure (fast/forceful = heavy, slow = gentle)
 *   - WASD / Arrow keys = move explorer
 *   - Click = interact with puzzle targets
 *   - Space = emit sustained resonance (for boss)
 */

// ═══════════════════════════════════════════════════════
// AUDIO ENGINE — Web Audio API Cello Synthesis
// ═══════════════════════════════════════════════════════
const AudioEngine = {
  ctx: null,
  masterGain: null,
  initialized: false,
  activeOscs: [],
  lastPlayTime: 0,

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.25;

    // Reverb for atmosphere
    const convolver = this.ctx.createConvolver();
    const rate = this.ctx.sampleRate;
    const length = rate * 2.5;
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
    }
    convolver.buffer = impulse;
    const dryGain = this.ctx.createGain(); dryGain.gain.value = 0.6;
    const wetGain = this.ctx.createGain(); wetGain.gain.value = 0.4;
    this.masterGain.connect(dryGain); dryGain.connect(this.ctx.destination);
    this.masterGain.connect(convolver); convolver.connect(wetGain); wetGain.connect(this.ctx.destination);
    this.initialized = true;
  },

  // Play a cello-like note. pitchHz, volume 0-1, durationMs, bowPressure 0-1
  playNote(pitchHz, volume, durationMs, bowPressure) {
    if (!this.initialized) this.init();
    this.stopAll();
    const now = this.ctx.currentTime;
    const dur = durationMs / 1000;

    // Fundamental
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = pitchHz;

    // Rich harmonics for cello timbre
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = pitchHz;

    const osc3 = this.ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = pitchHz * 2; // 2nd harmonic

    // Blend: fundamental dominant, sawtooth subtle, 2nd harmonic ambient
    const gain1 = this.ctx.createGain();
    gain1.gain.value = volume * 0.7;
    const gain2 = this.ctx.createGain();
    // Bow pressure affects harmonic content: heavy = more sawtooth (gritty)
    gain2.gain.value = volume * (0.05 + bowPressure * 0.15);
    const gain3 = this.ctx.createGain();
    gain3.gain.value = volume * 0.12;

    // Envelope: attack, sustain, release
    const attackTime = 0.08;
    const releaseTime = 0.3;

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(volume * 0.7, now + attackTime);
    gain1.gain.setValueAtTime(volume * 0.7, now + dur - releaseTime);
    gain1.gain.linearRampToValueAtTime(0, now + dur);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(volume * (0.05 + bowPressure * 0.15), now + attackTime);
    gain2.gain.setValueAtTime(volume * (0.05 + bowPressure * 0.15), now + dur - releaseTime);
    gain2.gain.linearRampToValueAtTime(0, now + dur);

    gain3.gain.setValueAtTime(0, now);
    gain3.gain.linearRampToValueAtTime(volume * 0.12, now + attackTime);
    gain3.gain.setValueAtTime(volume * 0.12, now + dur - releaseTime);
    gain3.gain.linearRampToValueAtTime(0, now + dur);

    osc.connect(gain1); gain1.connect(this.masterGain);
    osc2.connect(gain2); gain2.connect(this.masterGain);
    osc3.connect(gain3); gain3.connect(this.masterGain);

    osc.start(now); osc.stop(now + dur);
    osc2.start(now); osc2.stop(now + dur);
    osc3.start(now); osc3.stop(now + dur);

    this.activeOscs = [osc, osc2, osc3];
    this.lastPlayTime = Date.now();
  },

  // Sustained resonance for boss fight
  startResonance(pitchHz, volume) {
    if (!this.initialized) this.init();
    this.stopAll();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = pitchHz;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine'; osc2.frequency.value = pitchHz * 1.5; // perfect fifth
    const osc3 = this.ctx.createOscillator();
    osc3.type = 'sine'; osc3.frequency.value = pitchHz * 2; // octave

    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(volume * 0.5, now + 0.3);
    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(volume * 0.25, now + 0.5);
    const gain3 = this.ctx.createGain();
    gain3.gain.setValueAtTime(0, now);
    gain3.gain.linearRampToValueAtTime(volume * 0.15, now + 0.7);

    osc.connect(gain1); gain1.connect(this.masterGain);
    osc2.connect(gain2); gain2.connect(this.masterGain);
    osc3.connect(gain3); gain3.connect(this.masterGain);

    osc.start(now); osc2.start(now); osc3.start(now);
    this.activeOscs = [osc, osc2, osc3];
    this.lastPlayTime = Date.now();
  },

  stopAll() {
    for (const osc of this.activeOscs) {
      try { osc.stop(); } catch(e) {}
    }
    this.activeOscs = [];
  },

  // Pitch mapping: mouseY 0-1 → Hz
  // Cello range: C2(65) to A4(440), roughly 2 octaves
  mouseYToPitch(yNorm) {
    // yNorm: 0 = top (high pitch), 1 = bottom (low pitch)
    const minHz = 65;  // C2
    const maxHz = 440; // A4
    return maxHz - yNorm * (maxHz - minHz);
  },

  // Named pitches for puzzle targets
  noteNames: {
    65.4: 'C2', 73.4: 'D2', 82.4: 'E2', 87.3: 'F2', 98.0: 'G2',
    110.0: 'A2', 123.5: 'B2', 130.8: 'C3', 147.8: 'D3', 165.0: 'E3',
    196.0: 'G3', 220.0: 'A3', 261.6: 'C4', 293.7: 'D4', 329.6: 'E4',
    392.0: 'G4', 440.0: 'A4'
  },

  getClosestNoteName(hz) {
    let closest = null, minDist = Infinity;
    for (const [freq, name] of Object.entries(this.noteNames)) {
      const d = Math.abs(hz - parseFloat(freq));
      if (d < minDist) { minDist = d; closest = name; }
    }
    return closest;
  }
};

// ═══════════════════════════════════════════════════════
// VISUAL EFFECTS — Painterly Rendering Helpers
// ═══════════════════════════════════════════════════════
const PaintFX = {
  // Generate a painterly texture overlay (soft noise)
  noiseCanvas: null,
  noiseData: null,

  initNoise(w, h) {
    this.noiseCanvas = document.createElement('canvas');
    this.noiseCanvas.width = w;
    this.noiseCanvas.height = h;
    const ctx = this.noiseCanvas.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.random() * 20;
      imgData.data[i] = v; imgData.data[i+1] = v; imgData.data[i+2] = v;
      imgData.data[i+3] = 15; // very subtle
    }
    ctx.putImageData(imgData, 0, 0);
    this.noiseData = this.noiseCanvas;
  },

  // Draw a painterly tree
  drawTree(ctx, x, y, h, trunkColor, leafColor, mistLevel) {
    const tw = h * 0.08;
    // Trunk with slight curve
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - tw/2, y);
    ctx.bezierCurveTo(x - tw/2 - 2, y - h*0.3, x + tw/3, y - h*0.5, x - tw/4, y - h*0.6);
    ctx.bezierCurveTo(x + tw/2, y - h*0.5, x + tw/2 + 2, y - h*0.3, x + tw/2, y);
    ctx.fillStyle = trunkColor;
    ctx.fill();

    // Leaf clusters (3-5 soft circles)
    const leafY = y - h * 0.55;
    for (let i = 0; i < 5; i++) {
      const lx = x + (Math.random() - 0.5) * h * 0.35;
      const ly = leafY - (Math.random() - 0.5) * h * 0.25;
      const lr = h * 0.15 + Math.random() * h * 0.1;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fillStyle = leafColor;
      ctx.globalAlpha = 0.6 + mistLevel * 0.15;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  // Draw mist overlay
  drawMist(ctx, w, h, density) {
    ctx.save();
    for (let i = 0; i < 8; i++) {
      const mx = Math.random() * w;
      const my = h * 0.3 + Math.random() * h * 0.4;
      const mr = 60 + Math.random() * 120;
      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      grad.addColorStop(0, `rgba(200, 210, 220, ${density * 0.15})`);
      grad.addColorStop(1, 'rgba(200, 210, 220, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
    ctx.restore();
  },

  // Draw sound wave ribbons emanating from cello
  drawSoundRibbons(ctx, originX, originY, pitch, pressure, time) {
    const ribbonCount = 3 + Math.floor(pressure * 4);
    const baseRadius = 20 + pressure * 30;
    // Pitch → color: low=deep warm, high=cool bright
    const hue = 30 + (pitch - 65) / (440 - 65) * 200; // 30°(orange) to 230°(blue)

    ctx.save();
    for (let r = 0; r < ribbonCount; r++) {
      const delay = r * 0.15;
      const age = (time + delay) % 1.5;
      const radius = baseRadius + age * 80;
      const alpha = Math.max(0, 0.5 - age * 0.35);

      ctx.beginPath();
      ctx.arc(originX, originY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue + r * 20}, 70%, 65%, ${alpha})`;
      ctx.lineWidth = 3 - age * 1.5;
      ctx.stroke();

      // Inner glow
      if (alpha > 0.1) {
        const grad = ctx.createRadialGradient(originX, originY, radius * 0.7, originX, originY, radius);
        grad.addColorStop(0, `hsla(${hue + r * 20}, 80%, 75%, ${alpha * 0.3})`);
        grad.addColorStop(1, `hsla(${hue + r * 20}, 80%, 75%, 0)`);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }
    ctx.restore();
  },

  // Draw a glowing light bridge
  drawLightBridge(ctx, x1, y1, x2, y2, hue, strength, time) {
    ctx.save();
    const wobble = Math.sin(time * 2) * 3;
    const alpha = 0.3 + strength * 0.5;

    // Main bridge arc
    ctx.beginPath();
    ctx.moveTo(x1, y1 + wobble);
    const midX = (x1 + x2) / 2;
    const midY = Math.min(y1, y2) - 30 - strength * 20;
    ctx.quadraticCurveTo(midX, midY + wobble, x2, y2 + wobble);
    ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${alpha})`;
    ctx.lineWidth = 8 + strength * 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Inner bright line
    ctx.beginPath();
    ctx.moveTo(x1, y1 + wobble);
    ctx.quadraticCurveTo(midX, midY + wobble, x2, y2 + wobble);
    ctx.strokeStyle = `hsla(${hue}, 90%, 85%, ${alpha * 0.7})`;
    ctx.lineWidth = 3 + strength * 4;
    ctx.stroke();

    // Sparkle particles along bridge
    for (let i = 0; i < 8; i++) {
      const t = (i / 8 + time * 0.3) % 1;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (midY - y1) * (1 - 4 * (t - 0.5) * (t - 0.5)) + wobble;
      const ps = 2 + Math.sin(time * 5 + i) * 1.5;
      ctx.beginPath();
      ctx.arc(px, py, ps, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 100%, 90%, ${0.4 + Math.sin(time * 3 + i) * 0.3})`;
      ctx.fill();
    }
    ctx.restore();
  },

  // Draw growing vine
  drawVine(ctx, startX, startY, length, time, hue) {
    ctx.save();
    const segments = 8;
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const growth = Math.min(1, time / 2); // takes 2s to fully grow
      const currentLen = length * growth * t;
      const wave = Math.sin(t * 4 + time * 2) * 15;
      points.push({
        x: startX + wave + Math.sin(t * 3) * 10,
        y: startY - currentLen
      });
    }

    // Stem
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = `hsla(${hue}, 60%, 50%, 0.8)`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Leaves
    for (let i = 2; i < points.length; i += 2) {
      const p = points[i];
      const leafSize = 8 + Math.sin(time + i) * 3;
      const leafAngle = Math.sin(time * 1.5 + i) * 0.3 + (i % 4 === 0 ? 0.5 : -0.5);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(leafAngle);
      ctx.beginPath();
      ctx.ellipse(0, 0, leafSize, leafSize * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue + 10}, 70%, 60%, 0.7)`;
      ctx.fill();
      ctx.restore();
    }

    // Glow
    const tip = points[points.length - 1];
    const grad = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 20);
    grad.addColorStop(0, `hsla(${hue}, 80%, 70%, 0.4)`);
    grad.addColorStop(1, `hsla(${hue}, 80%, 70%, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(tip.x - 20, tip.y - 20, 40, 40);

    ctx.restore();
    return growth >= 1; // true when fully grown
  },

  // Draw a visible stone wall / boulder (intact)
  drawStoneWall(ctx, cx, cy, radius, label, time) {
    ctx.save();
    const w = radius * 2.2;
    const h = radius * 1.8;

    // Glow halo to make it stand out in dark scenes
    const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 2);
    glowGrad.addColorStop(0, 'rgba(140, 120, 80, 0.25)');
    glowGrad.addColorStop(1, 'rgba(140, 120, 80, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(cx - radius * 2, cy - radius * 2, radius * 4, radius * 4);

    // Main rock body — irregular polygon for natural look
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.45, cy + h * 0.4);
    ctx.lineTo(cx - w * 0.5, cy - h * 0.1);
    ctx.lineTo(cx - w * 0.3, cy - h * 0.45);
    ctx.lineTo(cx + w * 0.1, cy - h * 0.5);
    ctx.lineTo(cx + w * 0.45, cy - h * 0.35);
    ctx.lineTo(cx + w * 0.5, cy + h * 0.05);
    ctx.lineTo(cx + w * 0.4, cy + h * 0.45);
    ctx.closePath();

    // Stone gradient fill
    const stoneGrad = ctx.createLinearGradient(cx, cy - h * 0.5, cx, cy + h * 0.5);
    stoneGrad.addColorStop(0, '#7a6a5a');
    stoneGrad.addColorStop(0.5, '#6a5a4a');
    stoneGrad.addColorStop(1, '#4a3a2a');
    ctx.fillStyle = stoneGrad;
    ctx.fill();

    // Bold outline
    ctx.strokeStyle = '#8a7a6a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Cracks / texture lines
    ctx.strokeStyle = 'rgba(50, 40, 30, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.2, cy - h * 0.3);
    ctx.lineTo(cx + w * 0.05, cy);
    ctx.lineTo(cx - w * 0.1, cy + h * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.2, cy - h * 0.2);
    ctx.lineTo(cx + w * 0.3, cy + h * 0.15);
    ctx.stroke();

    // Highlight on top edge
    ctx.strokeStyle = 'rgba(160, 140, 110, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.3, cy - h * 0.4);
    ctx.lineTo(cx + w * 0.1, cy - h * 0.48);
    ctx.lineTo(cx + w * 0.4, cy - h * 0.3);
    ctx.stroke();

    // Pulsing red warning glow when player is nearby
    const pulse = 0.3 + Math.sin(time * 3) * 0.2;
    ctx.strokeStyle = `rgba(200, 80, 50, ${pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
    ctx.stroke();

    // Label
    if (label) {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = 'rgba(220, 180, 120, 0.8)';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy - radius - 15);
      // Sub-label
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(200, 100, 80, 0.6)';
      ctx.fillText('重弓碎石', cx, cy - radius - 2);
    }

    ctx.restore();
  },

  // Draw rubble remains on the ground (after stone is shattered)
  drawRockRubble(ctx, cx, groundY, radius, time) {
    ctx.save();
    const fragments = 8;
    const spread = radius * 1.5;

    // Ground stain / crack mark
    ctx.beginPath();
    ctx.ellipse(cx, groundY, spread, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40, 30, 20, 0.4)';
    ctx.fill();

    // Crack lines radiating from impact point
    ctx.strokeStyle = 'rgba(60, 45, 30, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, groundY);
      ctx.lineTo(cx + Math.cos(angle) * spread * 0.8, groundY + Math.sin(angle) * radius * 0.2);
      ctx.stroke();
    }

    // Scattered rubble fragments
    for (let i = 0; i < fragments; i++) {
      const angle = (i / fragments) * Math.PI * 2 + 0.4;
      const dist = radius * (0.6 + (i % 3) * 0.3);
      const fx = cx + Math.cos(angle) * dist;
      const fy = groundY - 2 + Math.sin(angle) * 4;
      const fSize = radius * (0.15 + (i % 4) * 0.05);

      // Fragment shape
      ctx.beginPath();
      ctx.moveTo(fx, fy - fSize);
      ctx.lineTo(fx + fSize * 0.8, fy);
      ctx.lineTo(fx, fy + fSize * 0.6);
      ctx.lineTo(fx - fSize * 0.7, fy);
      ctx.closePath();
      ctx.fillStyle = ['#6a5a4a', '#5a4a3a', '#7a6a5a'][i % 3];
      ctx.fill();
      ctx.strokeStyle = '#4a3a2a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Fading dust particles
    const dustAlpha = Math.max(0, 0.3 - time * 0.01);
    if (dustAlpha > 0) {
      for (let i = 0; i < 5; i++) {
        const dx = cx + (Math.random() - 0.5) * spread;
        const dy = groundY - Math.random() * 20;
        ctx.beginPath();
        ctx.arc(dx, dy, 2 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120, 100, 80, ${dustAlpha * 0.5})`;
        ctx.fill();
      }
    }

    ctx.restore();
  },

  // Draw shattering rocks
  drawRockShatter(ctx, cx, cy, radius, progress) {
    // progress 0-1: 0 = intact, 1 = fully shattered
    const fragments = 12;
    ctx.save();

    if (progress < 0.3) {
      // Intact rock with cracks appearing
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#5a4a3a';
      ctx.fill();
      ctx.strokeStyle = '#4a3a2a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cracks
      const crackCount = Math.floor(progress * 10);
      for (let i = 0; i < crackCount; i++) {
        const angle = (i / crackCount) * Math.PI * 2 + 0.3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        const crackLen = radius * (0.5 + progress * 1.5);
        ctx.lineTo(cx + Math.cos(angle) * crackLen, cy + Math.sin(angle) * crackLen);
        ctx.strokeStyle = `rgba(120, 90, 60, ${0.5 + progress})`;
        ctx.lineWidth = 1 + progress * 2;
        ctx.stroke();
      }
    } else {
      // Fragments flying outward
      for (let i = 0; i < fragments; i++) {
        const angle = (i / fragments) * Math.PI * 2;
        const dist = (progress - 0.3) * radius * 3;
        const fx = cx + Math.cos(angle) * dist;
        const fy = cy + Math.sin(angle) * dist - progress * 20;
        const fSize = radius * 0.3 * (1 - progress * 0.5);
        const fAlpha = 1 - progress;

        ctx.beginPath();
        ctx.moveTo(fx, fy - fSize);
        ctx.lineTo(fx + fSize * 0.8, fy);
        ctx.lineTo(fx, fy + fSize * 0.6);
        ctx.lineTo(fx - fSize * 0.8, fy);
        ctx.closePath();
        ctx.fillStyle = `rgba(90, 74, 58, ${fAlpha})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }
};

// ═══════════════════════════════════════════════════════
// SCENE DEFINITIONS
// ═══════════════════════════════════════════════════════
const Scenes = {
  // Title screen
  TITLE: {
    name: '弦境回响',
    subtitle: 'Cello Resonance',
    desc: 'A lone explorer, an antique cello, a mystical forest.\nSound shapes the world.',
    bg: 'title'
  },

  // Scene 1: Pitch Light Bridge
  BRIDGE: {
    name: '第一章：音高光桥',
    subtitle: 'Chapter 1: Pitch Light Bridges',
    desc: 'Cross the misty canyon. Different pitches create different colored bridges.\nLow notes → warm bridges. High notes → cool bridges.\nW / ↑ = Jump',
    bg: 'canyon',
    puzzles: [
      { type: 'bridge', gapX: 450, gapY: 400, gapWidth: 180, requiredPitchRange: [65, 110], hue: 30, label: 'C2-G2 暖色桥' },
      { type: 'bridge', gapX: 780, gapY: 400, gapWidth: 150, requiredPitchRange: [196, 330], hue: 160, label: 'G3-E4 翠色桥' },
      { type: 'bridge', gapX: 1080, gapY: 370, gapWidth: 200, requiredPitchRange: [330, 440], hue: 220, label: 'E4-A4 幽蓝桥' }
    ],
    platforms: [
      { x: 0, y: 400, w: 450 },       // Start platform
      { x: 630, y: 400, w: 150 },      // After bridge 1
      { x: 930, y: 400, w: 150 },      // After bridge 2
      { x: 1000, y: 370, w: 120 },     // Step-up platform before bridge 3 (was 30px, now 120px)
      { x: 1280, y: 370, w: 400 }      // Final platform at y=370
    ],
    exitX: 1600,
    playerStart: { x: 100, y: 350 }
  },

  // Scene 2: Stone Ruins + Vine Growth + Combinations
  RUINS: {
    name: '第二章：弓压机关',
    subtitle: 'Chapter 2: Bow Pressure & Combinations',
    desc: 'Ancient ruins block the path.\nHeavy bow → shatter stone walls.\nGentle bow → grow luminous vines.\nSequence bow → unlock harmonic gates.\nW / ↑ = Jump',
    bg: 'ruins',
    puzzles: [
      // Puzzle 0: Stone wall blocking the path (must shatter to proceed)
      { type: 'shatter', x: 480, y: 360, radius: 45, requiredPressure: 0.25, label: '重弓碎石', blocking: true, blockW: 60, blockH: 80 },
      // Puzzle 1: Vine ladder to reach higher platform (gap below)
      { type: 'vine', x: 770, startY: 400, length: 130, requiredPressureRange: [0, 0.5], hue: 120, label: '轻音生藤' },
      // Puzzle 2: Stone wall blocking path to final area
      { type: 'shatter', x: 1100, y: 360, radius: 55, requiredPressure: 0.3, label: '重弓破壁', blocking: true, blockW: 70, blockH: 90 }
    ],
    platforms: [
      { x: 0, y: 400, w: 430 },        // Start platform (ends before stone wall)
      // Gap at x=430-490 blocked by stone wall (puzzle 0)
      { x: 520, y: 400, w: 200 },       // After first shatter
      { x: 720, y: 400, w: 50 },        // Small ledge before vine
      // Vine area (puzzle 1): vine grows from y=400 upward, creates climbable ladder
      { x: 720, y: 270, w: 100 },       // Upper platform (reached via vine ladder)
      // Gap: need to jump down from upper platform to next area
      { x: 900, y: 400, w: 170 },       // Ground after vine section
      // Stone wall at x=1080-1140 blocks path (puzzle 2)
      { x: 1140, y: 400, w: 450 },      // After second shatter → continuous path to exit
    ],
    exitX: 1700,
    playerStart: { x: 100, y: 350 }
  },

  // Scene 3: Boss — Harmonic Resonance
  BOSS: {
    name: '第三章：和声共鸣',
    subtitle: 'Chapter 3: Harmonic Resonance',
    desc: 'The Spectral Forest Guardian awakens.\nMatch its harmonic pattern to resonate and dispel the darkness.',
    bg: 'boss',
    bossPatterns: [
      { notes: [130.8, 196.0], label: 'C3+G3 五度' },
      { notes: [196.0, 293.7], label: 'G3+D4 五度' },
      { notes: [130.8, 196.0, 261.6], label: 'C3+G3+C4 和弦' },
      { notes: [220, 330, 440], label: 'A3+E4+A4 和弦' }
    ],
    platforms: [
      { x: 0, y: 400, w: 2000 }
    ],
    exitX: null,
    playerStart: { x: 400, y: 350 }
  },

  // Victory
  VICTORY: {
    name: '森林苏醒',
    subtitle: 'The Forest Awakens',
    desc: 'Your resonance has awakened the forest.\nLight pours through the canopy.',
    bg: 'victory'
  }
};

// ═══════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════
const Game = {
  canvas: null, ctx: null,
  W: 0, H: 0,
  state: 'TITLE', // TITLE, PLAYING, BOSS_FIGHT, VICTORY, TRANSITION
  currentScene: 'BRIDGE',
  sceneIndex: 0,
  sceneOrder: ['BRIDGE', 'RUINS', 'BOSS'],

  // Player (Explorer)
  player: {
    x: 100, y: 370,
    vx: 0, vy: 0,
    w: 30, h: 50,
    speed: 3,
    jumpSpeed: -12,
    grounded: false,
    facing: 1, // 1=right, -1=left
    playing: false, // is bowing?
    bowDir: 0, // -1=upbow, 1=downbow
    bowSpeed: 0,
    bowPressure: 0.5,
    currentPitch: 196, // Hz
    celloAngle: 0, // visual tilt
    walkFrame: 0
  },

  // Bow input tracking
  bow: {
    active: false,
    startX: 0, startY: 0,
    lastX: 0, lastY: 0,
    dragDir: 0,
    dragSpeed: 0,
    dragIntensity: 0
  },

  // Mouse state
  mouse: { x: 0, y: 0, down: false },

  // Keys
  keys: {},

  // Puzzle state per scene
  puzzleState: {},
  solvedPuzzles: 0,
  totalPuzzles: 0,
  lastPuzzleCheckTime: 0,  // throttle: only check puzzles every 150ms
  puzzleCooldown: 0.15,    // 150ms between puzzle checks

  // Boss state
  boss: {
    hp: 100,
    currentPattern: 0,
    patternProgress: 0,
    matchingNotes: [],
    resonanceStrength: 0,
    defeated: false,
    guardianX: 1200,
    guardianY: 200,
    guardianAlpha: 0.8,
    humHz: 110
  },

  // Visual effects
  particles: [],
  soundWaves: [],
  ambientMist: 0.3,
  globalTime: 0,
  cameraX: 0,
  cameraTargetX: 0,
  shakeX: 0, shakeY: 0,
  shakeIntensity: 0,

  // Transition
  transition: { active: false, alpha: 0, direction: 'in', targetScene: null },

  // Hint text
  hintText: '',
  hintTimer: 0,

  // Scene-specific animated objects
  vines: [],
  shatters: [],
  bridges: [],
  bossDefeated: false,
  victoryTime: 0,

  // Tutorial state
  tutorial: {
    active: false,
    step: 0,
    stepTime: 0,
    ghostX: 200,
    ghostY: 350,
    ghostFacing: 1,
    ghostPlaying: false,
    ghostPitch: 196,
    ghostPressure: 0.5,
    ghostBowDir: 0,
    ghostWalkFrame: 0,
    ghostAlpha: 0.4,
    ghostPlayerH: 50,
    mouseGhostX: 0,
    mouseGhostY: 0,
    mouseGhostTrail: [],
    soundWaves: [],
    waitForPlayer: false,
    playerDidAction: false,
    steps: [
      { duration: 4, text: '按 A / D 键 ← → 移动探险者\n按 W / ↑ 键跳跃', action: 'walk',
        ghostMoves: [{time:0, x:200}, {time:1, x:350}, {time:2, x:200}, {time:3, x:100}, {time:4, x:200}] },
      { duration: 5, text: '按住鼠标 左右拖拽 → 运弓发声', action: 'bow',
        ghostMoves: [{time:0, x:200}], ghostBows: [{time:0.5, start:true, dir:1}, {time:1.5, dir:-1}, {time:2.5, dir:1}, {time:3.5, stop:true}] },
      { duration: 5, text: '鼠标上下位置 → 音高\n上方=高音(冷色) 下方=低音(暖色)', action: 'pitch',
        ghostMoves: [{time:0, x:200}], ghostPitchY: [{time:0, y:0.2}, {time:1.5, y:0.6}, {time:3, y:0.3}, {time:4, y:0.8}] },
      { duration: 5, text: '拖拽力度/速度 → 弓压\n猛拖=重压(碎石)  轻拖=轻压(生藤)', action: 'pressure',
        ghostMoves: [{time:0, x:200}], ghostBows: [{time:0.3, start:true, dir:1}],
        ghostPressures: [{time:0.5, pressure:0.8, text:'重弓 → 碎石'}, {time:2, pressure:0.2, text:'轻弓 → 生藤'}] },
      { duration: 3, text: '准备好了吗？\n点击或按 Space 开始冒险！', action: 'ready' }
    ]
  },

  // Title screen animation
  titleParticles: [],

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Input handlers
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.state === 'TITLE') this.startGame();
        else if (this.state === 'TUTORIAL') this.skipTutorial();
        else if (this.state === 'BOSS_FIGHT') this.toggleResonance();
        // In PLAYING state, Space = jump (handled in update loop)
      }
      if (e.code === 'Escape') {
        if (this.state === 'PLAYING' || this.state === 'BOSS_FIGHT') {
          this.state = 'TITLE';
        } else if (this.state === 'TUTORIAL') {
          this.skipTutorial();
        }
      }
      // Tutorial: track player movement (for interactive steps before skip)
      if (this.state === 'TUTORIAL') {
        const step = this.tutorial.steps[this.tutorial.step];
        if (step.action === 'walk' && (e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyW' || e.code === 'ArrowUp')) {
          this.tutorial.playerDidAction = true;
        }
      }
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    // Clear all keys when window loses focus (prevents stuck-key speed bug)
    window.addEventListener('blur', () => { this.keys = {}; });

    this.canvas.addEventListener('mousedown', e => {
      AudioEngine.init();
      this.mouse.down = true;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (this.state === 'TITLE') {
        this.startGame();
        return;
      }
      if (this.state === 'TUTORIAL') {
        // Click anywhere to skip entire tutorial
        this.skipTutorial();
        return;
      }
      // Start bowing (in PLAYING state)
      this.bow.active = true;
      this.bow.startX = e.clientX;
      this.bow.startY = e.clientY;
      this.bow.lastX = e.clientX;
      this.bow.lastY = e.clientY;
      this.player.playing = true;
    });

    this.canvas.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (this.bow.active) {
        const dx = e.clientX - this.bow.lastX;
        this.bow.dragDir = dx > 0 ? 1 : dx < 0 ? -1 : 0;
        this.bow.dragSpeed = Math.abs(dx);
        this.bow.dragIntensity = Math.abs(e.clientY - this.bow.startY) / this.H;
        this.bow.lastX = e.clientX;
        this.bow.lastY = e.clientY;

        // Update player bow state
        this.player.bowDir = this.bow.dragDir;
        this.player.bowSpeed = this.bow.dragSpeed;
        this.player.bowPressure = 0.15 + this.bow.dragIntensity * 0.85;
        // Pitch from mouse Y (0=top=high, 1=bottom=low)
        const yNorm = e.clientY / this.H;
        this.player.currentPitch = AudioEngine.mouseYToPitch(yNorm);

        // Play sound on significant drag — throttled to avoid audio overload
        if (this.bow.dragSpeed > 2 && this.globalTime - this.lastPuzzleCheckTime > this.puzzleCooldown) {
          const volume = Math.min(0.8, 0.3 + this.bow.dragSpeed * 0.05);
          AudioEngine.playNote(this.player.currentPitch, volume, 200, this.player.bowPressure);
          this.emitSoundWave(this.player.x, this.player.y, this.player.currentPitch, this.player.bowPressure);
          this.lastPuzzleCheckTime = this.globalTime;
          this.checkPuzzleInteractions();
        }
      }
    });

    this.canvas.addEventListener('mouseup', e => {
      this.mouse.down = false;
      this.bow.active = false;
      this.player.playing = false;
      AudioEngine.stopAll();
    });

    // Touch support
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      AudioEngine.init();
      this.mouse.down = true;
      this.mouse.x = t.clientX; this.mouse.y = t.clientY;
      if (this.state === 'TITLE') { this.startGame(); return; }
      this.bow.active = true;
      this.bow.startX = t.clientX; this.bow.startY = t.clientY;
      this.bow.lastX = t.clientX; this.bow.lastY = t.clientY;
      this.player.playing = true;
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      this.mouse.x = t.clientX; this.mouse.y = t.clientY;
      if (this.bow.active) {
        const dx = t.clientX - this.bow.lastX;
        this.bow.dragDir = dx > 0 ? 1 : dx < 0 ? -1 : 0;
        this.bow.dragSpeed = Math.abs(dx);
        this.bow.dragIntensity = Math.abs(t.clientY - this.bow.startY) / this.H;
        this.bow.lastX = t.clientX; this.bow.lastY = t.clientY;
        this.player.bowDir = this.bow.dragDir;
        this.player.bowSpeed = this.bow.dragSpeed;
        this.player.bowPressure = 0.15 + this.bow.dragIntensity * 0.85;
        const yNorm = t.clientY / this.H;
        this.player.currentPitch = AudioEngine.mouseYToPitch(yNorm);
        if (this.bow.dragSpeed > 2 && this.globalTime - this.lastPuzzleCheckTime > this.puzzleCooldown) {
          AudioEngine.playNote(this.player.currentPitch, 0.5, 200, this.player.bowPressure);
          this.emitSoundWave(this.player.x, this.player.y, this.player.currentPitch, this.player.bowPressure);
          this.lastPuzzleCheckTime = this.globalTime;
          this.checkPuzzleInteractions();
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      this.mouse.down = false;
      this.bow.active = false;
      this.player.playing = false;
      AudioEngine.stopAll();
    }, { passive: false });

    PaintFX.initNoise(256, 256);

    // Init title particles
    for (let i = 0; i < 30; i++) {
      this.titleParticles.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 0.3 - 0.1,
        size: 2 + Math.random() * 4,
        hue: 30 + Math.random() * 200,
        alpha: 0.2 + Math.random() * 0.3
      });
    }

    this.loop();
  },

  resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    PaintFX.initNoise(256, 256);
  },

  startGame() {
    this.state = 'TUTORIAL';
    this.tutorial.active = true;
    this.tutorial.step = 0;
    this.tutorial.stepTime = 0;
    this.tutorial.ghostX = 200;
    this.tutorial.ghostY = 350;
    this.tutorial.ghostFacing = 1;
    this.tutorial.ghostPlaying = false;
    this.tutorial.ghostPitch = 196;
    this.tutorial.ghostPressure = 0.5;
    this.tutorial.ghostBowDir = 0;
    this.tutorial.ghostWalkFrame = 0;
    this.tutorial.soundWaves = [];
    this.tutorial.waitForPlayer = false;
    this.tutorial.playerDidAction = false;
    this.tutorial.mouseGhostTrail = [];
    this.tutorial.currentPressureText = '';
    // Pre-seed some trail points for the bow demo
    for (let i = 0; i < 5; i++) {
      this.tutorial.mouseGhostTrail.push({x: this.W/2, y: this.H/2, time: -1});
    }
  },

  startActualGame() {
    this.state = 'PLAYING';
    this.sceneIndex = 0;
    this.currentScene = 'BRIDGE';
    this.tutorial.active = false;
    this.tutorial.soundWaves = [];
    this.loadScene(this.currentScene);
  },

  skipTutorial() {
    // Skip entire tutorial and go straight to game
    AudioEngine.stopAll();
    this.tutorial.active = false;
    this.tutorial.soundWaves = [];
    this.state = 'PLAYING';
    this.sceneIndex = 0;
    this.currentScene = 'BRIDGE';
    this.loadScene(this.currentScene);
  },

  loadScene(sceneKey) {
    const scene = Scenes[sceneKey];
    this.currentScene = sceneKey;
    this.puzzleState = {};
    this.vines = [];
    this.shatters = [];
    this.bridges = [];
    this.solvedPuzzles = 0;
    this.totalPuzzles = scene.puzzles ? scene.puzzles.length : 0;

    if (scene.playerStart) {
      this.player.x = scene.playerStart.x;
      this.player.y = scene.playerStart.y;
    }
    this.player.vx = 0; this.player.vy = 0;
    this.cameraX = 0; this.cameraTargetX = 0;

    if (sceneKey === 'BOSS') {
      this.state = 'BOSS_FIGHT';
      this.boss = {
        hp: 100, currentPattern: 0, patternProgress: 0,
        matchingNotes: [], resonanceStrength: 0,
        defeated: false, guardianX: 1200, guardianY: 200,
        guardianAlpha: 0.8, humHz: 110
      };
    }

    this.showHint(scene.desc, 4);
  },

  nextScene() {
    this.sceneIndex++;
    if (this.sceneIndex < this.sceneOrder.length) {
      this.startTransition(this.sceneOrder[this.sceneIndex]);
    } else {
      this.state = 'VICTORY';
      this.victoryTime = 0;
    }
  },

  startTransition(targetScene) {
    this.transition = { active: true, alpha: 0, direction: 'out', targetScene };
  },

  showHint(text, duration) {
    this.hintText = text;
    this.hintTimer = duration;
  },

  emitSoundWave(x, y, pitch, pressure) {
    this.soundWaves.push({
      x, y, pitch, pressure,
      birth: this.globalTime,
      life: 1.5
    });
  },

  checkPuzzleInteractions() {
    const scene = Scenes[this.currentScene];
    if (!scene.puzzles) return;

    // ALL distances in WORLD coordinates (player.x is world, puzzle.x is world)
    const px = this.player.x;
    const py = this.player.y;
    const pitch = this.player.currentPitch;
    const pressure = this.player.bowPressure;
    const facing = this.player.facing; // 1=right, -1=left

    for (let i = 0; i < scene.puzzles.length; i++) {
      const p = scene.puzzles[i];
      if (this.puzzleState[i] === 'solved') continue;

      // Directional distance: relaxed for testing — accept puzzles within ±100px facing tolerance
      const puzzleX = p.x || p.gapX;
      const dx = puzzleX - px;
      const isAhead = (facing > 0 && dx > -100) || (facing < 0 && dx < 100);

      // Range: generous for all puzzle types
      const maxDist = p.type === 'bridge' ? 300 : 150;
      const dy = (p.y || p.startY || p.gapY || 400) - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxDist) continue; // too far

      if (p.type === 'bridge') {
        if (isAhead && pressure > 0.1) {
          if (!this.puzzleState[i]) this.puzzleState[i] = { strength: 0 };
          this.puzzleState[i].strength = Math.min(1, this.puzzleState[i].strength + 0.15);
          if (this.puzzleState[i].strength >= 0.5) {
            this.puzzleState[i] = 'solved';
            this.solvedPuzzles++;
            this.showHint(`✦ ${p.label} — 光桥成形！`, 2);
            this.bridges.push({ ...p, solvedTime: this.globalTime });
          }
        }
      } else if (p.type === 'shatter') {
        if (isAhead && pressure >= p.requiredPressure) {
          if (!this.puzzleState[i]) this.puzzleState[i] = { progress: 0 };
          this.puzzleState[i].progress += 0.15;
          this.shakeIntensity = Math.min(5, this.shakeIntensity + 0.5);
          if (this.puzzleState[i].progress >= 1) {
            this.puzzleState[i] = 'solved';
            this.solvedPuzzles++;
            this.showHint(`✦ ${p.label} — 岩石碎裂！`, 2);
            this.shatters.push({ ...p, solvedTime: this.globalTime });
            this.shakeIntensity = 8;
          }
        }
      } else if (p.type === 'vine') {
        if (isAhead && pressure <= 0.5) {  // relaxed: any gentle bow works
          if (!this.puzzleState[i]) this.puzzleState[i] = { growthTime: 0 };
          this.puzzleState[i].growthTime += 0.12;
          if (this.puzzleState[i].growthTime >= 1) {
            this.puzzleState[i] = 'solved';
            this.solvedPuzzles++;
            this.showHint(`✦ ${p.label} — 藤蔓长成！`, 2);
            this.vines.push({ ...p, solvedTime: this.globalTime });
          }
        }
      }
    }

    // Check if all puzzles solved → can proceed
    if (this.solvedPuzzles >= this.totalPuzzles && this.currentScene !== 'BOSS') {
      this.showHint('所有谜题解开！继续前行 →', 3);
    }
  },

  toggleResonance() {
    if (this.state !== 'BOSS_FIGHT') return;
    if (this.player.playing) {
      this.player.playing = false;
      AudioEngine.stopAll();
      this.boss.resonanceStrength = 0;
    } else {
      this.player.playing = true;
      const pattern = this.boss.bossPatterns[this.boss.currentPattern];
      // Start sustained resonance at the pattern's root note
      AudioEngine.startResonance(pattern.notes[0], 0.4);
    }
  },

  // ═════════════════════════════════════════════════════
  // UPDATE LOOP
  // ═════════════════════════════════════════════════════
  update(dt) {
    this.globalTime += dt;
    this.shakeIntensity *= 0.9;
    this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;

    // Hint timer
    if (this.hintTimer > 0) this.hintTimer -= dt;

    // Transition
    if (this.transition.active) {
      if (this.transition.direction === 'out') {
        this.transition.alpha += dt * 2;
        if (this.transition.alpha >= 1) {
          this.transition.direction = 'in';
          this.loadScene(this.transition.targetScene);
        }
      } else {
        this.transition.alpha -= dt * 2;
        if (this.transition.alpha <= 0) {
          this.transition.active = false;
        }
      }
      return;
    }

    if (this.state === 'TITLE') {
      // Animate title particles
      for (const p of this.titleParticles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < 0) { p.y = this.H; p.x = Math.random() * this.W; }
        if (p.x < 0 || p.x > this.W) p.vx *= -1;
      }
      return;
    }

    if (this.state === 'TUTORIAL') {
      this.updateTutorial(dt);
      return;
    }

    if (this.state === 'VICTORY') {
      this.victoryTime += dt;
      return;
    }

    // Player movement (dt-scaled for stable speed across framerates)
    const p = this.player;
    const fs = dt * 60; // frame scale — normalize to 60fps feel
    let moveX = 0;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) moveX = -1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) moveX = 1;
    p.vx = moveX * p.speed;
    if (moveX !== 0) p.facing = moveX;
    if (moveX !== 0) p.walkFrame += dt * 8;

    // Jump (W/↑ for all states; Space only in PLAYING, not BOSS_FIGHT)
    const wantJump = (this.keys['ArrowUp'] || this.keys['KeyW']) ||
                     (this.keys['Space'] && this.state !== 'BOSS_FIGHT');
    if (wantJump && p.grounded) {
      p.vy = p.jumpSpeed;
      p.grounded = false;
    }

    // Gravity (dt-scaled)
    p.vy += 0.5 * fs;
    p.x += p.vx * fs;
    const prevY = p.y;
    p.y += p.vy * fs;

    // Platform collision — find the highest surface supporting the player
    // ALL comparisons in WORLD coordinates (no camera offset)
    const scene = Scenes[this.currentScene];
    p.grounded = false;
    const allSurfaces = []; // collect all walkable surfaces including solved bridges

    // Static platforms
    if (scene.platforms) {
      for (const plat of scene.platforms) {
        allSurfaces.push({
          left: plat.x,
          right: plat.x + plat.w,
          y: plat.y
        });
      }
    }

    // Solved bridges act as platforms (thick surface for reliable landing)
    if (scene.puzzles) {
      for (let i = 0; i < scene.puzzles.length; i++) {
        const pz = scene.puzzles[i];
        if (pz.type === 'bridge' && this.puzzleState[i] === 'solved') {
          allSurfaces.push({
            left: pz.gapX,
            right: pz.gapX + pz.gapWidth,
            y: pz.gapY
          });
        }
      }
    }

    // Find the best (highest) surface to stand on
    // Use crossing detection for fast falls + generous tolerance for standing/step-down
    let supportSurface = null;
    for (const surf of allSurfaces) {
      // Horizontal overlap check in WORLD coordinates (no cameraX)
      if (p.x + p.w/2 > surf.left && p.x - p.w/2 < surf.right) {
        const prevFeet = prevY + p.h;
        const currFeet = p.y + p.h;

        // Case 1: Crossing — was above surface, now passing through (catches fast falls)
        if (p.vy >= 0 && prevFeet <= surf.y + 6 && currFeet >= surf.y) {
          if (!supportSurface || surf.y < supportSurface.y) supportSurface = surf;
        }
        // Case 2: Standing or step-down — feet within tolerance of surface
        // Generous tolerance (35px) to handle step-downs and small bounces
        else if (p.vy >= 0 && currFeet >= surf.y - 5 && currFeet <= surf.y + 35) {
          if (!supportSurface || surf.y < supportSurface.y) supportSurface = surf;
        }
      }
    }

    if (supportSurface) {
      p.y = supportSurface.y - p.h;
      p.vy = 0;
      p.grounded = true;
    }

    // Stone wall collision — unsolved shatter puzzles block the path
    if (scene.puzzles) {
      for (let i = 0; i < scene.puzzles.length; i++) {
        const pz = scene.puzzles[i];
        if (pz.type === 'shatter' && pz.blocking && this.puzzleState[i] !== 'solved') {
          // Block is a solid rectangle from (pz.x - blockW/2) to (pz.x + blockW/2), from (pz.y - blockH) to (pz.y + blockH*0.2)
          const blockLeft = pz.x - pz.blockW / 2;
          const blockRight = pz.x + pz.blockW / 2;
          const blockTop = pz.y - pz.blockH * 0.6;
          const blockBottom = pz.y + pz.blockH * 0.3;

          // Check if player overlaps with the block
          const playerLeft = p.x - p.w / 2;
          const playerRight = p.x + p.w / 2;
          const playerTop = p.y;
          const playerBottom = p.y + p.h;

          if (playerRight > blockLeft && playerLeft < blockRight &&
              playerBottom > blockTop && playerTop < blockBottom) {
            // Push player out of the block — push to the side they came from
            if (p.vx > 0 || (prevY >= blockBottom)) {
              // Was moving right → push to left of block
              p.x = blockLeft - p.w / 2;
            } else if (p.vx < 0) {
              // Was moving left → push to right of block
              p.x = blockRight + p.w / 2;
            } else {
              // Standing still inside block → push to nearest side
              if (p.x < pz.x) {
                p.x = blockLeft - p.w / 2;
              } else {
                p.x = blockRight + p.w / 2;
              }
            }
          }
        }
      }
    }

    // Vine platforms (solved vines become climbable ladders) — world coordinates
    for (const v of this.vines) {
      const vx = v.x;  // world coordinate (no camera offset needed here)
      const vyStart = v.startY;
      const vyEnd = vyStart - v.length;
      if (Math.abs(p.x - vx) < 25 && p.y > vyEnd && p.y < vyStart) {
        // Can climb: pressing up moves up the vine
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
          p.vy = -3;
          p.grounded = false;
        }
        // Slow fall when on vine
        if (!this.keys['ArrowUp'] && !this.keys['KeyW']) {
          p.vy *= 0.5;
        }
      }
    }

    // Screen bounds — fell off screen, reset to start (on platform surface)
    if (p.y > this.H + 50) {
      p.x = scene.playerStart.x;
      p.y = scene.playerStart.y;
      p.vx = 0; p.vy = 0;
      this.cameraX = 0;
      this.cameraTargetX = 0;
      this.showHint('掉落了...重新开始', 2);
    }

    // Camera follow
    this.cameraTargetX = p.x - this.W * 0.3;
    if (this.cameraTargetX < 0) this.cameraTargetX = 0;
    this.cameraX += (this.cameraTargetX - this.cameraX) * 0.05;

    // Check exit (world coordinates — no cameraX)
    if (scene.exitX && p.x > scene.exitX - 50 && this.solvedPuzzles >= this.totalPuzzles) {
      this.nextScene();
    }

    // Sound wave decay
    this.soundWaves = this.soundWaves.filter(w => this.globalTime - w.birth < w.life);

    // Boss fight logic
    if (this.state === 'BOSS_FIGHT' && !this.boss.defeated) {
      this.updateBoss(dt);
    }

    // Cello tilt based on playing
    if (p.playing) {
      p.celloAngle = Math.sin(this.globalTime * 3) * 3 + p.bowDir * 5;
    } else {
      p.celloAngle *= 0.9;
    }
  },

  updateBoss(dt) {
    const b = this.boss;
    // Guardian hum
    b.guardianAlpha = 0.5 + Math.sin(this.globalTime * 0.5) * 0.3;

    if (this.player.playing && this.bow.active) {
      // Check if player's pitch matches any note in current pattern
      const pattern = Scenes.BOSS.bossPatterns[b.currentPattern];
      const pitch = this.player.currentPitch;
      for (const noteHz of pattern.notes) {
        if (Math.abs(pitch - noteHz) < 40) {
          if (!b.matchingNotes.includes(noteHz)) {
            b.matchingNotes.push(noteHz);
            this.emitSoundWave(this.player.x + 600, this.player.y, noteHz, 0.8);
          }
        }
      }

      // If all notes matched, pattern complete
      if (b.matchingNotes.length >= pattern.notes.length) {
        b.patternProgress += dt * 1.0;
        b.resonanceStrength = b.patternProgress;
        this.shakeIntensity = 3;

        if (b.patternProgress >= 1) {
          // Pattern defeated
          b.hp -= 25;
          b.currentPattern++;
          b.patternProgress = 0;
          b.matchingNotes = [];
          b.resonanceStrength = 0;
          this.showHint(`✦ 和声共鸣！守护者削弱 ${b.hp}%`, 2);
          this.shakeIntensity = 10;

          if (b.hp <= 0) {
            b.defeated = true;
            this.bossDefeated = true;
            this.showHint('✦ 守护者消散...森林苏醒！', 3);
            setTimeout(() => this.nextScene(), 3000);
          }
        }
      }
    } else {
      // Resonance decays when not playing
      b.matchingNotes = [];
      b.patternProgress *= 0.95;
      b.resonanceStrength *= 0.95;
    }
  },

  // ═════════════════════════════════════════════════════
  // RENDER LOOP
  // ═════════════════════════════════════════════════════
  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.W, this.H);

    // Apply shake
    ctx.translate(this.shakeX, this.shakeY);

    if (this.state === 'TITLE') {
      this.renderTitle(ctx);
    } else if (this.state === 'TUTORIAL') {
      this.renderTutorial(ctx);
    } else if (this.state === 'VICTORY') {
      this.renderVictory(ctx);
    } else {
      this.renderScene(ctx);
    }

    // Transition overlay
    if (this.transition.active) {
      ctx.fillStyle = `rgba(20, 15, 10, ${this.transition.alpha})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    // Noise texture overlay
    if (PaintFX.noiseData) {
      ctx.drawImage(PaintFX.noiseData, 0, 0, this.W, this.H);
    }

    ctx.restore();
  },

  // ═══════════════════════════════════════════════════════
  // TUTORIAL — Ghost Demo System
  // ═══════════════════════════════════════════════════════
  updateTutorial(dt) {
    const t = this.tutorial;
    t.stepTime += dt;

    const step = t.steps[t.step];
    if (!step) { this.startActualGame(); return; }

    // Advance step when duration is reached (or player did action for interactive steps)
    const interactive = step.action !== 'ready';
    if (t.stepTime >= step.duration) {
      // Auto-advance
      t.step++;
      t.stepTime = 0;
      t.playerDidAction = false;
      t.waitForPlayer = false;
      t.ghostPlaying = false;
      t.ghostBowDir = 0;
      AudioEngine.stopAll();
      return;
    }

    // Animate ghost based on step action
    switch (step.action) {
      case 'walk':
        // Ghost walks back and forth
        const walkPhase = t.stepTime / step.duration;
        const walkCycle = Math.sin(walkPhase * Math.PI * 4); // 4 back-and-forth cycles
        t.ghostX = 200 + walkCycle * 120;
        t.ghostFacing = walkCycle > 0 ? 1 : -1;
        t.ghostWalkFrame += dt * 8;
        break;

      case 'bow':
        // Ghost bows: starts after 0.5s
        if (t.stepTime > 0.5) {
          t.ghostPlaying = true;
          t.ghostBowDir = Math.sin(t.stepTime * 3) > 0 ? 1 : -1;
          t.ghostPitch = 196;
          t.ghostPressure = 0.5;

          // Mouse ghost trail for bow visual
          const bowPhase = (t.stepTime - 0.5) / 4;
          const bowCX = this.W / 2;
          const bowCY = this.H / 2;
          const bowMoveX = bowCX + Math.sin(bowPhase * Math.PI * 6) * 80;
          t.mouseGhostX = bowMoveX;
          t.mouseGhostY = bowCY;
          t.mouseGhostTrail.push({x: bowMoveX, y: bowCY, time: this.globalTime});
          // Keep trail limited
          t.mouseGhostTrail = t.mouseGhostTrail.filter(p => this.globalTime - p.time < 0.5);

          // Emit sound waves periodically
          if (Math.sin(t.stepTime * 4) > 0.8) {
            t.soundWaves.push({
              x: t.ghostX, y: t.ghostY, pitch: t.ghostPitch, pressure: t.ghostPressure,
              birth: this.globalTime, life: 1.5
            });
            AudioEngine.playNote(t.ghostPitch, 0.3, 300, t.ghostPressure);
          }
        } else {
          t.ghostPlaying = false;
        }
        break;

      case 'pitch':
        // Ghost demonstrates different pitches
        t.ghostPlaying = true;
        t.ghostBowDir = Math.sin(t.stepTime * 3) > 0 ? 1 : -1;

        // Pitch changes over time based on ghostPitchY in step data
        const pitchYs = step.ghostPitchY || [];
        let currentY = 0.4; // default
        for (const py of pitchYs) {
          if (t.stepTime >= py.time) currentY = py.y;
        }
        t.ghostPitch = AudioEngine.mouseYToPitch(currentY);
        t.ghostPressure = 0.4;

        // Mouse ghost at different Y positions
        t.mouseGhostX = this.W / 2 + Math.sin(t.stepTime * 2) * 40;
        t.mouseGhostY = currentY * this.H;
        t.mouseGhostTrail.push({x: t.mouseGhostX, y: t.mouseGhostY, time: this.globalTime});
        t.mouseGhostTrail = t.mouseGhostTrail.filter(p => this.globalTime - p.time < 0.3);

        // Emit sound waves
        if (Math.sin(t.stepTime * 5) > 0.7) {
          t.soundWaves.push({
            x: t.ghostX, y: t.ghostY, pitch: t.ghostPitch, pressure: t.ghostPressure,
            birth: this.globalTime, life: 1.5
          });
          AudioEngine.playNote(t.ghostPitch, 0.25, 250, t.ghostPressure);
        }
        break;

      case 'pressure':
        // Ghost demonstrates heavy and light bow pressure
        t.ghostPlaying = true;
        t.ghostBowDir = Math.sin(t.stepTime * 2.5) > 0 ? 1 : -1;
        t.ghostPitch = 130;

        const pressures = step.ghostPressures || [];
        let currentPressure = 0.5;
        let pressureText = '';
        for (const pp of pressures) {
          if (t.stepTime >= pp.time) {
            currentPressure = pp.pressure;
            pressureText = pp.text || '';
          }
        }
        t.ghostPressure = currentPressure;
        t.currentPressureText = pressureText;

        // Mouse ghost: fast/slow movement for heavy/light pressure
        const speedFactor = currentPressure > 0.5 ? 3 : 0.5;
        t.mouseGhostX = this.W / 2 + Math.sin(t.stepTime * speedFactor * 2) * 60;
        t.mouseGhostY = currentPressure > 0.5 ? this.H * 0.7 : this.H * 0.4;
        t.mouseGhostTrail.push({x: t.mouseGhostX, y: t.mouseGhostY, time: this.globalTime});
        t.mouseGhostTrail = t.mouseGhostTrail.filter(p => this.globalTime - p.time < 0.3);

        // Emit sound waves
        if (Math.sin(t.stepTime * 4) > 0.6) {
          t.soundWaves.push({
            x: t.ghostX, y: t.ghostY, pitch: t.ghostPitch, pressure: t.ghostPressure,
            birth: this.globalTime, life: 1.5
          });
          AudioEngine.playNote(t.ghostPitch, 0.2 + currentPressure * 0.3, 250, currentPressure);
        }

        // Screen shake for heavy pressure demo
        if (currentPressure > 0.7 && Math.sin(t.stepTime * 6) > 0.8) {
          this.shakeIntensity = 2;
        }
        break;

      case 'ready':
        t.ghostPlaying = false;
        AudioEngine.stopAll();
        break;
    }

    // Decay sound waves
    t.soundWaves = t.soundWaves.filter(w => this.globalTime - w.birth < w.life);

    // Shake decay
    this.shakeIntensity *= 0.9;
    this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
  },

  renderTutorial(ctx) {
    const t = this.tutorial;
    const step = t.steps[t.step];

    // Same dark forest background as title
    const grad = ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#1a1520');
    grad.addColorStop(0.5, '#2a2530');
    grad.addColorStop(1, '#0f0e12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Background trees (reuse title trees but simpler)
    ctx.save();
    for (let i = 0; i < 10; i++) {
      const tx = i * this.W / 9;
      PaintFX.drawTree(ctx, tx, this.H - 50, 180 + i * 15, '#2a2530', '#1a2a1a', 0.5);
    }
    ctx.restore();

    // A simple platform for the demo
    ctx.fillStyle = '#3a4a3a';
    ctx.fillRect(0, 400, this.W, this.H - 400);
    ctx.fillStyle = '#4a5a4a';
    ctx.fillRect(0, 400, this.W, 8);

    // Mist
    PaintFX.drawMist(ctx, this.W, this.H, 0.25);

    // Sound waves from ghost
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);
    for (const w of t.soundWaves) {
      const age = this.globalTime - w.birth;
      if (age < w.life) {
        PaintFX.drawSoundRibbons(ctx, w.x, w.y, w.pitch, w.pressure, age);
      }
    }
    ctx.restore();

    // ═══ Ghost Player (semi-transparent) ═══
    this.renderGhostPlayer(ctx, t);

    // ═══ Ghost Mouse Cursor ═══
    if (step.action === 'bow' || step.action === 'pitch' || step.action === 'pressure') {
      this.renderGhostMouse(ctx, t, step);
    }

    // ═══ Key Indicators ═══
    if (step.action === 'walk') {
      this.renderKeyIndicator(ctx, 'A / D', t.stepTime);
    }

    // ═══ Step Text ═══
    ctx.save();
    ctx.textAlign = 'center';

    // Step number
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#6a6a8a';
    ctx.fillText(`引导 ${t.step + 1}/${t.steps.length}`, this.W / 2, 30);

    // Progress bar
    const barW = 200;
    const barX = this.W / 2 - barW / 2;
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(barX, 42, barW, 6);
    ctx.fillStyle = '#d4a855';
    ctx.fillRect(barX, 42, barW * (t.stepTime / step.duration), 6);

    // Main instruction text
    ctx.font = 'bold 22px sans-serif';
    ctx.shadowColor = 'rgba(180, 130, 60, 0.4)';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#d4a855';
    const lines = step.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], this.W / 2, this.H * 0.15 + i * 30);
    }
    ctx.shadowBlur = 0;

    // Pressure annotation text
    if (step.action === 'pressure' && t.currentPressureText) {
      ctx.font = 'bold 18px sans-serif';
      const hue = t.ghostPressure > 0.5 ? 0 : 120; // red for heavy, green for light
      ctx.fillStyle = `hsl(${hue}, 70%, 65%)`;
      ctx.fillText(t.currentPressureText, this.W / 2, this.H * 0.22 + 40);
    }

    // Pitch color indicator
    if (step.action === 'pitch') {
      const hue = 30 + (t.ghostPitch - 65) / (440 - 65) * 200;
      const noteName = AudioEngine.getClosestNoteName(t.ghostPitch);
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = `hsl(${hue}, 70%, 65%)`;
      ctx.fillText(`${noteName}`, this.W / 2, this.H * 0.22 + 40);

      // Pitch scale visualization
      const scaleX = this.W / 2 - 100;
      const scaleY = this.H * 0.55;
      const scaleH = this.H * 0.3;
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(scaleX, scaleY, 20, scaleH);
      // Gradient fill showing pitch→color mapping
      for (let py = 0; py < scaleH; py++) {
        const yNorm = py / scaleH;
        const pH = 30 + (1 - yNorm) * 200;
        ctx.fillStyle = `hsla(${pH}, 70%, 55%, 0.5)`;
        ctx.fillRect(scaleX, scaleY + py, 20, 1);
      }
      // Current pitch marker
      const markerY = scaleY + scaleH * (1 - (t.ghostPitch - 65) / (440 - 65));
      ctx.fillStyle = '#d4a855';
      ctx.fillRect(scaleX - 5, markerY - 3, 30, 6);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#8a8a9a';
      ctx.textAlign = 'left';
      ctx.fillText('高音', scaleX + 25, scaleY + 5);
      ctx.fillText('低音', scaleX + 25, scaleY + scaleH - 5);
      ctx.textAlign = 'center';
    }

    // Skip hint
    const skipPulse = 0.4 + Math.sin(this.globalTime * 2) * 0.3;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = `rgba(212, 168, 85, ${skipPulse})`;
    ctx.fillText('点击 / Space 直接开始游戏', this.W / 2, this.H - 25);

    ctx.restore();
  },

  renderGhostPlayer(ctx, t) {
    ctx.save();
    ctx.globalAlpha = t.ghostAlpha;
    ctx.translate(t.ghostX, t.ghostY);
    const s = t.ghostFacing;

    // Glow outline to make ghost distinctive
    ctx.strokeStyle = 'rgba(212, 168, 85, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, t.ghostPlayerH * 0.35, 14, 22, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 52, 15, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fill();

    const walkBob = Math.sin(t.ghostWalkFrame) * 2;
    const legSwing = Math.sin(t.ghostWalkFrame) * 8;

    // Legs
    ctx.strokeStyle = '#4a4a5a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-4, 25 + walkBob); ctx.lineTo(-6 + legSwing * s, 50); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 25 + walkBob); ctx.lineTo(6 - legSwing * s, 50); ctx.stroke();

    // Torso
    ctx.fillStyle = '#5a6a7a';
    ctx.beginPath(); ctx.ellipse(0, 17 + walkBob, 10, 18, 0, 0, Math.PI * 2); ctx.fill();

    // Cloak
    ctx.fillStyle = '#4a5a6a';
    ctx.beginPath();
    ctx.moveTo(s * -8, 10 + walkBob);
    ctx.bezierCurveTo(s * -15, 20 + walkBob, s * -20, 30 + walkBob, s * -18, 35 + walkBob);
    ctx.lineTo(s * -5, 25 + walkBob);
    ctx.closePath(); ctx.fill();

    // Head
    ctx.beginPath(); ctx.arc(0, 7 + walkBob, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#6a7a7a'; ctx.fill();

    // Cello
    ctx.save();
    ctx.translate(s * -12, 5 + walkBob);
    ctx.rotate(s * -0.15 + (t.ghostPlaying ? Math.sin(this.globalTime * 3) * 0.02 : 0));

    ctx.fillStyle = '#8a6a40';
    ctx.beginPath(); ctx.ellipse(0, -25, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 25, 15, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5a30';
    ctx.fillRect(-3, -45, 6, 20);

    // Strings
    ctx.strokeStyle = '#b0b0b0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(-3 + i * 1.5, -45); ctx.lineTo(-6 + i * 3, 35); ctx.stroke();
    }

    // Bow (if playing)
    if (t.ghostPlaying) {
      const bowOff = Math.sin(this.globalTime * 4) * 8 * t.ghostBowDir;
      ctx.strokeStyle = '#9a7a4a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-25 + bowOff, 0); ctx.lineTo(25 + bowOff, 0); ctx.stroke();
      ctx.strokeStyle = '#d0d0d0';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(-25 + bowOff, 1); ctx.lineTo(25 + bowOff, 1); ctx.stroke();

      // Sound glow
      const hue = 30 + (t.ghostPitch - 65) / (440 - 65) * 200;
      const glowGrad = ctx.createRadialGradient(0, 15, 5, 0, 15, 35);
      glowGrad.addColorStop(0, `hsla(${hue}, 80%, 70%, 0.4)`);
      glowGrad.addColorStop(1, `hsla(${hue}, 80%, 70%, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.fillRect(-35, -10, 70, 50);
    }

    ctx.restore(); // cello
    ctx.globalAlpha = 1;
    ctx.restore(); // ghost
  },

  renderGhostMouse(ctx, t, step) {
    ctx.save();
    const mx = t.mouseGhostX;
    const my = t.mouseGhostY;

    // Trail
    ctx.strokeStyle = 'rgba(212, 168, 85, 0.15)';
    ctx.lineWidth = 2;
    if (t.mouseGhostTrail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(t.mouseGhostTrail[0].x, t.mouseGhostTrail[0].y);
      for (let i = 1; i < t.mouseGhostTrail.length; i++) {
        ctx.lineTo(t.mouseGhostTrail[i].x, t.mouseGhostTrail[i].y);
      }
      ctx.stroke();
    }

    // Ghost cursor
    ctx.globalAlpha = 0.6 + Math.sin(this.globalTime * 3) * 0.15;
    // Cursor arrow shape
    ctx.fillStyle = '#d4a855';
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + 12, my + 16);
    ctx.lineTo(mx + 4, my + 14);
    ctx.lineTo(mx + 2, my + 22);
    ctx.lineTo(mx - 2, my + 22);
    ctx.lineTo(mx, my + 14);
    ctx.lineTo(mx - 4, my + 16);
    ctx.closePath();
    ctx.fill();

    // Drag indicator (arrows showing bow direction)
    if (t.ghostPlaying) {
      const dragDir = t.ghostBowDir;
      const arrowX = mx + dragDir * 30;
      const arrowY = my;
      ctx.strokeStyle = `rgba(212, 168, 85, ${0.3 + Math.sin(this.globalTime * 4) * 0.2})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(arrowX, arrowY);
      ctx.stroke();
      // Arrow head
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - dragDir * 8, arrowY - 6);
      ctx.lineTo(arrowX - dragDir * 8, arrowY + 6);
      ctx.closePath();
      ctx.fillStyle = `rgba(212, 168, 85, ${0.4 + Math.sin(this.globalTime * 4) * 0.2})`;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  },

  renderKeyIndicator(ctx, keyLabel, time) {
    ctx.save();
    ctx.textAlign = 'center';

    const pulse = 0.6 + Math.sin(time * 4) * 0.3;
    const cx = this.W / 2;
    const cy = this.H * 0.65;

    // Key shape background
    ctx.fillStyle = `rgba(60, 50, 40, ${pulse})`;
    ctx.strokeStyle = `rgba(212, 168, 85, ${pulse})`;
    ctx.lineWidth = 2;

    // Two key shapes (A and D)
    const keyW = 50, keyH = 40, keyGap = 10;
    // A key
    this.drawKeyShape(ctx, cx - keyW - keyGap/2, cy, keyW, keyH, 'A', pulse);
    // D key
    this.drawKeyShape(ctx, cx + keyGap/2, cy, keyW, keyH, 'D', pulse);

    // Arrows between keys
    const arrowPulse = Math.sin(time * 6) * 10;
    ctx.strokeStyle = `rgba(212, 168, 85, ${pulse * 0.6})`;
    ctx.lineWidth = 2;
    // Left arrow
    ctx.beginPath();
    ctx.moveTo(cx - keyW - keyGap/2 - 5 + arrowPulse, cy + keyH/2);
    ctx.lineTo(cx - keyW - keyGap/2 - 20 + arrowPulse, cy + keyH/2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - keyW - keyGap/2 - 20 + arrowPulse, cy + keyH/2);
    ctx.lineTo(cx - keyW - keyGap/2 - 14 + arrowPulse, cy + keyH/2 - 6);
    ctx.lineTo(cx - keyW - keyGap/2 - 14 + arrowPulse, cy + keyH/2 + 6);
    ctx.closePath();
    ctx.fillStyle = `rgba(212, 168, 85, ${pulse * 0.4})`;
    ctx.fill();
    // Right arrow
    ctx.beginPath();
    ctx.moveTo(cx + keyGap/2 + keyW + 5 - arrowPulse, cy + keyH/2);
    ctx.lineTo(cx + keyGap/2 + keyW + 20 - arrowPulse, cy + keyH/2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + keyGap/2 + keyW + 20 - arrowPulse, cy + keyH/2);
    ctx.lineTo(cx + keyGap/2 + keyW + 14 - arrowPulse, cy + keyH/2 - 6);
    ctx.lineTo(cx + keyGap/2 + keyW + 14 - arrowPulse, cy + keyH/2 + 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  },

  drawKeyShape(ctx, x, y, w, h, label, pulse) {
    // Rounded rectangle key
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = `rgba(60, 50, 40, ${pulse})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(212, 168, 85, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Key label
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = `rgba(212, 168, 85, ${pulse})`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w/2, y + h/2 + 5);
  },

  renderTitle(ctx) {
    // Dark forest background
    const grad = ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#1a1520');
    grad.addColorStop(0.5, '#2a2530');
    grad.addColorStop(1, '#0f0e12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Background trees (silhouettes)
    ctx.save();
    for (let i = 0; i < 15; i++) {
      const tx = i * this.W / 14;
      const th = 150 + Math.random() * 200;
      PaintFX.drawTree(ctx, tx, this.H - 50, th, '#1a1a1a', '#0f1a0f', 0.8);
    }
    ctx.restore();

    // Floating particles
    for (const p of this.titleParticles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.alpha})`;
      ctx.fill();
    }

    // Title text
    ctx.save();
    ctx.textAlign = 'center';

    // Main title with glow
    ctx.font = 'bold 72px "Georgia", serif';
    ctx.shadowColor = 'rgba(180, 130, 60, 0.5)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#d4a855';
    ctx.fillText('弦境回响', this.W/2, this.H * 0.3);

    ctx.font = '28px "Georgia", serif';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#a08050';
    ctx.fillText('Cello Resonance', this.W/2, this.H * 0.3 + 50);

    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#8a8a9a';
    const lines = Scenes.TITLE.desc.split('\n');
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], this.W/2, this.H * 0.55 + i * 28);
    }

    // Start prompt
    const pulse = 0.5 + Math.sin(this.globalTime * 2) * 0.3;
    ctx.font = '20px sans-serif';
    ctx.fillStyle = `rgba(200, 180, 140, ${pulse})`;
    ctx.fillText('点击或按 Space 开始', this.W/2, this.H * 0.78);

    // Cello silhouette icon
    this.drawCelloIcon(ctx, this.W/2, this.H * 0.45, 80);

    ctx.restore();
  },

  drawCelloIcon(ctx, cx, cy, size) {
    ctx.save();
    ctx.strokeStyle = '#6a5a40';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;

    // Simple cello outline
    const s = size;
    ctx.beginPath();
    // Upper bout
    ctx.ellipse(cx, cy - s * 0.3, s * 0.25, s * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    // C-bout (waist)
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.15, cy - s * 0.15);
    ctx.bezierCurveTo(cx - s * 0.1, cy, cx - s * 0.1, cy, cx - s * 0.2, cy + s * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.15, cy - s * 0.15);
    ctx.bezierCurveTo(cx + s * 0.1, cy, cx + s * 0.1, cy, cx + s * 0.2, cy + s * 0.15);
    ctx.stroke();
    // Lower bout
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.3, s * 0.3, s * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Neck
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - s * 0.5);
    ctx.lineTo(cx - 3, cy - s * 0.3);
    ctx.moveTo(cx + 3, cy - s * 0.5);
    ctx.lineTo(cx + 3, cy - s * 0.3);
    ctx.stroke();
    // Scroll
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.55, 6, 0, Math.PI * 1.5);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.restore();
  },

  renderScene(ctx) {
    const scene = Scenes[this.currentScene];

    // Background gradient (different per scene)
    let bgColors;
    if (this.currentScene === 'BRIDGE') bgColors = ['#1a2530', '#2a3540', '#152025'];
    else if (this.currentScene === 'RUINS') bgColors = ['#1a1a20', '#252530', '#0f1215'];
    else if (this.currentScene === 'BOSS') bgColors = ['#0a0a10', '#151520', '#050508'];
    else bgColors = ['#1a2530', '#2a3540', '#152025'];

    const grad = ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, bgColors[0]);
    grad.addColorStop(0.5, bgColors[1]);
    grad.addColorStop(1, bgColors[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Stars / ambient particles
    for (let i = 0; i < 20; i++) {
      const sx = (i * 137.5 + this.globalTime * 10) % this.W;
      const sy = Math.random() * this.H * 0.4;
      const sa = 0.2 + Math.sin(this.globalTime + i) * 0.15;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 200, 220, ${sa})`;
      ctx.fill();
    }

    // Background trees
    ctx.save();
    const treeCount = 20;
    for (let i = 0; i < treeCount; i++) {
      const tx = (i * this.W / treeCount) - this.cameraX * 0.3;
      const th = 200 + (i % 3) * 80;
      PaintFX.drawTree(ctx, tx, this.H - 60, th, '#2a2530', '#1a2a1a', 0.4);
    }
    ctx.restore();

    // Mid-ground trees (closer, affected by camera more)
    ctx.save();
    for (let i = 0; i < 10; i++) {
      const tx = (i * this.W / 8) - this.cameraX * 0.6;
      const th = 250 + (i % 5) * 60;
      PaintFX.drawTree(ctx, tx, this.H - 50, th, '#3a3540', '#2a3a2a', 0.3);
    }
    ctx.restore();

    // Mist
    PaintFX.drawMist(ctx, this.W, this.H, this.ambientMist);

    // Platforms
    ctx.save();
    ctx.translate(-this.cameraX, 0);
    if (scene.platforms) {
      for (const plat of scene.platforms) {
        // Stone/moss platform
        ctx.fillStyle = '#3a4a3a';
        ctx.fillRect(plat.x, plat.y, plat.w, this.H - plat.y);
        // Moss on top
        ctx.fillStyle = '#4a5a4a';
        ctx.fillRect(plat.x, plat.y, plat.w, 8);
        // Edge highlight
        ctx.fillStyle = '#5a6a5a';
        ctx.fillRect(plat.x, plat.y, plat.w, 3);
      }
    }
    ctx.restore();

    // Puzzle elements
    ctx.save();
    ctx.translate(-this.cameraX, 0);

    if (scene.puzzles) {
      for (let i = 0; i < scene.puzzles.length; i++) {
        const pz = scene.puzzles[i];
        const state = this.puzzleState[i];

        if (pz.type === 'bridge') {
          // Show gap indicator
          const gapAlpha = state === 'solved' ? 0 : 0.4;
          if (gapAlpha > 0) {
            ctx.fillStyle = `rgba(20, 10, 5, ${gapAlpha})`;
            ctx.fillRect(pz.gapX, pz.gapY + 10, pz.gapWidth, this.H - pz.gapY);
            // Hint label
            ctx.font = '12px sans-serif';
            ctx.fillStyle = `rgba(180, 160, 100, 0.6)`;
            ctx.fillText(pz.label, pz.gapX + pz.gapWidth/2 - 40, pz.gapY - 10);
          }

          // Active bridge being formed
          if (state && state !== 'solved' && state.strength > 0) {
            PaintFX.drawLightBridge(ctx, pz.gapX, pz.gapY, pz.gapX + pz.gapWidth, pz.gapY, pz.hue, state.strength, this.globalTime);
          }

          // Solved bridge — thick solid surface
          if (state === 'solved') {
            PaintFX.drawLightBridge(ctx, pz.gapX, pz.gapY, pz.gapX + pz.gapWidth, pz.gapY, pz.hue, 1, this.globalTime);
            // Solid walkable surface — thick enough to be clearly visible and landable
            ctx.fillStyle = `hsla(${pz.hue}, 70%, 60%, 0.35)`;
            ctx.fillRect(pz.gapX, pz.gapY - 4, pz.gapWidth, 8);
            // Bright edge line on top
            ctx.fillStyle = `hsla(${pz.hue}, 90%, 80%, 0.5)`;
            ctx.fillRect(pz.gapX, pz.gapY - 4, pz.gapWidth, 2);
          }
        }

        if (pz.type === 'shatter') {
          const groundY = pz.y + pz.radius; // ground level at base of rock
          if (state === 'solved') {
            // Shattered: show rubble remains on the ground
            const shatterObj = this.shatters.find(s => s.x === pz.x);
            const age = this.globalTime - (shatterObj?.solvedTime || this.globalTime);
            // Brief shatter animation, then permanent rubble
            if (age < 2) {
              PaintFX.drawRockShatter(ctx, pz.x, pz.y, pz.radius, Math.min(1, age * 0.5 + 0.8));
            }
            // Always show rubble remains (permanent ground decal)
            PaintFX.drawRockRubble(ctx, pz.x, groundY, pz.radius, age);
          } else if (state && state.progress > 0) {
            // Cracking rock with progress
            PaintFX.drawStoneWall(ctx, pz.x, pz.y, pz.radius, pz.label, this.globalTime);
            // Show crack overlay
            PaintFX.drawRockShatter(ctx, pz.x, pz.y, pz.radius, state.progress);
          } else {
            // Intact stone wall — highly visible
            PaintFX.drawStoneWall(ctx, pz.x, pz.y, pz.radius, pz.label, this.globalTime);
            // If blocking, show extra wall body to make it clearly impassable
            if (pz.blocking) {
              const bw = pz.blockW || pz.radius * 1.5;
              const bh = pz.blockH || pz.radius * 2;
              ctx.fillStyle = '#5a4a3a';
              ctx.fillRect(pz.x - bw/2, pz.y - bh * 0.5, bw, bh);
              // Warning stripes on blocking wall
              ctx.strokeStyle = `rgba(200, 80, 50, ${0.3 + Math.sin(this.globalTime * 3) * 0.15})`;
              ctx.lineWidth = 2;
              ctx.strokeRect(pz.x - bw/2, pz.y - bh * 0.5, bw, bh);
              // "BLOCKED" visual hint
              ctx.fillStyle = 'rgba(200, 100, 80, 0.5)';
              ctx.fillRect(pz.x - bw/2 + 3, pz.y - bh * 0.5 + 3, bw - 6, 3);
            }
          }
        }

        if (pz.type === 'vine') {
          if (state === 'solved') {
            const vineObj = this.vines.find(v => v.x === pz.x);
            const age = this.globalTime - (vineObj?.solvedTime || this.globalTime);
            PaintFX.drawVine(ctx, pz.x, pz.startY, pz.length, age + 2, pz.hue);
          } else if (state && state.growthTime > 0) {
            PaintFX.drawVine(ctx, pz.x, pz.startY, pz.length, state.growthTime, pz.hue);
            // Label
            ctx.font = '12px sans-serif';
            ctx.fillStyle = `hsla(${pz.hue}, 70%, 70%, 0.5)`;
            ctx.fillText(pz.label, pz.x - 20, pz.startY + 20);
          } else {
            // Seed point
            ctx.beginPath();
            ctx.arc(pz.x, pz.startY, 5, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${pz.hue}, 60%, 40%, 0.5)`;
            ctx.fill();
            ctx.font = '12px sans-serif';
            ctx.fillStyle = `hsla(${pz.hue}, 70%, 70%, 0.4)`;
            ctx.fillText(pz.label, pz.x - 20, pz.startY + 20);
          }
        }

      }
    }

    ctx.restore();

    // Sound waves
    ctx.save();
    for (const w of this.soundWaves) {
      const age = this.globalTime - w.birth;
      if (age < w.life) {
        PaintFX.drawSoundRibbons(ctx, w.x - this.cameraX, w.y, w.pitch, w.pressure, age);
      }
    }
    ctx.restore();

    // Player (Explorer with Cello)
    this.renderPlayer(ctx);

    // Boss guardian
    if (this.state === 'BOSS_FIGHT') {
      this.renderBoss(ctx);
    }

    // HUD
    this.renderHUD(ctx);
  },

  renderPlayer(ctx) {
    const p = this.player;
    const sx = p.x - this.cameraX;
    const sy = p.y;
    const s = p.facing;

    ctx.save();
    ctx.translate(sx, sy);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, p.h + 2, 15, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    // Body (simple figure)
    const walkBob = p.grounded ? Math.sin(p.walkFrame) * 2 : 0;
    const bodyY = walkBob;

    // Legs
    const legSwing = Math.sin(p.walkFrame) * 8;
    ctx.strokeStyle = '#3a3a4a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-4, p.h * 0.5 + bodyY);
    ctx.lineTo(-6 + legSwing * s, p.h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, p.h * 0.5 + bodyY);
    ctx.lineTo(6 - legSwing * s, p.h);
    ctx.stroke();

    // Torso
    ctx.fillStyle = '#4a5560';
    ctx.beginPath();
    ctx.ellipse(0, p.h * 0.35 + bodyY, 10, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cloak/cape
    ctx.fillStyle = '#3a4050';
    ctx.beginPath();
    ctx.moveTo(s * -8, p.h * 0.2 + bodyY);
    ctx.bezierCurveTo(s * -15, p.h * 0.4 + bodyY, s * -20, p.h * 0.6 + bodyY, s * -18, p.h * 0.7 + bodyY);
    ctx.lineTo(s * -5, p.h * 0.5 + bodyY);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(0, p.h * 0.15 + bodyY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#5a6a6a';
    ctx.fill();

    // Cello (held on left side)
    ctx.save();
    ctx.translate(s * -12, p.h * 0.1 + bodyY);
    ctx.rotate(s * -0.15 + p.celloAngle * 0.02);

    // Cello body
    ctx.fillStyle = '#7a5a30';
    // Upper bout
    ctx.beginPath();
    ctx.ellipse(0, -25, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lower bout
    ctx.beginPath();
    ctx.ellipse(0, 25, 15, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Waist
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.bezierCurveTo(-5, 0, -5, 0, -10, 8);
    ctx.lineTo(-5, 8);
    ctx.lineTo(-5, -8);
    ctx.closePath();
    ctx.fillStyle = '#6a4a20';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -8);
    ctx.bezierCurveTo(5, 0, 5, 0, 10, 8);
    ctx.lineTo(5, 8);
    ctx.lineTo(5, -8);
    ctx.closePath();
    ctx.fill();
    // Neck
    ctx.fillStyle = '#5a4020';
    ctx.fillRect(-3, -45, 6, 20);
    // Scroll
    ctx.beginPath();
    ctx.arc(0, -48, 4, 0, Math.PI * 1.5);
    ctx.strokeStyle = '#5a4020';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Strings
    ctx.strokeStyle = '#a0a0a0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-3 + i * 1.5, -45);
      ctx.lineTo(-6 + i * 3, 35);
      ctx.stroke();
    }

    // If playing, show bow
    if (p.playing) {
      const bowOffset = Math.sin(this.globalTime * 4) * 8 * p.bowDir;
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-25 + bowOffset, 0);
      ctx.lineTo(25 + bowOffset, 0);
      ctx.stroke();
      // Bow hair
      ctx.strokeStyle = '#c0c0c0';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-25 + bowOffset, 1);
      ctx.lineTo(25 + bowOffset, 1);
      ctx.stroke();
    }

    // Sound glow when playing
    if (p.playing) {
      const glowGrad = ctx.createRadialGradient(0, 15, 5, 0, 15, 35);
      const hue = 30 + (p.currentPitch - 65) / (440 - 65) * 200;
      glowGrad.addColorStop(0, `hsla(${hue}, 80%, 70%, 0.3)`);
      glowGrad.addColorStop(1, `hsla(${hue}, 80%, 70%, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.fillRect(-35, -10, 70, 50);
    }

    ctx.restore(); // cello transform
    ctx.restore(); // player transform
  },

  renderBoss(ctx) {
    const b = this.boss;
    const gx = b.guardianX - this.cameraX;
    const gy = b.guardianY;

    ctx.save();

    // Guardian glow
    const guardianSize = 80 + Math.sin(this.globalTime * 0.3) * 20;
    const grad = ctx.createRadialGradient(gx, gy + 100, 0, gx, gy + 100, guardianSize * 2);
    const baseAlpha = b.guardianAlpha * (b.defeated ? 0.2 : 1);
    grad.addColorStop(0, `rgba(60, 40, 100, ${baseAlpha * 0.5})`);
    grad.addColorStop(0.5, `rgba(40, 20, 80, ${baseAlpha * 0.3})`);
    grad.addColorStop(1, 'rgba(20, 10, 40, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(gx - guardianSize * 2, gy + 100 - guardianSize * 2, guardianSize * 4, guardianSize * 4);

    // Guardian body (spectral tree-like form)
    ctx.globalAlpha = baseAlpha;
    // Trunk
    ctx.strokeStyle = '#4a3a6a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(gx, gy + 100 + 80);
    ctx.bezierCurveTo(gx - 20, gy + 100, gx + 20, gy + 50, gx, gy + 30);
    ctx.stroke();

    // Branches
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI - Math.PI / 2;
      const bLen = 40 + Math.sin(this.globalTime + i) * 15;
      ctx.beginPath();
      ctx.moveTo(gx, gy + 40);
      ctx.lineTo(gx + Math.cos(angle) * bLen, gy + 40 + Math.sin(angle) * bLen);
      ctx.strokeStyle = `rgba(80, 60, 120, ${0.5 + Math.sin(this.globalTime + i) * 0.2})`;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Leaves (glowing orbs)
      const lx = gx + Math.cos(angle) * bLen;
      const ly = gy + 40 + Math.sin(angle) * bLen;
      ctx.beginPath();
      ctx.arc(lx, ly, 8 + Math.sin(this.globalTime * 2 + i) * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 80, 150, 0.4)`;
      ctx.fill();
    }

    // Eyes
    ctx.beginPath();
    ctx.arc(gx - 12, gy + 25, 5, 0, Math.PI * 2);
    ctx.arc(gx + 12, gy + 25, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200, 180, 255, ${0.5 + Math.sin(this.globalTime * 3) * 0.3})`;
    ctx.fill();

    // Constant hum visualization
    if (!b.defeated) {
      for (let r = 0; r < 3; r++) {
        const humRadius = 60 + r * 30 + Math.sin(this.globalTime * 2 + r) * 10;
        ctx.beginPath();
        ctx.arc(gx, gy + 60, humRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100, 80, 150, ${0.15 - r * 0.03})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Resonance overlay when matching
    if (b.resonanceStrength > 0) {
      const rGrad = ctx.createRadialGradient(gx, gy + 60, 0, gx, gy + 60, 100);
      rGrad.addColorStop(0, `rgba(220, 180, 100, ${b.resonanceStrength * 0.4})`);
      rGrad.addColorStop(1, 'rgba(220, 180, 100, 0)');
      ctx.fillStyle = rGrad;
      ctx.fillRect(gx - 100, gy - 40, 200, 200);
    }

    ctx.globalAlpha = 1;
    ctx.restore();

    // Boss HUD (pattern info)
    if (!b.defeated) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#8a7aaa';
      ctx.fillText('守护者', this.W / 2, 30);

      // Current pattern
      const pattern = Scenes.BOSS.bossPatterns[b.currentPattern];
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#6a5a8a';
      ctx.fillText(`需要: ${pattern.label}`, this.W / 2, 55);

      // HP bar
      ctx.fillStyle = '#3a2a4a';
      ctx.fillRect(this.W / 2 - 100, 70, 200, 10);
      ctx.fillStyle = '#8a6aaa';
      ctx.fillRect(this.W / 2 - 100, 70, b.hp * 2, 10);

      // Matched notes indicators
      ctx.font = '14px sans-serif';
      for (let i = 0; i < pattern.notes.length; i++) {
        const matched = b.matchingNotes.includes(pattern.notes[i]);
        ctx.fillStyle = matched ? '#d4a855' : '#5a4a6a';
        ctx.fillText(matched ? '✦' : '○', this.W / 2 - 30 + i * 30, 95);
      }

      // Resonance instruction
      if (b.resonanceStrength > 0) {
        ctx.font = '16px sans-serif';
        ctx.fillStyle = `rgba(220, 180, 100, ${0.5 + Math.sin(this.globalTime * 3) * 0.3})`;
        ctx.fillText('和声共鸣中... 保持运弓！', this.W / 2, this.H - 40);
      }

      ctx.restore();
    }
  },

  renderHUD(ctx) {
    if (this.state === 'BOSS_FIGHT') return; // boss has its own HUD

    ctx.save();

    // Scene name
    const scene = Scenes[this.currentScene];
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#8a8a9a';
    ctx.textAlign = 'left';
    ctx.fillText(scene.name, 15, 25);

    // Puzzle progress
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#6a6a7a';
    ctx.fillText(`谜题: ${this.solvedPuzzles}/${this.totalPuzzles}`, 15, 45);

    // Current pitch and bow info (when playing)
    if (this.player.playing) {
      const noteName = AudioEngine.getClosestNoteName(this.player.currentPitch);
      const hue = 30 + (this.player.currentPitch - 65) / (440 - 65) * 200;

      // Pitch indicator
      ctx.textAlign = 'right';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = `hsl(${hue}, 70%, 65%)`;
      ctx.fillText(`${noteName}`, this.W - 15, 25);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#8a8a9a';
      ctx.fillText(`弓压: ${(this.player.bowPressure * 100).toFixed(0)}%`, this.W - 15, 45);
      ctx.fillText(`弓向: ${this.player.bowDir > 0 ? '↓下弓' : this.player.bowDir < 0 ? '↑上弓' : '静止'}`, this.W - 15, 60);
    }

    // Hint text
    if (this.hintTimer > 0) {
      ctx.textAlign = 'center';
      ctx.font = '16px sans-serif';
      const hintAlpha = Math.min(1, this.hintTimer);
      ctx.fillStyle = `rgba(220, 180, 140, ${hintAlpha})`;
      const lines = this.hintText.split('\n');
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], this.W / 2, this.H * 0.85 + i * 22);
      }
    }

    // Controls reminder (bottom left)
    ctx.textAlign = 'left';
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(120, 120, 140, 0.5)';
    ctx.fillText('A/D 移动 | W/↑ 跳跃 | 鼠标拖拽运弓 | Y=音高 | 拖拽力度=弓压', 15, this.H - 15);

    ctx.restore();
  },

  renderVictory(ctx) {
    // Bright, warm forest
    const brightness = Math.min(1, this.victoryTime * 0.3);
    const grad = ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, `rgb(${40 + brightness * 80}, ${35 + brightness * 60}, ${20 + brightness * 30})`);
    grad.addColorStop(0.5, `rgb(${50 + brightness * 100}, ${45 + brightness * 80}, ${25 + brightness * 40})`);
    grad.addColorStop(1, `rgb(${30 + brightness * 60}, ${25 + brightness * 50}, ${15 + brightness * 25})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Radiant trees
    for (let i = 0; i < 12; i++) {
      const tx = i * this.W / 11;
      PaintFX.drawTree(ctx, tx, this.H - 50, 300, '#5a4a30', `rgba(${80 + brightness * 120}, ${100 + brightness * 80}, ${40 + brightness * 60}, 0.6)`, 0.1);
    }

    // Golden light from above
    const sunGrad = ctx.createRadialGradient(this.W / 2, 0, 0, this.W / 2, 0, this.H * 0.8);
    sunGrad.addColorStop(0, `rgba(220, 180, 100, ${brightness * 0.3})`);
    sunGrad.addColorStop(1, 'rgba(220, 180, 100, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Floating particles (golden)
    for (let i = 0; i < 40; i++) {
      const px = Math.sin(this.victoryTime * 0.5 + i * 0.7) * this.W / 2 + this.W / 2;
      const py = (this.victoryTime * 20 + i * 30) % this.H;
      const ps = 2 + Math.sin(this.victoryTime + i) * 1;
      ctx.beginPath();
      ctx.arc(px, py, ps, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220, 180, 100, ${0.3 + brightness * 0.4})`;
      ctx.fill();
    }

    // Victory text
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px "Georgia", serif';
    ctx.shadowColor = 'rgba(220, 180, 100, 0.5)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#d4a855';
    ctx.fillText('森林苏醒', this.W / 2, this.H * 0.35);

    ctx.font = '24px "Georgia", serif';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#a08050';
    ctx.fillText('The Forest Awakens', this.W / 2, this.H * 0.35 + 50);

    ctx.shadowBlur = 0;
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#8a7a60';
    ctx.fillText('你的共鸣唤醒了森林，光芒穿透了树冠。', this.W / 2, this.H * 0.6);
    ctx.fillText('声音塑造世界。', this.W / 2, this.H * 0.6 + 30);

    const pulse = 0.5 + Math.sin(this.victoryTime * 2) * 0.3;
    ctx.fillStyle = `rgba(200, 180, 140, ${pulse})`;
    ctx.font = '16px sans-serif';
    ctx.fillText('点击或按 Space 重新开始', this.W / 2, this.H * 0.8);
    ctx.restore();

    // Cello icon centered
    this.drawCelloIcon(ctx, this.W / 2, this.H * 0.45, 100);
  },

  // ═════════════════════════════════════════════════════
  // GAME LOOP
  // ═════════════════════════════════════════════════════
  lastTime: 0,

  loop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.update(dt);
    this.render();

    requestAnimationFrame(() => this.loop());
  }
};

// Start
window.addEventListener('load', () => Game.init());
