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
const GROUND_BASE_Y = 100; // Distance from bottom
const MELEE_RANGE = 200;
const WORD_LIST = [
    "run", "hunt", "bite", "claw", "roar", "prey", "flesh", "bone", "skull", "blood",
    "fury", "rage", "kill", "gore", "teeth", "snap", "tear", "rip", "shred", "maul",
    "dead", "gone", "lost", "fear", "doom", "grim", "dark", "evil", "vile", "beast",
    "monster", "demon", "devil", "hell", "pain", "hurt", "wound", "slash", "cut"
];

// Assets
const images = {};
const assetsToLoad = {
    cat_run_1: 'assets/cat_run_1.png',
    cat_run_2: 'assets/cat_run_2.png',
    cat_attack: 'assets/cat_attack.png',
    dino_walk_1: 'assets/dino_realistic_walk_1.png',
    dino_walk_2: 'assets/dino_realistic_walk_2.png',
    bg: 'assets/background_jungle.png'
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
        img.onerror = () => {
            console.warn(`Failed to load ${src}`);
            assetsLoaded++;
            if (assetsLoaded === totalAssets) callback();
        }
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

// Visual Polish State
let bgX = 0;
let screenShake = 0;
let terrainOffset = 0; // Moves with player movement

// Terrain Function
function getGroundHeight(x) {
    // Sine wave for rolling hills
    // period: 500px, amplitude: 30px
    return canvas.height - GROUND_BASE_Y - Math.sin((x + terrainOffset) * 0.01) * 30;
}

// Entities
class Sprite {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.frameTimer = 0;
        this.currentFrame = 0;
        this.frameInterval = 150;
        this.facingLeft = false;
    }

    draw() { }
}

class Player extends Sprite {
    constructor() {
        super(canvas.width / 2 - 64, 0, 128, 128); // Center screen
        this.state = 'RUNNING';
        this.attackTimer = 0;
        this.runFrames = [images.cat_run_1, images.cat_run_2];
        this.attackFrame = images.cat_attack;
    }

    update(deltaTime) {
        // Stick to ground
        this.y = getGroundHeight(this.x + 64) - 100;

        // Animation Logic
        if (this.state === 'RUNNING') {
            this.frameTimer += deltaTime;
            if (this.frameTimer > this.frameInterval) {
                this.currentFrame = (this.currentFrame + 1) % this.runFrames.length;
                this.frameTimer = 0;
            }
        }

        if (this.state === 'ATTACKING') {
            this.attackTimer -= deltaTime;
            if (this.attackTimer <= 0) {
                this.state = 'RUNNING';
            }
        }
    }

    attack(type, direction) {
        this.state = 'ATTACKING';
        this.facingLeft = (direction === 'left');

        if (type === 'melee') {
            this.attackTimer = 300;
        } else {
            this.attackTimer = 200;
        }
    }

    draw() {
        let img;
        if (this.state === 'ATTACKING') {
            img = this.attackFrame;
        } else {
            img = this.runFrames[this.currentFrame];
        }

        ctx.save();
        if (this.facingLeft) {
            ctx.scale(-1, 1);
            ctx.drawImage(img, -this.x - this.width, this.y, this.width, this.height);
        } else {
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}

class Projectile {
    constructor(startX, startY, targetEnemy) {
        this.x = startX;
        this.y = startY;
        this.targetEnemy = targetEnemy;
        this.speed = 1000;
        this.active = true;
        this.rotation = 0;
    }

    update(deltaTime) {
        if (!this.targetEnemy || !enemies.includes(this.targetEnemy)) {
            this.active = false;
            return;
        }

        const targetX = this.targetEnemy.x + this.targetEnemy.width / 2;
        const targetY = this.targetEnemy.y + this.targetEnemy.height / 2;

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 30) {
            // Impact!
            this.active = false;
            // Kill enemy
            const index = enemies.indexOf(this.targetEnemy);
            if (index !== -1) {
                createExplosion(targetX, targetY, 'blood');
                enemies.splice(index, 1);
                score += 10;
                screenShake = 5;
                checkLevelUp();
            }
            return;
        }

        const moveDist = this.speed * (deltaTime / 1000);
        this.x += (dx / dist) * moveDist;
        this.y += (dy / dist) * moveDist;
        this.rotation += 15 * (deltaTime / 1000);
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI * 2);
        ctx.fillStyle = '#ccc';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        // Shuriken
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
    constructor(word, side) {
        // side: 'left' or 'right'
        let startX = side === 'left' ? -150 : canvas.width + 150;
        super(startX, 0, 128, 128);
        this.word = word;
        this.side = side;
        this.speed = (150 + (level * 15)) * speedMultiplier; // Faster
        this.walkFrames = [images.dino_walk_1, images.dino_walk_2];
        this.facingLeft = (side === 'right');

        // Jump state
        this.isJumping = false;
        this.velocityY = 0;
        this.jumpCooldown = 0;
    }

    update(deltaTime) {
        const playerX = playerInstance.x;
        const distToPlayer = Math.abs(this.x - playerX);

        // Movement
        if (this.side === 'left') {
            this.x += this.speed * (deltaTime / 1000);
        } else {
            this.x -= this.speed * (deltaTime / 1000);
        }

        // Ground/Jump Logic
        const groundY = getGroundHeight(this.x + 64) - 100;

        if (this.isJumping) {
            this.velocityY += 2000 * (deltaTime / 1000); // Gravity
            this.y += this.velocityY * (deltaTime / 1000);

            if (this.y > groundY) {
                this.y = groundY;
                this.isJumping = false;
                this.velocityY = 0;
            }
        } else {
            this.y = groundY;

            // Jump Trigger
            if (distToPlayer < 250 && !this.isJumping) {
                this.isJumping = true;
                this.velocityY = -800; // Jump force
            }
        }

        // Animation
        this.frameTimer += deltaTime;
        if (this.frameTimer > 100) { // Faster animation
            this.currentFrame = (this.currentFrame + 1) % this.walkFrames.length;
            this.frameTimer = 0;
        }
    }

    draw() {
        const img = this.walkFrames[this.currentFrame];

        ctx.save();
        if (this.facingLeft) {
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
        } else {
            // Flip for right-facing logic if source is left-facing or vice-versa
            // Assuming source is facing Left by default (dino sprite usually does)
            // If source faces Left:
            // side='right' (x > player) -> should face LEFT (default)
            // side='left' (x < player) -> should face RIGHT (flip)

            if (this.side === 'left') {
                ctx.translate(this.x + this.width, this.y);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(img, this.x, this.y, this.width, this.height);
            }
        }
        ctx.restore();

        // Word Box
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';
        const textWidth = ctx.measureText(this.word).width;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(this.x + this.width / 2 - textWidth / 2 - 5, this.y - 35, textWidth + 10, 30);
        const centerX = this.x + this.width / 2;
        const textY = this.y - 12;

        // Text Match
        if (this.word.startsWith(currentInput) && currentInput.length > 0) {
            const totalWidth = ctx.measureText(this.word).width;
            const startX = centerX - totalWidth / 2;
            const matchedPart = this.word.substring(0, currentInput.length);
            const restPart = this.word.substring(currentInput.length);

            ctx.textAlign = 'left';
            ctx.fillStyle = '#ff0000';
            ctx.fillText(matchedPart, startX, textY);
            const matchedWidth = ctx.measureText(matchedPart).width;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(restPart, startX + matchedWidth, textY);
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.fillText(this.word, centerX, textY);
        }
    }
}

// Global Particle System
class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 15;
        this.speedY = (Math.random() - 1) * 15;
        this.gravity = 0.8;
        this.life = 1.0;

        if (type === 'blood') {
            const shade = Math.floor(Math.random() * 50);
            this.color = `rgb(${150 + shade}, 0, 0)`;
        } else {
            this.color = '#ffff00';
        }
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += this.gravity;
        this.life -= 0.02;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

function createExplosion(x, y, type) {
    const count = type === 'blood' ? 20 : 8;
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, type));
    }
}

// Input
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
    // Keep target selection simple: First match in list
    const exactMatchIndex = enemies.findIndex(e => e.word === currentInput);

    if (exactMatchIndex !== -1) {
        const enemy = enemies[exactMatchIndex];
        const dist = Math.abs(enemy.x - playerInstance.x);
        const direction = enemy.x < playerInstance.x ? 'left' : 'right';

        if (dist < MELEE_RANGE) {
            // Instant Melee Kill
            playerInstance.attack('melee', direction);
            createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 'blood');
            enemies.splice(exactMatchIndex, 1);
            score += 20;
            screenShake = 15;
            checkLevelUp();
        } else {
            // Ranged Projectile (Delayed Death)
            playerInstance.attack('range', direction);
            projectiles.push(new Projectile(
                playerInstance.x + 64,
                playerInstance.y + 64,
                enemy
            ));
            // Do NOT remove enemy yet. Projectile handles it.
            // Reset input so user can type next word.
        }
        currentInput = "";
        updateInputDisplay();
        scoreDisplay.textContent = score;
    }
}

function checkLevelUp() {
    if (score > 0 && score % 100 === 0) {
        level++;
        speedMultiplier += 0.1;
        levelDisplay.textContent = level;
        spawnInterval = Math.max(500, spawnInterval - 100);
    }
}

let playerInstance;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);

function update(deltaTime) {
    // Scroll Terrain
    terrainOffset += 100 * (deltaTime / 1000);
    bgX -= 50 * (deltaTime / 1000);
    if (bgX <= -canvas.width) bgX = 0;

    if (screenShake > 0) {
        screenShake -= 0.5;
        if (screenShake < 0) screenShake = 0;
    }

    if (playerInstance) playerInstance.update(deltaTime);

    // Spawning
    spawnTimer += deltaTime;
    if (spawnTimer > spawnInterval) {
        const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
        if (!enemies.some(e => e.word === word)) {
            // Random side
            const side = Math.random() < 0.5 ? 'left' : 'right';
            enemies.push(new Enemy(word, side));
            spawnTimer = 0;
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(deltaTime);

        // Collision with Player
        if (Math.abs(enemy.x - playerInstance.x) < 50 && Math.abs(enemy.y - playerInstance.y) < 50) {
            gameOver();
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update(deltaTime);
        if (!p.active) {
            projectiles.splice(i, 1);
        }
    }

    particles.forEach((p, index) => {
        p.update();
        if (p.life <= 0) particles.splice(index, 1);
    });
}

function draw() {
    ctx.save();

    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    // BG
    if (images.bg && images.bg.complete) {
        ctx.drawImage(images.bg, bgX, 0, canvas.width, canvas.height);
        ctx.drawImage(images.bg, bgX + canvas.width, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#1a1510';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw Terrain (Silhouette)
    ctx.fillStyle = '#0a0805'; // Darker ground color
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for (let x = 0; x <= canvas.width; x += 10) {
        ctx.lineTo(x, getGroundHeight(x));
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.fill();

    if (playerInstance) playerInstance.draw();
    enemies.forEach(e => e.draw());
    projectiles.forEach(p => p.draw());
    particles.forEach(p => p.draw());

    ctx.restore();
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
    resize();
    if (images.bg.complete) ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height);
});
