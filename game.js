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
const GROUND_BASE_Y = 100;
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
    cat_run_3: 'assets/cat_run_3.png',
    cat_run_4: 'assets/cat_run_4.png',
    cat_attack: 'assets/cat_attack.png',
    dino_walk_1: 'assets/dino_realistic_walk_1.png',
    dino_walk_2: 'assets/dino_realistic_walk_2.png',
    ptero_fly_1: 'assets/ptero_fly_1.png',
    ptero_fly_2: 'assets/ptero_fly_2.png',
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
let terrainOffset = 0;
let targetEnemyId = null;

// Terrain Function
function getGroundHeight(x) {
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
        this.frameInterval = 100;
        this.facingLeft = false;
    }

    draw() { }
}

class Player extends Sprite {
    constructor() {
        super(canvas.width / 2 - 64, 0, 128, 128);
        this.state = 'RUNNING';
        this.attackTimer = 0;
        this.runFrames = [images.cat_run_1, images.cat_run_2, images.cat_run_3, images.cat_run_4];
        this.attackFrame = images.cat_attack;
    }

    update(deltaTime) {
        // Stick to ground
        this.y = getGroundHeight(this.x + 64) - 100;

        // Visual Logic: facingLeft only if attacking/targeting.
        // If RUNNING/Walking, force Face Right (facingLeft = false)
        if (this.state === 'RUNNING') {
            this.facingLeft = false;
        } else if (targetEnemyId) {
            // Only flip when actively engaging a target (Attacking)
            const target = enemies.find(e => e.id === targetEnemyId);
            if (target) {
                this.facingLeft = target.x < this.x;
            }
        }

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

    attack(type) {
        this.state = 'ATTACKING';
        if (type === 'melee') {
            this.attackTimer = 300;
        } else {
            this.attackTimer = 100;
        }
    }

    draw() {
        let img;
        if (this.state === 'ATTACKING') {
            img = this.attackFrame;
        } else {
            if (this.currentFrame >= this.runFrames.length) this.currentFrame = 0;
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
    constructor(startX, startY, targetEnemy, isKillShot) {
        this.x = startX;
        this.y = startY;
        this.targetEnemy = targetEnemy;
        this.speed = 1500;
        this.active = true;
        this.rotation = 0;
        this.isKillShot = isKillShot;
        this.scale = 1.5;
    }

    update(deltaTime) {
        if (!this.targetEnemy) {
            this.active = false;
            return;
        }

        const targetX = this.targetEnemy.x + this.targetEnemy.width / 2;
        const targetY = this.targetEnemy.y + this.targetEnemy.height / 2;

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 40) {
            this.active = false;
            createExplosion(targetX, targetY, 'spark');

            if (this.isKillShot) {
                const index = enemies.indexOf(this.targetEnemy);
                if (index !== -1) {
                    createExplosion(targetX, targetY, 'blood');
                    enemies.splice(index, 1);
                    score += 10;
                    screenShake = 5;
                    checkLevelUp();
                    targetEnemyId = null;
                }
            }
            return;
        }

        const moveDist = this.speed * (deltaTime / 1000);
        this.x += (dx / dist) * moveDist;
        this.y += (dy / dist) * moveDist;
        this.rotation += 25 * (deltaTime / 1000);
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI * 2);
        ctx.scale(this.scale, this.scale);
        ctx.fillStyle = '#eee';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#111';
        ctx.beginPath();
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
    constructor(word, side, type = 'ground') {
        let startX, startY;

        if (side === 'top') {
            startX = Math.random() * (canvas.width - 100) + 50;
            startY = -150;
        } else {
            startX = side === 'left' ? -150 : canvas.width + 150;
            startY = 0; // Will be corrected by updates
        }

        super(startX, startY, 128, 128);
        this.id = Math.random().toString(36).substr(2, 9);
        this.word = word;
        this.side = side;
        this.type = type;

        this.speed = (150 + (level * 15)) * speedMultiplier;

        if (this.type === 'flying') {
            this.walkFrames = [images.ptero_fly_1, images.ptero_fly_2];
            this.speed *= 1.2; // Faster
            // Random cruising altitude if not top spawn
            if (side !== 'top') this.y = Math.random() * 200 + 50;
        } else {
            this.walkFrames = [images.dino_walk_1, images.dino_walk_2];
        }

        this.isJumping = false;
        this.velocityY = 0;
    }

    update(deltaTime) {
        const playerX = playerInstance.x;
        const distToPlayer = Math.abs(this.x - playerX);

        // Facing Logic:
        // Source sprite faces LEFT.
        // If x > playerX (Right side, moving Left): Face LEFT (Normal).
        // If x < playerX (Left side, moving Right): Face RIGHT (Flip).
        this.facingLeft = (this.x > playerX);

        // Movement Logic: Always move towards player
        const moveDir = (playerX > this.x) ? 1 : -1;
        this.x += moveDir * this.speed * (deltaTime / 1000);

        const groundY = getGroundHeight(this.x + 64) - 100;

        if (this.isJumping) {
            this.velocityY += 2000 * (deltaTime / 1000);
            this.y += this.velocityY * (deltaTime / 1000);

            if (this.y > groundY) {
                this.y = groundY;
                this.isJumping = false;
                this.velocityY = 0;
            }
        } else {
            this.y = groundY;
            if (distToPlayer < 250 && !this.isJumping) {
                this.isJumping = true;
                this.velocityY = -800;
            }
        }

        this.frameTimer += deltaTime;
        if (this.frameTimer > 100) {
            this.currentFrame = (this.currentFrame + 1) % this.walkFrames.length;
            this.frameTimer = 0;
        }
    }

    draw() {
        const img = this.walkFrames[this.currentFrame];

        ctx.save();
        // Drawing Logic Correction:
        // Sprite source faces Left.
        // If this.facingLeft is TRUE, we want to draw it normally (Left).
        // If this.facingLeft is FALSE, we want to Flip it (Right).

        if (this.facingLeft) {
            // Source is RIGHT. We want LEFT. So FLIP.
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, this.width, this.height);
        } else {
            // Source is RIGHT. We want RIGHT. So NORMAL.
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
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

        if (this.id === targetEnemyId) {
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
        this.life -= 0.05;
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

        if (currentInput.length === 0) targetEnemyId = null;
        return;
    }

    if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
        const char = e.key.toLowerCase();

        if (!targetEnemyId) {
            const visibleEnemies = enemies.filter(e => e.x > -200 && e.x < canvas.width + 200);
            const match = visibleEnemies.find(e => e.word.startsWith(char));
            if (match) {
                targetEnemyId = match.id;
                currentInput += char;
                fireShot(match, 1);
            }
        } else {
            const target = enemies.find(e => e.id === targetEnemyId);
            if (target) {
                const requiredChar = target.word[currentInput.length];
                if (char === requiredChar) {
                    currentInput += char;
                    fireShot(target, currentInput.length);
                }
            } else {
                targetEnemyId = null;
                currentInput = "";
            }
        }

        updateInputDisplay();
        checkCompletion();
    }
});

function fireShot(target, index) {
    const isKill = (index === target.word.length);
    const startX = playerInstance.x + 64;
    const startY = playerInstance.y + 64;

    projectiles.push(new Projectile(startX, startY, target, isKill));
    playerInstance.attack('range');
}

function updateInputDisplay() {
    inputDisplay.textContent = currentInput.toUpperCase();
}

function checkCompletion() {
    if (!targetEnemyId) return;

    const target = enemies.find(e => e.id === targetEnemyId);
    if (target && currentInput === target.word) {
        currentInput = "";
        updateInputDisplay();
        targetEnemyId = null;
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
    terrainOffset += 100 * (deltaTime / 1000);
    bgX -= 50 * (deltaTime / 1000);
    if (bgX <= -canvas.width) bgX = 0;

    if (screenShake > 0) {
        screenShake -= 0.5;
        if (screenShake < 0) screenShake = 0;
    }

    if (playerInstance) playerInstance.update(deltaTime);

    spawnTimer += deltaTime;
    if (spawnTimer > spawnInterval) {
        const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
        if (!enemies.some(e => e.word === word)) {
            // Spawning Logic
            const rand = Math.random();
            let side, type;

            if (rand < 0.3) {
                // 30% Pterodactyl
                type = 'flying';
                // 33% Top, 33% Left, 33% Right
                const r2 = Math.random();
                if (r2 < 0.33) side = 'top';
                else if (r2 < 0.66) side = 'left';
                else side = 'right';
            } else {
                // 70% T-Rex
                type = 'ground';
                side = Math.random() < 0.5 ? 'left' : 'right';
            }

            enemies.push(new Enemy(word, side, type));
            spawnTimer = 0;
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(deltaTime);

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

    // Terrain
    ctx.fillStyle = '#0a0805';
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
