const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRAVITY = 0.25;
const FLAP_FORCE = -4.5; // Slightly stronger for premium feel
const PIPE_SPEED = 2.5; // Smooth scrolling
const PIPE_SPAWN_RATE = 120; // Frames
const PIPE_GAP = 170; // Generous gap for playability
const BIRD_SCALE = 0.12; // Adjust based on asset size
const PIPE_WIDTH = 60;

// Game State
let currentState = 'START'; // START, PLAYING, GAMEOVER
let frames = 0;
let score = 0;
let highScore = localStorage.getItem('flappyHighScore') || 0;

// Update High Score Display
document.getElementById('best-score').innerText = highScore;

// Images
const birdImg = new Image();
birdImg.src = 'bird.png';

const bgImg = new Image();
bgImg.src = 'background.png';

const pipeImg = new Image();
pipeImg.src = 'pipe.png';

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const scoreDisplay = document.getElementById('current-score');
const finalScoreDisplay = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Resize Handling
function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resize);
resize();

// Objects
const bird = {
    x: 50,
    y: 150,
    w: 40, // Collision box width
    h: 30, // Collision box height
    radius: 15,
    velocity: 0,
    rotation: 0,

    draw: function () {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Draw image centered
        if (birdImg.complete) {
            // Maintain aspect ratio or just strict scale? Let's use strict scale for consistency
            // Assuming bird sprite is roughly square-ish or provided one.
            // Using a hardcoded size for rendering relative to the collision box
            let displaySize = 50;
            ctx.drawImage(birdImg, -displaySize / 2, -displaySize / 2, displaySize, displaySize);
        } else {
            // Fallback
            ctx.fillStyle = '#ff9f43';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    },

    flap: function () {
        this.velocity = FLAP_FORCE;
        this.rotation = -25 * Math.PI / 180;
    },

    update: function () {
        this.velocity += GRAVITY;
        this.y += this.velocity;

        // Rotation physics
        if (this.velocity < 0) {
            this.rotation = -25 * Math.PI / 180;
        } else {
            this.rotation += 0.04; // Slowly rotate down
            if (this.rotation > 90 * Math.PI / 180) {
                this.rotation = 90 * Math.PI / 180;
            }
        }

        // Floor collision
        if (this.y + this.radius >= canvas.height) {
            this.y = canvas.height - this.radius;
            gameOver();
        }
    }
};

const pipes = {
    items: [],

    draw: function () {
        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];

            // Draw Top Pipe
            // We use the same pipe image, but flipped for the top? 
            // Or just draw it normally if it's a generic texture.
            // For a top pipe with a rim, we need to flip it vertically.

            ctx.save();
            // Top Pipe
            ctx.translate(p.x, p.y);
            ctx.scale(1, -1); // Flip vertical

            if (pipeImg.complete) {
                ctx.drawImage(pipeImg, 0, 0, PIPE_WIDTH, p.y);
                // Note: The pipe asset might be stretched. 
                // Ideally we tile it or use 9-slice, but stretching is standard for simple flappy birds.
            } else {
                ctx.fillStyle = '#2ecc71';
                ctx.fillRect(0, 0, PIPE_WIDTH, p.y);
            }
            ctx.restore();

            // Bottom Pipe
            ctx.save();
            ctx.translate(p.x, p.y + PIPE_GAP);

            if (pipeImg.complete) {
                ctx.drawImage(pipeImg, 0, 0, PIPE_WIDTH, canvas.height - (p.y + PIPE_GAP));
            } else {
                ctx.fillStyle = '#2ecc71';
                ctx.fillRect(0, 0, PIPE_WIDTH, canvas.height - (p.y + PIPE_GAP));
            }
            ctx.restore();
        }
    },

    update: function () {
        // Spawn pipes
        if (frames % PIPE_SPAWN_RATE === 0) {
            // Calculate random Y for the gap.
            // Gap should be within reasonable bounds.
            // Minimal pipe height for top and bottom.
            const minPipeLen = 50;
            const maxPos = canvas.height - minPipeLen - PIPE_GAP;
            const minPos = minPipeLen;
            const y = Math.floor(Math.random() * (maxPos - minPos + 1)) + minPos;

            this.items.push({
                x: canvas.width,
                y: y,
                passed: false
            });
        }

        // Move pipes
        for (let i = 0; i < this.items.length; i++) {
            this.items[i].x -= PIPE_SPEED;

            // Score update
            if (this.items[i].x + PIPE_WIDTH < bird.x && !this.items[i].passed) {
                score++;
                scoreDisplay.innerText = score;
                this.items[i].passed = true;
            }

            // Collision Logic
            // Simply interacting with the gap logic
            // Bird is within pipe horizontal area
            if (
                bird.x + bird.radius > this.items[i].x &&
                bird.x - bird.radius < this.items[i].x + PIPE_WIDTH
            ) {
                // Bird is hitting top pipe OR bottom pipe
                // Top pipe Y range: 0 to this.items[i].y
                // Bottom pipe Y range: this.items[i].y + PIPE_GAP to canvas.height

                if (
                    bird.y - bird.radius < this.items[i].y ||
                    bird.y + bird.radius > this.items[i].y + PIPE_GAP
                ) {
                    gameOver();
                }
            }

            // Remove off-screen pipes
            if (this.items[i].x + PIPE_WIDTH < 0) {
                this.items.shift();
                i--;
            }
        }
    }
};

const background = {
    x: 0,
    speed: 1, // Parallax effect (slower than pipes)

    draw: function () {
        if (bgImg.complete) {
            // Background aspect fill
            // We want it to loop.
            // Use 2 images scrolling.
            const aspect = bgImg.width / bgImg.height;
            const bgHeight = canvas.height;
            const bgWidth = bgHeight * aspect;

            // We might need to tile it horizontally if one image isn't enough to cover the screen
            // But let's assume we draw it twice for looping.

            let drawX = this.x % bgWidth;
            if (drawX > 0) drawX -= bgWidth; // Ensure negative starting point for seamlessness

            // Draw enough copies to fill the screen
            for (let i = 0; i < (canvas.width / bgWidth) + 2; i++) {
                ctx.drawImage(bgImg, drawX + i * bgWidth, 0, bgWidth, bgHeight);
            }

        } else {
            ctx.fillStyle = '#70c5ce';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    },

    update: function () {
        this.x -= this.speed;
    }
}

// Controls
function flap() {
    if (currentState === 'PLAYING') {
        bird.flap();
    } else if (currentState === 'START') {
        startGame();
    }
}

document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
        flap();
    }
});

canvas.addEventListener('click', flap);
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);

function startGame() {
    currentState = 'PLAYING';
    startScreen.classList.remove('active');
    startScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    bird.flap();
}

function gameOver() {
    currentState = 'GAMEOVER';
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    gameOverScreen.classList.add('active');

    finalScoreDisplay.innerText = score;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('flappyHighScore', highScore);
    }
    document.getElementById('best-score').innerText = highScore;
}

function resetGame() {
    bird.y = 150;
    bird.velocity = 0;
    bird.rotation = 0;
    pipes.items = [];
    score = 0;
    frames = 0;
    scoreDisplay.innerText = 0;

    currentState = 'START';
    gameOverScreen.classList.add('hidden');
    gameOverScreen.classList.remove('active');
    startScreen.classList.remove('hidden');
    startScreen.classList.add('active');
}

// Loop
function loop() {
    // Update
    background.update(); // Background always scrolls for life

    if (currentState === 'PLAYING') {
        bird.update();
        pipes.update();
        frames++;
    } else if (currentState === 'START') {
        // Bobbing animation for bird in start screen
        bird.y = 150 + Math.sin(Date.now() / 300) * 5;
    }

    // Draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    background.draw();
    pipes.draw();
    bird.draw();

    requestAnimationFrame(loop);
}

// Start Loop
loop();
