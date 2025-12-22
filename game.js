const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameUI = document.getElementById('game-ui');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score');
const streakDisplay = document.getElementById('streak');
const finalScoreDisplay = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game State
let isPlaying = false;
let score = 0;
let streak = 0;
let animationId;
let lastTime = 0;
let spawnTimer = 0;
let spawnInterval = 1000; // Initial spawn rate in ms
let speedMultiplier = 1;

// Audio Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Game Objects
const player = {
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    color: '#3b82f6', // Blue-500
    speed: 10
};

let cubes = [];
let particles = [];

// Resize Canvas
function resize() {
    canvas.width = document.getElementById('game-container').offsetWidth;
    canvas.height = document.getElementById('game-container').offsetHeight;
    player.y = canvas.height - 50;
    player.x = canvas.width / 2 - player.width / 2;
}
window.addEventListener('resize', resize);
resize();

// Input Handling
let keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Mouse/Touch Control
canvas.addEventListener('mousemove', e => {
    if (!isPlaying) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    player.x = mouseX - player.width / 2;
    // Clamp to screen
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
});

// Sound Synthesis
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'catch') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'miss') {
        osc.type = 'triangle'; // Softer than sawtooth
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    }
}

// Classes
class Cube {
    constructor() {
        this.size = 40;
        this.x = Math.random() * (canvas.width - this.size);
        this.y = -this.size;
        this.speed = (3 + Math.random() * 2) * speedMultiplier;
        // Pastel Colors
        const hues = [0, 200, 150, 45, 280]; // Red, Blue, Green, Orange, Purple
        const hue = hues[Math.floor(Math.random() * hues.length)];
        this.color = `hsl(${hue}, 70%, 60%)`;
        this.active = true;
    }

    update() {
        this.y += this.speed;
        if (this.y > canvas.height) {
            this.active = false;
            handleMiss();
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        // Removed shadowBlur for flat design
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 5 + 2;
        this.speedX = (Math.random() - 0.5) * 10;
        this.speedY = (Math.random() - 0.5) * 10;
        this.color = color;
        this.life = 1.0;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 0.05;
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// Game Logic
function spawnCube() {
    cubes.push(new Cube());
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function handleCatch(cube) {
    score += 10 + Math.floor(streak / 5) * 5;
    streak++;
    scoreDisplay.textContent = score;
    streakDisplay.textContent = streak;
    playSound('catch');
    createExplosion(cube.x + cube.size / 2, cube.y + cube.size / 2, cube.color);

    // Increase difficulty
    if (score % 100 === 0) {
        speedMultiplier += 0.1;
        spawnInterval = Math.max(200, spawnInterval - 50);
    }
}

function handleMiss() {
    streak = 0;
    streakDisplay.textContent = streak;
    playSound('miss');
    gameOver();
}

function update(deltaTime) {
    // Player Movement (Keyboard)
    if (keys['ArrowLeft'] || keys['KeyA']) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
        player.x += player.speed;
    }
    // Clamp
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Spawning
    spawnTimer += deltaTime;
    if (spawnTimer > spawnInterval) {
        spawnCube();
        spawnTimer = 0;
    }

    // Update Cubes
    cubes.forEach(cube => cube.update());
    cubes = cubes.filter(c => c.active);

    // Collision Detection
    cubes.forEach(cube => {
        if (
            cube.x < player.x + player.width &&
            cube.x + cube.size > player.x &&
            cube.y < player.y + player.height &&
            cube.y + cube.size > player.y
        ) {
            cube.active = false;
            handleCatch(cube);
        }
    });

    // Update Particles
    particles.forEach(p => p.update());
    particles = particles.filter(p => p.life > 0);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Player
    ctx.fillStyle = player.color;
    // Removed shadowBlur for flat design
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Draw Cubes
    cubes.forEach(c => c.draw());

    // Draw Particles
    particles.forEach(p => p.draw());
}

function loop(timestamp) {
    if (!isPlaying) return;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    update(deltaTime);
    draw();

    animationId = requestAnimationFrame(loop);
}

function startGame() {
    isPlaying = true;
    score = 0;
    streak = 0;
    speedMultiplier = 1;
    spawnInterval = 1000;
    cubes = [];
    particles = [];
    scoreDisplay.textContent = '0';
    streakDisplay.textContent = '0';

    startScreen.classList.remove('active');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.remove('active');
    gameOverScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    gameUI.classList.add('active');

    lastTime = performance.now();
    loop(lastTime);
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    finalScoreDisplay.textContent = score;
    gameUI.classList.remove('active');
    gameUI.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    gameOverScreen.classList.add('active');
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initialize UI State
function init() {
    startScreen.classList.remove('hidden');
    startScreen.classList.add('active');
    gameUI.classList.remove('active');
    gameUI.classList.add('hidden');
    gameOverScreen.classList.remove('active');
    gameOverScreen.classList.add('hidden');

    // Force resize
    resize();

    console.log("Game Initialized");
}

// Run init
init();
