// 游戏常量
// --- 修改以下常量 ---
const GRID_COLS = 10;
const GRID_ROWS = 20;
// 将 BLOCK_SIZE 从 50 缩小到 30，这样在手机上更合适
const BLOCK_SIZE = 30; 
const LOGICAL_CANVAS_WIDTH = GRID_COLS * BLOCK_SIZE;
const LOGICAL_CANVAS_HEIGHT = GRID_ROWS * BLOCK_SIZE;
// 下一个方块预览也缩小一点
const NEXT_LOGICAL_SIZE = 120; 

// ... 其余代码保持不变 ...

// 获取 canvas 元素
const canvas = document.getElementById('tetris-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

// UI 元素缓存
const ui = {
    score: document.getElementById('score'),
    lines: document.getElementById('lines'),
    level: document.getElementById('level'),
    startBtn: document.getElementById('start-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    resetBtn: document.getElementById('reset-btn'),
    soundToggleBtn: document.getElementById('sound-toggle-btn'),
    musicToggleBtn: document.getElementById('music-toggle-btn'),
    // 移动端控制按钮
    rotateBtn: document.getElementById('rotate-btn'),
    leftBtn: document.getElementById('left-btn'),
    rightBtn: document.getElementById('right-btn'),
    downBtn: document.getElementById('down-btn'),
    spaceBtn: document.getElementById('space-btn'),
};

// 高 DPI 适配
function fixCanvasDPR(canvasEl, context, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvasEl.style.width = width + 'px';
    canvasEl.style.height = height + 'px';
    canvasEl.width = Math.round(width * dpr);
    canvasEl.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setupCanvases() {
    fixCanvasDPR(canvas, ctx, LOGICAL_CANVAS_WIDTH, LOGICAL_CANVAS_HEIGHT);
    fixCanvasDPR(nextCanvas, nextCtx, NEXT_LOGICAL_SIZE, NEXT_LOGICAL_SIZE);
}

// 音效系统
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let soundEnabled = true;
let musicEnabled = true;
let bgAudioNodes = [];
let bgLoopTimer = null;
let backgroundMusicPlaying = false;

function playSound(frequency, duration, type = 'sine') {
    if (!soundEnabled) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

const sounds = {
    move: () => playSound(200, 0.05, 'square'),
    rotate: () => playSound(300, 0.08, 'square'),
    drop: () => playSound(150, 0.1, 'square'),
    lineClear: () => {
        playSound(400, 0.1, 'sine');
        setTimeout(() => playSound(500, 0.1, 'sine'), 50);
        setTimeout(() => playSound(600, 0.15, 'sine'), 100);
    },
    gameOver: () => {
        playSound(500, 0.2, 'sawtooth');
        setTimeout(() => playSound(400, 0.2, 'sawtooth'), 150);
        setTimeout(() => playSound(300, 0.3, 'sawtooth'), 300);
    },
    levelUp: () => {
        playSound(400, 0.08, 'sine');
        setTimeout(() => playSound(500, 0.08, 'sine'), 60);
        setTimeout(() => playSound(700, 0.15, 'sine'), 120);
    }
};

function playBackgroundMusic() {
    if (!musicEnabled || !gameRunning || backgroundMusicPlaying) return;
    const melody = [
        { freq: 659, duration: 0.4 }, { freq: 494, duration: 0.2 },
        { freq: 523, duration: 0.2 }, { freq: 587, duration: 0.4 },
        { freq: 523, duration: 0.2 }, { freq: 494, duration: 0.2 },
        { freq: 440, duration: 0.4 }, { freq: 440, duration: 0.2 },
        { freq: 523, duration: 0.2 }, { freq: 659, duration: 0.4 },
        { freq: 587, duration: 0.2 }, { freq: 523, duration: 0.2 },
        { freq: 494, duration: 0.6 },
    ];
    backgroundMusicPlaying = true;
    bgAudioNodes = [];
    const startTime = audioContext.currentTime + 0.05;
    let cumulative = 0;
    for (let i = 0; i < melody.length; i++) {
        const note = melody[i];
        const noteStart = startTime + cumulative;
        const noteEnd = noteStart + note.duration;
        if (!musicEnabled || !gameRunning) break;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'square';
        oscillator.frequency.value = note.freq;
        gainNode.gain.setValueAtTime(0.0001, noteStart);
        gainNode.gain.exponentialRampToValueAtTime(0.03, noteStart + 0.01);
        gainNode.gain.setValueAtTime(0.03, noteStart);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteEnd + 0.01);
        bgAudioNodes.push({ oscillator, gainNode });
        cumulative += note.duration;
    }
    const totalMs = Math.round(cumulative * 1000);
    if (bgLoopTimer) clearTimeout(bgLoopTimer);
    bgLoopTimer = setTimeout(() => {
        backgroundMusicPlaying = false;
        if (musicEnabled && gameRunning) playBackgroundMusic();
    }, totalMs);
}

function stopBackgroundMusic() {
    if (bgAudioNodes) {
        bgAudioNodes.forEach(({ oscillator, gainNode }) => {
            try { oscillator.stop(); } catch (e) {}
            try { oscillator.disconnect(); gainNode.disconnect(); } catch (e) {}
        });
        bgAudioNodes = [];
    }
    if (bgLoopTimer) clearTimeout(bgLoopTimer);
    backgroundMusicPlaying = false;
}

// 俄罗斯方块定义
const SHAPES = [
    { matrix: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], colorIndex: 1 },
    { matrix: [[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]], colorIndex: 2 },
    { matrix: [[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]], colorIndex: 3 },
    { matrix: [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]], colorIndex: 4 },
    { matrix: [[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]], colorIndex: 5 },
    { matrix: [[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]], colorIndex: 6 },
    { matrix: [[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]], colorIndex: 7 }
];

const COLOR_LOOKUP = [
    'rgb(0,0,0)', 'rgb(0,255,255)', 'rgb(0,0,255)', 'rgb(255,165,0)',
    'rgb(255,255,0)', 'rgb(0,255,0)', 'rgb(128,0,128)', 'rgb(255,0,0)'
];

// 核心逻辑函数
function rotate(matrix) {
    const size = 4;
    const rotated = [];
    for (let i = 0; i < size; i++) {
        rotated[i] = [];
        for (let j = 0; j < size; j++) {
            rotated[i][j] = matrix[size - 1 - j][i];
        }
    }
    return rotated;
}

function collide(matrix, offset, grid) {
    for (let row = 0; row < matrix.length; row++) {
        for (let col = 0; col < matrix[row].length; col++) {
            if (matrix[row][col] !== 0) {
                const x = offset.x + col;
                const y = offset.y + row;
                if (x < 0 || x >= GRID_COLS || y >= GRID_ROWS || (y >= 0 && grid[y][x] !== 0)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function merge() {
    const matrix = currentPiece.matrix;
    const colorIndex = currentPiece.colorIndex;
    for (let row = 0; row < matrix.length; row++) {
        for (let col = 0; col < matrix[row].length; col++) {
            if (matrix[row][col] !== 0) {
                const x = currentPosition.x + col;
                const y = currentPosition.y + row;
                if (y >= 0 && y < GRID_ROWS && x >= 0 && x < GRID_COLS) {
                    grid[y][x] = colorIndex;
                }
            }
        }
    }
    
    let linesCleared = 0;
    for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (grid[row].every(cell => cell !== 0)) {
            grid.splice(row, 1);
            grid.unshift(new Array(GRID_COLS).fill(0));
            linesCleared++;
            row++;
        }
    }
    
    sounds.drop();
    if (linesCleared > 0) {
        const oldLevel = level.value;
        score.value += linesCleared * 10;
        lines.value += linesCleared;
        level.value = Math.floor(lines.value / 10) + 1;
        sounds.lineClear();
        if (level.value > oldLevel) sounds.levelUp();
        ui.score.textContent = score.value;
        ui.lines.textContent = lines.value;
        ui.level.textContent = level.value;
        dropInterval = Math.max(100, 1000 - (level.value - 1) * 100);
    }

    const newPieceData = nextPiece;
    const gameOver = collide(newPieceData.matrix, newPieceData.pos, grid);
    return { nextPiece: newPieceData, newNextPiece: getPiece(), gameOver: gameOver };
}

// 游戏控制
let grid = [], currentPiece = null, nextPiece = null, currentPosition = {x:0, y:0};
let score = {value:0}, lines = {value:0}, level = {value:1}, lastTime = 0;
let dropInterval = 1000, gameRunning = false, gamePaused = false, animationFrameId = null;

function initGrid() {
    grid = Array.from({length: GRID_ROWS}, () => new Array(GRID_COLS).fill(0));
}

function getPiece() {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    return { matrix: shape.matrix.map(row => [...row]), colorIndex: shape.colorIndex, pos: {x:3, y:0} };
}

function drawBlock(x, y, color, context = ctx, blockSize = BLOCK_SIZE) {
    context.fillStyle = color;
    context.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
    context.strokeStyle = '#000';
    context.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
}

function draw() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, LOGICAL_CANVAS_WIDTH, LOGICAL_CANVAS_HEIGHT);
    grid.forEach((row, y) => row.forEach((value, x) => {
        if (value !== 0) drawBlock(x, y, COLOR_LOOKUP[value]);
    }));
    if (currentPiece) {
        currentPiece.matrix.forEach((row, y) => row.forEach((value, x) => {
            if (value !== 0) drawBlock(currentPosition.x + x, currentPosition.y + y, COLOR_LOOKUP[currentPiece.colorIndex]);
        }));
    }
    // 绘制预览
    nextCtx.fillStyle = '#111';
    nextCtx.fillRect(0, 0, NEXT_LOGICAL_SIZE, NEXT_LOGICAL_SIZE);
    if (nextPiece) {
        nextPiece.matrix.forEach((row, y) => row.forEach((value, x) => {
            if (value !== 0) drawBlock(x + 0.5, y + 0.5, COLOR_LOOKUP[nextPiece.colorIndex], nextCtx, 45);
        }));
    }
}

function update(timestamp) {
    if (!gameRunning) return;
    if (!gamePaused) {
        const deltaTime = timestamp - lastTime;
        if (deltaTime >= dropInterval) {
            moveDown();
            lastTime = timestamp;
        }
    }
    draw();
    animationFrameId = requestAnimationFrame(update);
}

// 动作函数
function moveLeft() {
    if (!gameRunning || gamePaused) return;
    if (!collide(currentPiece.matrix, {x: currentPosition.x - 1, y: currentPosition.y}, grid)) {
        currentPosition.x--;
        sounds.move();
    }
}

function moveRight() {
    if (!gameRunning || gamePaused) return;
    if (!collide(currentPiece.matrix, {x: currentPosition.x + 1, y: currentPosition.y}, grid)) {
        currentPosition.x++;
        sounds.move();
    }
}

function moveDown() {
    if (!gameRunning || gamePaused) return;
    const nextPos = {x: currentPosition.x, y: currentPosition.y + 1};
    if (!collide(currentPiece.matrix, nextPos, grid)) {
        currentPosition.y++;
    } else {
        const result = merge();
        if (result.gameOver) {
            gameRunning = false;
            stopBackgroundMusic();
            sounds.gameOver();
            showGameOver();
        } else {
            currentPiece = result.nextPiece;
            currentPosition = result.nextPiece.pos;
            nextPiece = result.newNextPiece;
        }
        lastTime = performance.now();
    }
}

function rotatePiece() {
    if (!gameRunning || gamePaused) return;
    const rotated = rotate(currentPiece.matrix);
    const kicks = [0, -1, 1, -2, 2];
    for (let k of kicks) {
        if (!collide(rotated, {x: currentPosition.x + k, y: currentPosition.y}, grid)) {
            currentPiece.matrix = rotated;
            currentPosition.x += k;
            sounds.rotate();
            return;
        }
    }
}

function hardDrop() {
    if (!gameRunning || gamePaused) return;
    while (!collide(currentPiece.matrix, {x: currentPosition.x, y: currentPosition.y + 1}, grid)) {
        currentPosition.y++;
    }
    moveDown();
}

function showGameOver() {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:1000;";
    overlay.innerHTML = `<div style="background:#1e3c72;padding:40px;border-radius:15px;text-align:center;color:white;border:3px solid #e94560;">
        <h2>游戏结束</h2><p>分数: ${score.value}</p>
        <button id="restart-game-btn" style="margin-top:20px;padding:10px 20px;background:#e94560;border:none;color:white;border-radius:5px;cursor:pointer;">重新开始</button>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById('restart-game-btn').onclick = () => {
        document.body.removeChild(overlay);
        initGame();
    };
}

function initGame() {
    initGrid();
    score.value = 0; lines.value = 0; level.value = 1; dropInterval = 1000;
    ui.score.textContent = "0"; ui.lines.textContent = "0"; ui.level.textContent = "1";
    currentPiece = getPiece();
    nextPiece = getPiece();
    currentPosition = currentPiece.pos;
    gameRunning = true; gamePaused = false;
    lastTime = performance.now();
    stopBackgroundMusic();
    if (musicEnabled) playBackgroundMusic();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(update);
}

// 事件绑定
document.addEventListener('DOMContentLoaded', () => {
    setupCanvases();
    initGrid();
    draw();

    ui.startBtn.onclick = async () => {
        try { await audioContext.resume(); } catch(e) {}
        if (!gameRunning) initGame();
    };

    ui.pauseBtn.onclick = () => {
        if (!gameRunning) return;
        gamePaused = !gamePaused;
        ui.pauseBtn.textContent = gamePaused ? "继续" : "暂停";
        gamePaused ? stopBackgroundMusic() : (musicEnabled && playBackgroundMusic(), lastTime = performance.now());
    };

    ui.resetBtn.onclick = () => { gameRunning = false; stopBackgroundMusic(); initGame(); };

    // 移动端按钮绑定
    ui.leftBtn.onclick = moveLeft;
    ui.rightBtn.onclick = moveRight;
    ui.downBtn.onclick = moveDown;
    ui.rotateBtn.onclick = rotatePiece;
    if (ui.spaceBtn) ui.spaceBtn.onclick = hardDrop;

    // 音效控制
    ui.soundToggleBtn.onclick = () => {
        soundEnabled = !soundEnabled;
        ui.soundToggleBtn.textContent = soundEnabled ? "🔊 音效" : "🔇 音效";
    };
    ui.musicToggleBtn.onclick = () => {
        musicEnabled = !musicEnabled;
        ui.musicToggleBtn.textContent = musicEnabled ? "🎵 音乐" : "🔇 音乐";
        musicEnabled && gameRunning && !gamePaused ? playBackgroundMusic() : stopBackgroundMusic();
    };

    // 键盘支持
    document.onkeydown = (e) => {
        if (!gameRunning || gamePaused) return;
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
        if (e.key === 'ArrowLeft') moveLeft();
        if (e.key === 'ArrowRight') moveRight();
        if (e.key === 'ArrowDown') moveDown();
        if (e.key === 'ArrowUp') rotatePiece();
        if (e.key === ' ') hardDrop();
    };
});
