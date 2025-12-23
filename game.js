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
const MELEE_RANGE = 300;
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
    // New Realistic Assets (Fallback to zombie ones if not ready yet)
    dino_walk_1: 'assets/dino_realistic_walk_1.png',
    dino_walk_2: 'assets/dino_realistic_walk_2.png',
    bg: 'assets/background_jungle.png'
};

// Fallback logic handled in load or draw if they fail? 
// For now we try to load them. If they fail, we might see empty or errors.
// Prudent to check or have fallbacks.

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
            console.warn(`Failed to load ${src}, using fallback`);
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

// Entities
class Sprite {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.frameTimer = 0;
        this.currentFrame = 0;
        this.frameInterval = 200;
    }

    draw() { }
}

class Player extends Sprite {
    constructor() {
        super(100, canvas.height - GROUND_Y - 128, 128, 128);
        this.baseY = this.y;
        this.state = 'RUNNING';
        this.attackTimer = 0;
        this.bobTimer = 0;

        this.runFrames = [images.cat_run_1, images.cat_run_2];
        this.attackFrame = images.cat_attack;
    }

    update(deltaTime) {
        this.bobTimer += deltaTime * 0.01;
        this.y = this.baseY + Math.sin(this.bobTimer) * 5;

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
                this.x = 100;
            }
        }
    }

    attack(type) {
        this.state = 'ATTACKING';
        if (type === 'melee') {
            this.attackTimer = 300;
            this.x = 150;
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

        if (img && img.complete) {
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
        }
    }
}

class Projectile {
    constructor(startX, startY, targetX, targetY) {
        this.x = startX;
        this.y = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.speed = 1200;
        this.active = true;
        this.rotation = 0;
    }

    update(deltaTime) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 20) {
            this.active = false;
            return true;
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
    constructor(word) {
        super(canvas.width, canvas.height - GROUND_Y - 128, 128, 128);
        this.word = word;
        this.speed = (100 + (level * 10)) * speedMultiplier;
        this.walkFrames = [images.dino_walk_1, images.dino_walk_2];
    }

    update(deltaTime) {
        this.x -= this.speed * (deltaTime / 1000);

        this.frameTimer += deltaTime;
        if (this.frameTimer > this.frameInterval) {
            this.currentFrame = (this.currentFrame + 1) % this.walkFrames.length;
            this.frameTimer = 0;
        }
    }

    draw() {
        const img = this.walkFrames[this.currentFrame];
        if (img && img.complete && img.naturalHeight !== 0) {
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#556b2f'; // Dark Olive Green Fallback
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }

        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';

        const textWidth = ctx.measureText(this.word).width;

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(this.x + this.width / 2 - textWidth / 2 - 5, this.y - 35, textWidth + 10, 30);

        const centerX = this.x + this.width / 2;
        const textY = this.y - 12;

        if (this.word.startsWith(currentInput) && currentInput.length > 0) {
            const totalWidth = ctx.measureText(this.word).width;
            const startX = centerX - totalWidth / 2;
            const matchedPart = this.word.substring(0, currentInput.length);
            const restPart = this.word.substring(currentInput.length);

            ctx.textAlign = 'left';
            ctx.fillStyle = '#ff0000'; // Red highlight for gritty feel
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

// Visceral Blood Particles
class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'blood' or 'spark'
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 15; // Fast burst
        this.speedY = (Math.random() - 1) * 15;   // Upward burst
        this.gravity = 0.8;
        this.life = 1.0;

        if (type === 'blood') {
            // Variable blood reds
            const shade = Math.floor(Math.random() * 50);
            this.color = `rgb(${150 + shade}, 0, 0)`;
        } else {
            this.color = '#ffff00';
        }
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += this.gravity; // Gravity apply
        this.life -= 0.02;

        // Ground splatter (stop at ground)
        if (this.y > canvas.height - GROUND_Y) {
            this.y = canvas.height - GROUND_Y;
            this.speedY = 0;
            this.speedX *= 0.8; // Friction
        }
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
    const matchIndex = enemies.findIndex(e => e.word === currentInput);
    if (matchIndex !== -1) {
        const enemy = enemies[matchIndex];
        const dist = enemy.x - playerInstance.x;

        if (dist < MELEE_RANGE) {
            playerInstance.attack('melee');
            createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 'blood');
            enemies.splice(matchIndex, 1);
            score += 20;
            screenShake = 15; // Violent shake
        } else {
            playerInstance.attack('range');
            projectiles.push(new Projectile(
                playerInstance.x + playerInstance.width,
                playerInstance.y + playerInstance.height / 2,
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2
            ));
            enemies.splice(matchIndex, 1);
            score += 10;
            screenShake = 5;
        }

        currentInput = "";
        updateInputDisplay();
        scoreDisplay.textContent = score;

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
        playerInstance.y = canvas.height - GROUND_Y - 128;
        playerInstance.baseY = playerInstance.y;
    }
}
window.addEventListener('resize', resize);

function update(deltaTime) {
    if (playerInstance) playerInstance.update(deltaTime);

    bgX -= 60 * (deltaTime / 1000); // Slower, heavier feel
    if (bgX <= -canvas.width) bgX = 0;

    if (screenShake > 0) {
        screenShake -= 0.5;
        if (screenShake < 0) screenShake = 0;
    }

    spawnTimer += deltaTime;
    if (spawnTimer > spawnInterval) {
        const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
        if (!enemies.some(e => e.word === word)) {
            enemies.push(new Enemy(word));
            spawnTimer = 0;
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(deltaTime);

        if (enemy.x < playerInstance.x + 50) {
            gameOver();
        }

        if (enemy.x + enemy.width < 0) {
            enemies.splice(i, 1);
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update(deltaTime);
        // Projectile hit logic moved to create blood at location?
        // Actually, we remove enemy immediately for gameplay flow, 
        // so projectile just flies off or we could fake a hit effect when it reaches target spot.
        // For 'gritty' feel, maybe instant hitscan is better?
        // Let's keep projectile visual but spawn blood immediately at enemy location for responsiveness.
        // Or make projectile travel fast.

        // Since we removed enemy already, we can just let projectile fly off screen or fizzle.
        // Let's just remove projectile if it goes off screen.
        if (p.x > canvas.width) p.active = false;

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
        const dx = (Math.random() - 0.5) * screenShake;
        const dy = (Math.random() - 0.5) * screenShake;
        ctx.translate(dx, dy);
    }

    if (images.bg && images.bg.complete) {
        ctx.drawImage(images.bg, bgX, 0, canvas.width, canvas.height);
        ctx.drawImage(images.bg, bgX + canvas.width, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#1a1510'; // Dark gritty brown fallback
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

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
    if (assetsLoaded < totalAssets) {
        console.warn("Starting with potential missing assets");
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
