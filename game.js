const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameUI = document.getElementById('game-ui');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const finalScoreDisplay = document.getElementById('final-score');
const inputDisplay = document.getElementById('input-display');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game Constants
const GROUND_Y = 50;
const MELEE_RANGE = 300; // Attack type threshold (pixels)
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
let projectiles = [];
let spawnTimer = 0;
let spawnInterval = 2000;
let animationId;
let lastTime = 0;
let currentInput = "";
let speedMultiplier = 1;

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
        if (this.image.complete && this.image.naturalHeight !== 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        }
    }
}

class Player extends Sprite {
    constructor() {
        super(images.player, 100, canvas.height - GROUND_Y - 128, 128, 128);
        this.baseY = this.y;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackType = 'none'; // 'melee' or 'range'
    }

    update(deltaTime) {
        if (this.isAttacking) {
            this.attackTimer -= deltaTime;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
                this.x = 100; // Reset position
                this.attackType = 'none';
            }
        }
    }

    attack(type) {
        this.isAttacking = true;
        this.attackType = type;

        if (type === 'melee') {
            this.attackTimer = 200;
            this.x = 150; // Lunge forward
        } else {
            this.attackTimer = 100; // Quick throw animation
        }
    }

    draw() {
        // Simple visual feedback for attack types
        if (this.isAttacking) {
            ctx.save();
            ctx.filter = this.attackType === 'melee' ? 'brightness(1.5) sepia(1) hue-rotate(-50deg)' : 'brightness(1.2)';
            super.draw();
            ctx.restore();

            // Draw Katana Slash line effect
            if (this.attackType === 'melee') {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(this.x + 80, this.y + 20);
                ctx.lineTo(this.x + 120 + 50, this.y + 80);
                ctx.stroke();
            }
        } else {
            super.draw();
        }
    }
}

class Projectile {
    constructor(startX, startY, targetX, targetY) {
        this.x = startX;
        this.y = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.speed = 1200; // Fast shuriken
        this.active = true;
        this.size = 20;
        this.rotation = 0;
    }

    update(deltaTime) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 20) {
            this.active = false; // Hit
            return true; // Return hit status
        }

        const moveDist = this.speed * (deltaTime / 1000);
        this.x += (dx / dist) * moveDist;
        this.y += (dy / dist) * moveDist;
        this.rotation += 15 * (deltaTime / 1000);
        return false;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI * 2);
        ctx.fillStyle = '#ccc';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        // Four point star
        ctx.moveTo(0, -10);
        ctx.lineTo(3, -3);
        ctx.lineTo(10, 0);
        ctx.lineTo(3, 3);
        ctx.lineTo(0, 10);
        ctx.lineTo(-3, 3);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-3, -3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class Enemy extends Sprite {
    constructor(word) {
        super(images.enemy, canvas.width, canvas.height - GROUND_Y - 128, 128, 128);
        this.word = word;
        this.speed = (100 + (level * 10)) * speedMultiplier;
        this.markedForDeletion = false;
    }

    update(deltaTime) {
        this.x -= this.speed * (deltaTime / 1000);
    }

    draw() {
        super.draw();

        // Draw Word Box
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';

        const textWidth = ctx.measureText(this.word).width;

        // Background for text visibility
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(this.x + this.width / 2 - textWidth / 2 - 5, this.y - 35, textWidth + 10, 30);

        // Text
        const centerX = this.x + this.width / 2;
        const textY = this.y - 12;

        if (this.word.startsWith(currentInput) && currentInput.length > 0) {
            // Draw matched part in yellow, rest in white
            // We need to split text drawing to color parts differently

            // Re-align to left to draw parts
            const totalWidth = ctx.measureText(this.word).width;
            const startX = centerX - totalWidth / 2;

            const matchedPart = this.word.substring(0, currentInput.length);
            const restPart = this.word.substring(currentInput.length);

            ctx.textAlign = 'left';

            // Matched (Yellow)
            ctx.fillStyle = '#ffff00';
            ctx.fillText(matchedPart, startX, textY);

            // Rest (White)
            const matchedWidth = ctx.measureText(matchedPart).width;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(restPart, startX + matchedWidth, textY);

        } else {
            // Full white
            ctx.fillStyle = '#ffffff';
            ctx.fillText(this.word, centerX, textY);
        }
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
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Input & Game Logic
window.addEventListener('keydown', (e) => {
    if (!isPlaying) return;

    if (e.key === 'Backspace') {
        currentInput = currentInput.slice(0, -1);
        updateInputDisplay();
        return;
    }

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
    // Find matching enemy
    // Prioritize closest enemy if multiple match? Or just first found.
    // Let's filter matches first
    const matchIndex = enemies.findIndex(e => e.word === currentInput);

    if (matchIndex !== -1) {
        const enemy = enemies[matchIndex];

        // Combat Logic: Distance check
        const dist = enemy.x - playerInstance.x;

        if (dist < MELEE_RANGE) {
            // Melee Attack (Instant Kill)
            playerInstance.attack('melee');
            createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ff0044'); // Blood red effect
            enemies.splice(matchIndex, 1);
            score += 20;
        } else {
            // Ranged Attack (Projectile)
            playerInstance.attack('range');
            projectiles.push(new Projectile(
                playerInstance.x + playerInstance.width,
                playerInstance.y + playerInstance.height / 2,
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2
            ));

            // Visual feedback on enemy (maybe flash?)
            // We remove enemy logic immediately so player can type next word, 
            // but visually it stays until projectile hits? 
            // Implementation choice: Remove logic immediately. Visual "ghost" or just remove.
            // Simplest: Remove immediately, generate explosion at target location when projectile arrives?
            // Actually, if we remove enemy, we lose target coords. 
            // Better: Mark enemy as 'defeated' but keep updating for visual until projectile hits.
            // For now: Just remove instantly and show projectile flying to empty spot for simplicity/response.

            createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ffff00');
            enemies.splice(matchIndex, 1);
            score += 10;
        }

        currentInput = "";
        updateInputDisplay();
        scoreDisplay.textContent = score;

        // Level Up
        if (score > 0 && score % 100 === 0) {
            level++;
            speedMultiplier += 0.1;
            levelDisplay.textContent = level;
            spawnInterval = Math.max(500, spawnInterval - 100);
        }
    }
}

let playerInstance;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (playerInstance) {
        playerInstance.y = canvas.height - GROUND_Y - 128; // Keep aligned with bottom
        playerInstance.baseY = playerInstance.y;
    }
}
window.addEventListener('resize', resize);

function update(deltaTime) {
    if (playerInstance) playerInstance.update(deltaTime);

    spawnTimer += deltaTime;
    if (spawnTimer > spawnInterval) {
        const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
        // Ensure unique words on screen
        if (!enemies.some(e => e.word === word)) {
            enemies.push(new Enemy(word));
            spawnTimer = 0;
        }
    }

    // Update Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(deltaTime);

        // Game Over Condition
        if (enemy.x < playerInstance.x + 50) {
            gameOver();
        }

        // Cleanup offscreen (shouldn't happen if game over triggers first, but safe guard)
        if (enemy.x + enemy.width < 0) {
            enemies.splice(i, 1);
        }
    }

    // Update Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        const hit = p.update(deltaTime);
        if (hit || !p.active) {
            projectiles.splice(i, 1);
        }
    }

    // Update Particles
    particles.forEach((p, index) => {
        p.update();
        if (p.life <= 0) particles.splice(index, 1);
    });
}

function draw() {
    // Draw BG
    // Ensure BG covers canvas
    if (images.bg) {
        ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#2d1b2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (playerInstance) playerInstance.draw();
    enemies.forEach(e => e.draw());
    projectiles.forEach(p => p.draw());
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
    speedMultiplier = 1;
    enemies = [];
    particles = [];
    projectiles = [];
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

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

loadAssets(() => {
    console.log("Assets loaded");
    resize();
    if (images.bg.complete) {
        ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height);
    }
});
