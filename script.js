// 游戏常量
const GRID_COLS = 10;
const GRID_ROWS = 20;
const BLOCK_SIZE = 50;
// 逻辑尺寸（CSS 像素 / 游戏坐标系使用的尺寸）
const LOGICAL_CANVAS_WIDTH = GRID_COLS * BLOCK_SIZE;
const LOGICAL_CANVAS_HEIGHT = GRID_ROWS * BLOCK_SIZE;
const NEXT_LOGICAL_SIZE = 200;

// 获取 canvas 元素和 2D 绘图上下文
const canvas = document.getElementById('tetris-canvas');
const ctx = canvas.getContext('2d');

// 获取下一个方块预览的 canvas
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

// 常用 UI 元素缓存（减少重复查询）
const ui = {
    score: document.getElementById('score'),
    lines: document.getElementById('lines'),
    level: document.getElementById('level'),
    startBtn: document.getElementById('start-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    resetBtn: document.getElementById('reset-btn'),
    soundToggleBtn: document.getElementById('sound-toggle-btn'),
    musicToggleBtn: document.getElementById('music-toggle-btn'),
    rotateBtn: document.getElementById('rotate-btn'),
    leftBtn: document.getElementById('left-btn'),
    rightBtn: document.getElementById('right-btn'),
    downBtn: document.getElementById('down-btn'),
};

// 高 DPI (Retina) 画布适配：根据 devicePixelRatio 调整画布实际像素
function fixCanvasDPR(canvasEl, context, width, height) {
    const dpr = window.devicePixelRatio || 1;
    // 设置样式尺寸为逻辑像素
    canvasEl.style.width = width + 'px';
    canvasEl.style.height = height + 'px';
    // 设置真实像素尺寸
    canvasEl.width = Math.round(width * dpr);
    canvasEl.height = Math.round(height * dpr);
    // 将绘图上下文的坐标系缩放到逻辑像素坐标系
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// 一次性设置所有画布尺寸（用于初始化和窗口调整）
function setupCanvases() {
    fixCanvasDPR(canvas, ctx, LOGICAL_CANVAS_WIDTH, LOGICAL_CANVAS_HEIGHT);
    // nextCanvas 的逻辑尺寸（与 index.html 中的 200 对应）
    fixCanvasDPR(nextCanvas, nextCtx, NEXT_LOGICAL_SIZE, NEXT_LOGICAL_SIZE);
}



// 音效系统
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let soundEnabled = true;
let musicEnabled = true;
// 背景音乐定时器跟踪与播放状态
// 已调度的 WebAudio 节点（用于在停止时清理）
let bgAudioNodes = [];
let bgLoopTimer = null;
let backgroundMusicPlaying = false;

// 播放音效函数
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

// 不同游戏事件的音效
const sounds = {
    move: () => playSound(200, 0.05, 'square'),
    rotate: () => playSound(300, 0.08, 'square'),
    drop: () => playSound(150, 0.1, 'square'),
    lineClear: () => {
        // 消行音效 - 上升音调
        playSound(400, 0.1, 'sine');
        setTimeout(() => playSound(500, 0.1, 'sine'), 50);
        setTimeout(() => playSound(600, 0.15, 'sine'), 100);
    },
    gameOver: () => {
        // 游戏结束音效 - 下降音调
        playSound(500, 0.2, 'sawtooth');
        setTimeout(() => playSound(400, 0.2, 'sawtooth'), 150);
        setTimeout(() => playSound(300, 0.3, 'sawtooth'), 300);
    },
    levelUp: () => {
        // 升级音效 - 快速上升音调
        playSound(400, 0.08, 'sine');
        setTimeout(() => playSound(500, 0.08, 'sine'), 60);
        setTimeout(() => playSound(700, 0.15, 'sine'), 120);
    }
};

// 简单的背景音乐（俄罗斯方块主题旋律片段）
function playBackgroundMusic() {
    // 防止重复启动
    if (!musicEnabled || !gameRunning || backgroundMusicPlaying) return;

    const melody = [
        { freq: 659, duration: 0.4 },  // E
        { freq: 494, duration: 0.2 },  // B
        { freq: 523, duration: 0.2 },  // C
        { freq: 587, duration: 0.4 },  // D
        { freq: 523, duration: 0.2 },  // C
        { freq: 494, duration: 0.2 },  // B
        { freq: 440, duration: 0.4 },  // A
        { freq: 440, duration: 0.2 },  // A
        { freq: 523, duration: 0.2 },  // C
        { freq: 659, duration: 0.4 },  // E
        { freq: 587, duration: 0.2 },  // D
        { freq: 523, duration: 0.2 },  // C
        { freq: 494, duration: 0.6 },  // B
    ];
    // 使用 AudioContext 的时间基准调度每个音符，保证精确播放
    backgroundMusicPlaying = true;
    bgAudioNodes = [];

    const startTime = audioContext.currentTime + 0.05; // 轻微延迟以确保调度
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

    // 使用单一定时器在 melody 完成后触发下一轮循环调度
    const totalMs = Math.round(cumulative * 1000);
    if (bgLoopTimer) {
        clearTimeout(bgLoopTimer);
        bgLoopTimer = null;
    }
    bgLoopTimer = setTimeout(() => {
        backgroundMusicPlaying = false;
        if (musicEnabled && gameRunning) playBackgroundMusic();
    }, totalMs);
}

// 停止背景音乐
function stopBackgroundMusic() {
    // 停止并断开所有已调度的 Audio 节点
    if (bgAudioNodes && bgAudioNodes.length > 0) {
        bgAudioNodes.forEach(({ oscillator, gainNode }) => {
            try {
                oscillator.stop();
            } catch (e) { /* ignore if already stopped */ }
            try { oscillator.disconnect(); } catch (e) {}
            try { gainNode.disconnect(); } catch (e) {}
        });
        bgAudioNodes = [];
    }

    // 清理循环定时器
    if (bgLoopTimer) {
        clearTimeout(bgLoopTimer);
        bgLoopTimer = null;
    }

    backgroundMusicPlaying = false;
}

// 响应式Canvas缩放函数
function adjustCanvasScale() {
    const gameArea = document.querySelector('.game-area');
    if (!gameArea) return;

    // 获取容器的可用宽度和高度
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    // 计算Canvas需要的最小空间（加上一些边距）
    // 注意：canvas.width/height 是物理像素；这里应使用逻辑尺寸来计算布局
    const minWidth = LOGICAL_CANVAS_WIDTH + 40; // 40px边距
    const minHeight = LOGICAL_CANVAS_HEIGHT + 100; // 标题和边距

    // 计算缩放比例
    let scale = 1;

    // 如果屏幕宽度不足，按宽度缩放
    if (containerWidth < minWidth) {
        scale = Math.min(scale, (containerWidth - 40) / LOGICAL_CANVAS_WIDTH);
    }

    // 如果屏幕高度不足，按高度缩放
    if (containerHeight < minHeight) {
        scale = Math.min(scale, (containerHeight - 100) / LOGICAL_CANVAS_HEIGHT);
    }

    // 应用缩放（最小缩放到0.5，避免太小）
    scale = Math.max(0.5, scale);

    // 使用CSS transform缩放Canvas
    canvas.style.transform = `scale(${scale})`;
    canvas.style.transformOrigin = 'top center';
}

// 俄罗斯方块形状定义
const SHAPES = [
    // I 形状（直线）
    {
        matrix: [
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        colorIndex: 1 // 青色
    },
    // J 形状
    {
        matrix: [
            [1, 0, 0, 0],
            [1, 1, 1, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        colorIndex: 2 // 蓝色
    },
    // L 形状
    {
        matrix: [
            [0, 0, 1, 0],
            [1, 1, 1, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        colorIndex: 3 // 橙色
    },
    // O 形状（方块）
    {
        matrix: [
            [0, 1, 1, 0],
            [0, 1, 1, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        colorIndex: 4 // 黄色
    },
    // S 形状
    {
        matrix: [
            [0, 1, 1, 0],
            [1, 1, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        colorIndex: 5 // 绿色
    },
    // T 形状
    {
        matrix: [
            [0, 1, 0, 0],
            [1, 1, 1, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        colorIndex: 6 // 紫色
    },
    // Z 形状
    {
        matrix: [
            [1, 1, 0, 0],
            [0, 1, 1, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        colorIndex: 7 // 红色
    }
];

// 颜色查找表
const COLOR_LOOKUP = [
    'rgb(0, 0, 0)',        // 0 - 黑色（空白）
    'rgb(0, 255, 255)',    // 1 - 青色（I 形状）
    'rgb(0, 0, 255)',      // 2 - 蓝色（J 形状）
    'rgb(255, 165, 0)',   // 3 - 橙色（L 形状）
    'rgb(255, 255, 0)',   // 4 - 黄色（O 形状）
    'rgb(0, 255, 0)',     // 5 - 绿色（S 形状）
    'rgb(128, 0, 128)',   // 6 - 紫色（T 形状）
    'rgb(255, 0, 0)'      // 7 - 红色（Z 形状）
];

// 矩阵顺时针旋转 90 度（针对 4x4 矩阵）
function rotate(matrix) {
    // 假设输入是 4x4 矩阵
    const size = 4;
    const rotated = [];
    
    // 初始化旋转后的矩阵
    for (let i = 0; i < size; i++) {
        rotated[i] = [];
        for (let j = 0; j < size; j++) {
            // 顺时针旋转 90 度公式：
            // 新矩阵的 [i][j] = 原矩阵的 [size-1-j][i]
            // 这相当于：先转置，然后水平翻转
            rotated[i][j] = matrix[size - 1 - j][i];
        }
    }
    
    return rotated;
}

// 检查方块是否与地图或边界发生碰撞
function collide(matrix, offset, grid) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    
    // 遍历矩阵中的每个元素
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // 如果当前位置有方块（非零）
            if (matrix[row][col] !== 0) {
                // 计算在游戏网格中的实际位置
                const x = offset.x + col;
                const y = offset.y + row;
                
                // 检查是否超出 Canvas 左边界或右边界
                if (x < 0 || x >= GRID_COLS) {
                    return true; // 碰撞
                }
                
                // 检查是否超出 Canvas 下边界
                if (y >= GRID_ROWS) {
                    return true; // 碰撞
                }
                
                // 检查是否与地图（grid）中已放置的方块碰撞
                // 注意：如果 y < 0（顶部边界外），不需要检查固定方块，允许方块从上方进入
                if (y >= 0 && grid[y][x] !== 0) {
                    return true; // 碰撞
                }
            }
        }
    }
    
    return false; // 无碰撞，位置合法
}

// merge() 函数：处理方块锁定和消行逻辑
function merge() {
    const matrix = currentPiece.matrix;
    const colorIndex = currentPiece.colorIndex;
    const rows = matrix.length;
    const cols = matrix[0].length;
    
    // 1. 将当前方块固定到全局 grid 数组中
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (matrix[row][col] !== 0) {
                const x = currentPosition.x + col;
                const y = currentPosition.y + row;
                
                // 只处理在有效范围内的方块
                if (y >= 0 && y < GRID_ROWS && x >= 0 && x < GRID_COLS) {
                    // 存储颜色索引到 grid 中
                    grid[y][x] = colorIndex;
                }
            }
        }
    }
    
    // 2. 遍历 grid，检查并清除满行，更新 score
    let linesCleared = 0;
    for (let row = GRID_ROWS - 1; row >= 0; row--) {
        // 检查当前行是否满行（所有格子都不为 0）
        let isFull = true;
        for (let col = 0; col < GRID_COLS; col++) {
            if (grid[row][col] === 0) {
                isFull = false;
                break;
            }
        }
        
        // 3. 如果有满行，清除该行，并从 grid 顶部添加新空行
        if (isFull) {
            // 删除满行
            grid.splice(row, 1);
            // 从顶部添加新空行
            grid.unshift(new Array(GRID_COLS).fill(0));
            linesCleared++;
            row++; // 重新检查当前行（因为删除了这一行，下面的行上移了）
        }
    }
    
    // 方块锁定音效
    sounds.drop();

    // 更新分数和统计（每清除一行加 10 分）
    if (linesCleared > 0) {
        const oldLevel = level.value;
        score.value += linesCleared * 10;
        lines.value += linesCleared;

        // 每消除10行提升一级
        level.value = Math.floor(lines.value / 10) + 1;

        // 播放消行音效
        sounds.lineClear();

        // 检查是否升级
        if (level.value > oldLevel) {
            sounds.levelUp();
        }

        // 更新页面显示（使用缓存 DOM 引用）
        if (ui.score) ui.score.textContent = score.value;
        if (ui.lines) ui.lines.textContent = lines.value;
        if (ui.level) ui.level.textContent = level.value;

        // 根据等级调整下落速度
        dropInterval = Math.max(100, 1000 - (level.value - 1) * 100);
    }

    // 4. 使用 nextPiece 作为新方块，并生成新的 nextPiece
    const newPieceData = nextPiece;
    const newNextPieceData = getPiece();

    // 检查游戏是否结束（新方块在初始位置是否碰撞）
    const gameOver = collide(newPieceData.matrix, newPieceData.pos, grid);

    return {
        nextPiece: newPieceData,
        newNextPiece: newNextPieceData,
        gameOver: gameOver,
        linesCleared: linesCleared
    };
}

// 游戏状态
let grid = [];
let currentPiece = null;
let nextPiece = null;
let currentPosition = { x: 0, y: 0 };
let score = { value: 0 };
let lines = { value: 0 };
let level = { value: 1 };
let lastTime = 0;
let dropInterval = 1000; // 每1000毫秒（1秒）下落一次
let gameRunning = false;
let gamePaused = false;
let animationFrameId = null;

// 初始化游戏网格
function initGrid() {
    grid = [];
    for (let row = 0; row < GRID_ROWS; row++) {
        grid[row] = new Array(GRID_COLS).fill(0);
    }
}

// 获取新方块：从 SHAPES 数组中随机选择，返回深拷贝矩阵和颜色索引
function getPiece() {
    // 从 SHAPES 数组中随机选择一个方块
    const shapeIndex = Math.floor(Math.random() * SHAPES.length);
    const selectedShape = SHAPES[shapeIndex];

    // 深拷贝矩阵，避免修改原始定义
    const matrix = selectedShape.matrix.map(row => [...row]);

    // 直接使用预定义的颜色索引（无需查找）
    const colorIndex = selectedShape.colorIndex;

    // 初始化方块的起始位置
    const pos = { x: 3, y: 0 };

    return {
        matrix: matrix,
        colorIndex: colorIndex,
        pos: pos
    };
}


// 绘制单个方块
function drawBlock(x, y, color, context = ctx, blockSize = BLOCK_SIZE) {
    context.fillStyle = color;
    context.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);

    // 绘制边框，增加立体感
    context.strokeStyle = '#000';
    context.lineWidth = 1;
    context.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);

    // 绘制高光效果
    context.fillStyle = 'rgba(255, 255, 255, 0.3)';
    context.fillRect(x * blockSize, y * blockSize, blockSize, blockSize / 3);
}

// 绘制下一个方块预览
function drawNextPiece() {
    // 清空预览画布
    nextCtx.fillStyle = '#111';
    // 注意：nextCanvas.width/height 是物理像素；绘制坐标系已被 setTransform 缩放为逻辑像素
    nextCtx.fillRect(0, 0, NEXT_LOGICAL_SIZE, NEXT_LOGICAL_SIZE);

    if (!nextPiece) return;

    const matrix = nextPiece.matrix;
    const colorIndex = nextPiece.colorIndex;
    const color = COLOR_LOOKUP[colorIndex];
    const previewBlockSize = 45;

    // 计算方块在预览画布中的居中位置
    const offsetX = (NEXT_LOGICAL_SIZE / previewBlockSize - 4) / 2;
    const offsetY = (NEXT_LOGICAL_SIZE / previewBlockSize - 4) / 2;

    // 绘制方块
    for (let row = 0; row < matrix.length; row++) {
        for (let col = 0; col < matrix[row].length; col++) {
            if (matrix[row][col] !== 0) {
                drawBlock(col + offsetX, row + offsetY, color, nextCtx, previewBlockSize);
            }
        }
    }
}

// 绘制函数：使用 Canvas API 渲染游戏
function draw() {
    // 清空画布背景
    ctx.fillStyle = '#111';
    // 注意：canvas.width/height 是物理像素；绘制坐标系已被 setTransform 缩放为逻辑像素
    ctx.fillRect(0, 0, LOGICAL_CANVAS_WIDTH, LOGICAL_CANVAS_HEIGHT);
    
    // 绘制网格线（可选，用于调试）
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let row = 0; row <= GRID_ROWS; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * BLOCK_SIZE);
        ctx.lineTo(LOGICAL_CANVAS_WIDTH, row * BLOCK_SIZE);
        ctx.stroke();
    }
    for (let col = 0; col <= GRID_COLS; col++) {
        ctx.beginPath();
        ctx.moveTo(col * BLOCK_SIZE, 0);
        ctx.lineTo(col * BLOCK_SIZE, LOGICAL_CANVAS_HEIGHT);
        ctx.stroke();
    }
    
    // 绘制 grid 地图（已固定的方块）
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const colorIndex = grid[row][col];
            if (colorIndex !== 0) {
                // 使用 COLOR_LOOKUP 数组来设置颜色
                const color = COLOR_LOOKUP[colorIndex];
                drawBlock(col, row, color);
            }
        }
    }
    
    // 绘制当前正在下落的 piece
    if (currentPiece && currentPosition) {
        const matrix = currentPiece.matrix;
        const colorIndex = currentPiece.colorIndex;
        // 使用 COLOR_LOOKUP 数组来设置颜色
        const color = COLOR_LOOKUP[colorIndex];

        // 遍历矩阵，绘制非零元素
        for (let row = 0; row < matrix.length; row++) {
            for (let col = 0; col < matrix[row].length; col++) {
                if (matrix[row][col] !== 0) {
                    const x = currentPosition.x + col;
                    const y = currentPosition.y + row;

                    // 只绘制在可见范围内的方块
                    if (y >= 0 && y < GRID_ROWS && x >= 0 && x < GRID_COLS) {
                        drawBlock(x, y, color);
                    }
                }
            }
        }
    }

    // 绘制下一个方块预览
    drawNextPiece();
}

// 主循环：使用 requestAnimationFrame 驱动游戏的计时和渲染
function update(timestamp) {
    // 如果游戏未运行，停止循环
    if (!gameRunning) {
        // 取消动画帧
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        return;
    }

    // 如果游戏暂停，只绘制当前状态，不更新游戏逻辑
    if (gamePaused) {
        draw();
        animationFrameId = requestAnimationFrame(update);
        return;
    }

    // 计算时间差
    const deltaTime = timestamp - lastTime;

    // 如果达到下落时间间隔，处理方块下落
    if (deltaTime >= dropInterval) {
        // 尝试向下移动方块
        const newPosition = {
            x: currentPosition.x,
            y: currentPosition.y + 1
        };

        // 检查是否可以下落（使用 collide 函数检查碰撞）
        if (!collide(currentPiece.matrix, newPosition, grid)) {
            // 可以下落，更新位置
            currentPosition = newPosition;
        } else {
            // 无法下落，锁定方块并处理消行
            const result = merge();

            // 处理 merge 结果，如果游戏结束则退出
            if (handleMergeResult(result)) {
                return;
            }
        }

        // 更新上次时间戳
        lastTime = timestamp;
    }

    // 使用 Canvas API 渲染游戏画面
    draw();

    // 继续循环
    animationFrameId = requestAnimationFrame(update);
}

// 移动方块向左
function moveLeft() {
    if (!gameRunning || gamePaused || !currentPiece) return;

    const newPosition = {
        x: currentPosition.x - 1,
        y: currentPosition.y
    };

    // 检查位置是否合法
    if (!collide(currentPiece.matrix, newPosition, grid)) {
        currentPosition = newPosition;
        sounds.move();
    }
}

// 移动方块向右
function moveRight() {
    if (!gameRunning || gamePaused || !currentPiece) return;

    const newPosition = {
        x: currentPosition.x + 1,
        y: currentPosition.y
    };

    // 检查位置是否合法
    if (!collide(currentPiece.matrix, newPosition, grid)) {
        currentPosition = newPosition;
        sounds.move();
    }
}

// 移动方块向下（加速下降）
function moveDown() {
    if (!gameRunning || gamePaused || !currentPiece) return;
    
    const newPosition = {
        x: currentPosition.x,
        y: currentPosition.y + 1
    };
    
    // 检查位置是否合法
    if (!collide(currentPiece.matrix, newPosition, grid)) {
        currentPosition = newPosition;
    } else {
        // 无法下落，锁定方块
        const result = merge();
        // 重置 lastTime：避免新方块生成后立刻因累积 deltaTime 触发下落
        lastTime = performance.now();

        // 处理 merge 结果，如果游戏结束则退出
        if (handleMergeResult(result)) {
            return;
        }
    }
}

// 旋转方块
function rotatePiece() {
    if (!gameRunning || gamePaused || !currentPiece) return;
    // 使用带 wall-kick 的旋转尝试
    if (tryRotateWithKick()) {
        sounds.rotate();
    }
}

// 尝试带 wall-kick 的旋转：在旋转后尝试若干水平偏移（从不偏移开始）
function tryRotateWithKick() {
    if (!currentPiece) return false;

    const rotated = rotate(currentPiece.matrix);

    // 尝试的偏移顺序（先不偏移，然后左右再更大的偏移）
    const kicks = [0, -1, 1, -2, 2];

    for (let k of kicks) {
        const testPos = { x: currentPosition.x + k, y: currentPosition.y };
        if (!collide(rotated, testPos, grid)) {
            currentPiece.matrix = rotated;
            currentPosition.x = testPos.x;
            return true;
        }
    }

    return false; // 所有尝试均失败
}

// 硬降：直接落下到底部
function hardDrop() {
    if (!gameRunning || gamePaused || !currentPiece) return;

    // 不断向下移动直到碰撞
    // 添加最大循环次数保护，防止无限循环导致浏览器冻结
    let iterations = 0;
    const maxIterations = GRID_ROWS; // 最多下落网格高度的行数

    while (iterations < maxIterations) {
        iterations++;

        const newPosition = {
            x: currentPosition.x,
            y: currentPosition.y + 1
        };

        if (collide(currentPiece.matrix, newPosition, grid)) {
            // 碰撞了，停止下落并锁定
            const result = merge();
            
            // 重置 lastTime 防止新方块立即下落
            lastTime = performance.now();

            // 处理 merge 结果，如果游戏结束则退出
            if (handleMergeResult(result)) {
                return;
            }
            break;
        } else {
            currentPosition = newPosition;
        }
    }

    // 如果达到最大迭代次数，记录警告（正常情况下不应该发生）
    if (iterations >= maxIterations) {
        console.warn('hardDrop: 达到最大迭代次数，强制退出循环');
    }
}

// 处理 merge 后的结果：统一处理游戏结束和新方块生成
function handleMergeResult(result) {
    if (result.gameOver) {
        // 游戏结束
        gameRunning = false;
        stopBackgroundMusic();
        sounds.gameOver();
        updateButtonStates();
        showGameOver();
        return true; // 返回 true 表示游戏结束
    }

    // 使用 nextPiece 作为当前方块，并生成新的 nextPiece
    currentPiece = result.nextPiece;
    currentPosition = result.nextPiece.pos;
    nextPiece = result.newNextPiece;

    return false; // 返回 false 表示游戏继续
}

// 更新按钮状态
function updateButtonStates() {
    if (ui.startBtn) {
        ui.startBtn.disabled = gameRunning;
        ui.startBtn.setAttribute('aria-disabled', gameRunning);
    }
    if (ui.pauseBtn) {
        ui.pauseBtn.disabled = !gameRunning;
        ui.pauseBtn.setAttribute('aria-disabled', !gameRunning);
        ui.pauseBtn.textContent = gamePaused ? '继续' : '暂停';
        ui.pauseBtn.setAttribute('aria-pressed', gamePaused);
    }
    if (ui.resetBtn) {
        ui.resetBtn.disabled = false;
        ui.resetBtn.setAttribute('aria-disabled', false);
    }
}

// 显示游戏结束弹窗
function showGameOver() {
    // 创建游戏结束弹窗
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
        padding: 40px;
        border-radius: 15px;
        text-align: center;
        box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5);
        border: 3px solid #e94560;
    `;

    modal.innerHTML = `
        <h2 style="color: #e94560; font-size: 36px; margin-bottom: 20px;">游戏结束！</h2>
        <p style="color: #fff; font-size: 24px; margin-bottom: 10px;">最终分数: <strong>${score.value}</strong></p>
        <p style="color: #fff; font-size: 20px; margin-bottom: 10px;">消除行数: <strong>${lines.value}</strong></p>
        <p style="color: #fff; font-size: 20px; margin-bottom: 30px;">最高等级: <strong>${level.value}</strong></p>
        <button id="restart-game-btn" style="
            padding: 15px 40px;
            font-size: 18px;
            font-weight: bold;
            color: #fff;
            background-color: #e94560;
            border: 2px solid #c73650;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        ">重新开始</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 添加重新开始按钮的事件监听
    document.getElementById('restart-game-btn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        initGame();
    });

    // 添加悬停效果
    const restartBtn = document.getElementById('restart-game-btn');
    restartBtn.addEventListener('mouseenter', () => {
        restartBtn.style.backgroundColor = '#ff5c7a';
        restartBtn.style.transform = 'translateY(-2px)';
    });
    restartBtn.addEventListener('mouseleave', () => {
        restartBtn.style.backgroundColor = '#e94560';
        restartBtn.style.transform = 'translateY(0)';
    });
}

// 初始化游戏
function initGame() {
    initGrid();
    score.value = 0;
    lines.value = 0;
    level.value = 1;
    dropInterval = 1000;

    // 更新页面显示（使用缓存 DOM 引用）
    if (ui.score) ui.score.textContent = score.value;
    if (ui.lines) ui.lines.textContent = lines.value;
    if (ui.level) ui.level.textContent = level.value;

    // 生成第一个方块和下一个方块
    const pieceData = getPiece();
    currentPiece = pieceData;
    currentPosition = pieceData.pos;
    nextPiece = getPiece();

    gameRunning = true;
    gamePaused = false;
    lastTime = performance.now();

    // 更新按钮状态
    updateButtonStates();

    // 播放背景音乐
    stopBackgroundMusic(); // 先停止之前的音乐
    if (musicEnabled) {
        playBackgroundMusic();
    }

    // 开始游戏循环
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(update);
}

// 页面加载完成后添加事件监听器
document.addEventListener('DOMContentLoaded', () => {
    // 开始游戏按钮
    if (ui.startBtn) {
        ui.startBtn.setAttribute('aria-label', '开始新游戏');
        ui.startBtn.addEventListener('click', async () => {
            // 在用户交互时恢复 AudioContext（某些浏览器在没有手势时将其置为 suspended）
            try { await audioContext.resume(); } catch (e) { /* ignore */ }
            if (!gameRunning) {
                initGame();
            }
        });
    }

    // 暂停按钮
    if (ui.pauseBtn) {
        ui.pauseBtn.setAttribute('aria-label', '暂停游戏');
        ui.pauseBtn.setAttribute('aria-pressed', gamePaused);
        ui.pauseBtn.addEventListener('click', () => {
            if (gameRunning) {
                gamePaused = !gamePaused;
                if (gamePaused) {
                    stopBackgroundMusic();
                } else {
                    // 恢复时重置 lastTime，避免积累的 deltaTime 造成“瞬间掉落”
                    lastTime = performance.now();
                    if (musicEnabled) {
                        playBackgroundMusic();
                    }
                }
                updateButtonStates();
            }
        });
    }

    // 重新开始按钮
    if (ui.resetBtn) {
        ui.resetBtn.setAttribute('aria-label', '重新开始游戏');
        ui.resetBtn.addEventListener('click', () => {
            gameRunning = false;
            gamePaused = false;
            stopBackgroundMusic();
            initGame();
        });
    }

    // 音效开关按钮
    if (ui.soundToggleBtn) {
        ui.soundToggleBtn.setAttribute('aria-label', '切换音效');
        ui.soundToggleBtn.setAttribute('aria-pressed', soundEnabled);
        ui.soundToggleBtn.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            ui.soundToggleBtn.classList.toggle('disabled', !soundEnabled);
            ui.soundToggleBtn.textContent = soundEnabled ? '🔊 音效' : '🔇 音效';
            ui.soundToggleBtn.setAttribute('aria-pressed', soundEnabled);
        });
    }

    // 音乐开关按钮
    if (ui.musicToggleBtn) {
        ui.musicToggleBtn.setAttribute('aria-label', '切换音乐');
        ui.musicToggleBtn.setAttribute('aria-pressed', musicEnabled);
        ui.musicToggleBtn.addEventListener('click', () => {
            musicEnabled = !musicEnabled;
            ui.musicToggleBtn.classList.toggle('disabled', !musicEnabled);
            ui.musicToggleBtn.textContent = musicEnabled ? '🎵 音乐' : '🔇 音乐';
            ui.musicToggleBtn.setAttribute('aria-pressed', musicEnabled);

            if (musicEnabled && gameRunning && !gamePaused) {
                playBackgroundMusic();
            } else {
                stopBackgroundMusic();
            }
        });
    }

    // 为按钮添加事件监听器：点击时调用相应的移动或旋转逻辑函数

    // rotate-btn 按钮：旋转方块
    if (ui.rotateBtn) {
        ui.rotateBtn.setAttribute('aria-label', '旋转方块');
        ui.rotateBtn.addEventListener('click', () => {
            if (gameRunning && !gamePaused) {
                // rotatePiece 函数内部会调用 collide 检查旋转后的位置是否合法
                rotatePiece();
            }
        });
    }

    // left-btn 按钮：向左移动
    if (ui.leftBtn) {
        ui.leftBtn.setAttribute('aria-label', '向左移动方块');
        ui.leftBtn.addEventListener('click', () => {
            if (gameRunning && !gamePaused) {
                // moveLeft 函数内部会调用 collide 检查位置是否合法
                moveLeft();
            }
        });
    }

    // right-btn 按钮：向右移动
    if (ui.rightBtn) {
        ui.rightBtn.setAttribute('aria-label', '向右移动方块');
        ui.rightBtn.addEventListener('click', () => {
            if (gameRunning && !gamePaused) {
                // moveRight 函数内部会调用 collide 检查位置是否合法
                moveRight();
            }
        });
    }

    // down-btn 按钮：加速下落
    if (ui.downBtn) {
        ui.downBtn.setAttribute('aria-label', '加速下落方块');
        ui.downBtn.addEventListener('click', () => {
            if (gameRunning && !gamePaused) {
                // moveDown 函数内部会调用 collide 检查位置是否合法
                moveDown();
            }
        });
    }
    
    // 初始化绘制（显示空网格）
    // 初始化画布像素密度与缩放，然后绘制空网格
    setupCanvases();
    initGrid();
    draw();
    updateButtonStates();
    
    // 为 Canvas 添加无障碍属性
    if (canvas) {
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', '俄罗斯方块游戏区域');
    }
    if (nextCanvas) {
        nextCanvas.setAttribute('role', 'img');
        nextCanvas.setAttribute('aria-label', '下一个方块预览');
    }

    // 键盘事件监听器：监听方向键进行移动和旋转
    document.addEventListener('keydown', (event) => {
        // 只在游戏运行且未暂停时响应键盘事件
        if (!gameRunning || gamePaused) return;
        
        // 阻止默认行为（防止页面滚动等）
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
            event.preventDefault();
        }
        
        switch (event.key) {
            case 'ArrowLeft':
                // 左箭头：向左移动（moveLeft 函数内部会调用 collide 检查）
                moveLeft();
                break;

            case 'ArrowRight':
                // 右箭头：向右移动（moveRight 函数内部会调用 collide 检查）
                moveRight();
                break;

            case 'ArrowDown':
                // 下箭头：加速下降（moveDown 函数内部会调用 collide 检查）
                moveDown();
                break;

            case 'ArrowUp':
                // 上箭头：旋转（rotatePiece 函数内部会调用 collide 检查）
                rotatePiece();
                break;

            case ' ':
            case 'Space':
                // 空格键：直接落下（硬降），兼容 event.key === ' ' 和 event.code === 'Space'
                hardDrop();
                break;
        }
    });

    // 初始化时调整Canvas缩放
    adjustCanvasScale();
});

// 窗口大小改变时重新调整画布 DPR 和 CSS 缩放
window.addEventListener('resize', () => {
    setupCanvases();
    adjustCanvasScale();
});

