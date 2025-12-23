const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameUI = document.getElementById('game-ui');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level'); // Add this to HTML if missing, or use valid ID
const finalScoreDisplay = document.getElementById('final-score');
const inputDisplay = document.getElementById('input-display');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game Constants
const GRAVITY = 0.5;
const GROUND_Y = 50; // Distance from bottom
const WORD_LIST = [
    "cat", "dog", "run", "jump", "fast", "ninja", "zombie", "dino", "byte", "code",
    "pixel", "slash", "claw", "roar", "hunt", "prey", "night", "moon", "star", "sky",
    "shadow", "stealth", "fight", "brave", "honor", "sword", "kicks", "punch", "dash",
    "thunder", "storm", "power", "magic", "super", "hyper", "mega", "ultra", "epic"
];

// Assets
const images = {};
const assetsToLoad = {
    player: 'assets/ninja_cat.png',
    enemy: 'assets/zombie_dino.png',
    bg: 'assets/background.png'
};

let assetsLoaded = 0;
const totalAssets = Object.keys(assetsToLoad).length;

function loadAssets(callback) {
    for (const [key, src] of Object.entries(assetsToLoad)) {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            assetsLoaded++;
            if (assetsLoaded === totalAssets) callback();
        };
        images[key] = img;
    }
}

// Game State
let isPlaying = false;
let score = 0;
let level = 1;
let enemies = [];
let particles = [];
let spawnTimer = 0;
let spawnInterval = 2000;
let animationId;
let lastTime = 0;
let currentInput = "";

// Entities
class Sprite {
    constructor(image, x, y, width, height) {
        this.image = image;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }
}

class Player extends Sprite {
    constructor() {
        // Assuming sprite is roughly square-ish, adjust based on actual image aspect ratio
        // Default size 64x64 scaled up
        super(images.player, 100, canvas.height - GROUND_Y - 128, 128, 128);
        this.baseY = this.y;
        this.isAttacking = false;
        this.attackTimer = 0;
    }

    update(deltaTime) {
        if (this.isAttacking) {
            this.attackTimer -= deltaTime;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
                this.x = 100; // Reset position
            }
        }
    }

    attack() {
        this.isAttacking = true;
        this.attackTimer = 200; // ms
        this.x = 120; // Small lunge forward
        createExplosion(this.x + this.width, this.y + this.height / 2, '#fff');
    }
}

class Enemy extends Sprite {
    constructor(word) {
        super(images.enemy, canvas.width, canvas.height - GROUND_Y - 128, 128, 128);
        this.word = word;
        this.speed = 100 + (level * 10); // Pixels per second
        this.markedForDeletion = false;
    }

    update(deltaTime) {
        this.x -= this.speed * (deltaTime / 1000);
        if (this.x + this.width < 0) {
            // Missed enemy (game over logic handled in main loop collision)
        }
    }

    draw() {
        super.draw();

        // Draw Word
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';

        // Background for text
        const textWidth = ctx.measureText(this.word).width;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x + this.width / 2 - textWidth / 2 - 5, this.y - 30, textWidth + 10, 30);

        // Text
        ctx.fillStyle = '#fff';
        if (this.word.startsWith(currentInput) && currentInput.length > 0) {
            ctx.fillStyle = '#ffff00'; // Highlight matched part logic handled in main draw loop usually, 
            // but here we just show the word. 
            // Better matching visualization:

            const matchLen = currentInput.length;
            const matchStr = this.word.substring(0, matchLen);
            const restStr = this.word.substring(matchLen);

            // Simplified: Just draw white. Advanced highlighting requires separate draws.
        }
        ctx.fillText(this.word, this.x + this.width / 2, this.y - 10);
    }
}

// Particles
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 5 + 5;
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
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.fillRect(this.x, this.y, this.size, this.size); // Square for pixel look
        ctx.globalAlpha = 1.0;
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Input Handling
window.addEventListener('keydown', (e) => {
    if (!isPlaying) return;

    // Allow Backspace
    if (e.key === 'Backspace') {
        currentInput = currentInput.slice(0, -1);
        updateInputDisplay();
        return;
    }

    // Only allow letters
    if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
        currentInput += e.key.toLowerCase();
        updateInputDisplay();
        checkInput();
    }
});

function updateInputDisplay() {
    inputDisplay.textContent = currentInput.toUpperCase();
}

function checkInput() {
    const matchIndex = enemies.findIndex(e => e.word === currentInput);
    if (matchIndex !== -1) {
        // Hit!
        const enemy = enemies[matchIndex];
        createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#0f0');
        enemies.splice(matchIndex, 1);
        currentInput = "";
        updateInputDisplay();
        score += 10;
        scoreDisplay.textContent = score;

        // Level logic
        if (score > 0 && score % 100 === 0) {
            level++;
            levelDisplay.textContent = level; // Assuming element exists
            spawnInterval = Math.max(500, spawnInterval - 100);
        }

        // Player animation
        if (playerInstance) playerInstance.attack();
    }
}

// Main Loop
let playerInstance;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (playerInstance) {
        playerInstance.y = canvas.height - GROUND_Y - 128;
        playerInstance.baseY = playerInstance.y;
    }
}
window.addEventListener('resize', resize);

function update(deltaTime) {
    playerInstance.update(deltaTime);

    // Spawn Enemies
    spawnTimer += deltaTime;
    if (spawnTimer > spawnInterval) {
        const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
        // Ensure no duplicate words on screen
        if (!enemies.some(e => e.word === word)) {
            enemies.push(new Enemy(word));
            spawnTimer = 0;
        }
    }

    // Update Enemies
    enemies.forEach(enemy => {
        enemy.update(deltaTime);
        // Collision with player
        if (enemy.x < playerInstance.x + playerInstance.width - 40) { // Simple overlap
            gameOver();
        }
    });

    // Update Particles
    particles.forEach((p, index) => {
        p.update();
        if (p.life <= 0) particles.splice(index, 1);
    });
}

function draw() {
    // Draw BG
    ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height); // Simple stretch for now

    playerInstance.draw();
    enemies.forEach(e => e.draw());
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
    if (assetsLoaded < totalAssets) {
        console.log("Waiting for assets...");
        return;
    }

    isPlaying = true;
    score = 0;
    level = 1;
    enemies = [];
    particles = [];
    currentInput = "";
    spawnInterval = 2000;

    scoreDisplay.textContent = score;
    levelDisplay.textContent = level;
    updateInputDisplay();

    startScreen.classList.remove('active');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.remove('active');
    gameOverScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    gameUI.classList.add('active');

    playerInstance = new Player();
    resize();

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

// Init
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

loadAssets(() => {
    console.log("Assets loaded");
    resize();
    // Initial draw to show BG?
    ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height);
});
