import pygame
import sys
import random
import asyncio # 引入 asyncio

# 初始化Pygame
pygame.init()
pygame.font.init()

# --- 屏幕和网格设置 ---
WIDTH, HEIGHT = 800, 700
WINDOW = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption('俄罗斯方块 (Tetris)')

GRID_COLS = 10
GRID_ROWS = 20
BLOCK_SIZE = 30
GRID_ORIGIN_X = (WIDTH - GRID_COLS * BLOCK_SIZE) // 2
GRID_ORIGIN_Y = (HEIGHT - GRID_ROWS * BLOCK_SIZE) // 2

# --- 形状、颜色定义和辅助函数（您的原始代码）---
SHAPES = [
    ([[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], (0, 255, 255)),
    ([[1, 0, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]], (0, 0, 255)),
    ([[0, 0, 1, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]], (255, 165, 0)),
    ([[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]], (255, 255, 0)),
    ([[0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], (0, 255, 0)),
    ([[0, 1, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]], (128, 0, 128)),
    ([[1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]], (255, 0, 0)),
]
COLOR_LOOKUP = [
    (0, 0, 0),
    (0, 255, 255),
    (0, 0, 255),
    (255, 165, 0),
    (255, 255, 0),
    (0, 255, 0),
    (128, 0, 128),
    (255, 0, 0),
]

def get_shape():
    idx = random.randint(0, len(SHAPES) - 1)
    shape, color = SHAPES[idx]
    return [row[:] for row in shape], color, idx + 1

def rotate_piece(piece):
    return [[piece[j][3-i] for j in range(4)] for i in range(4)]

GRID_MAP = [[0 for _ in range(GRID_COLS)] for _ in range(GRID_ROWS)]

def draw_grid(surface):
    for x in range(GRID_COLS + 1):
        xpos = GRID_ORIGIN_X + x * BLOCK_SIZE
        pygame.draw.line(surface, (80, 80, 80), (xpos, GRID_ORIGIN_Y), (xpos, GRID_ORIGIN_Y + GRID_ROWS * BLOCK_SIZE))
    for y in range(GRID_ROWS + 1):
        ypos = GRID_ORIGIN_Y + y * BLOCK_SIZE
        pygame.draw.line(surface, (80, 80, 80), (GRID_ORIGIN_X, ypos), (GRID_ORIGIN_X + GRID_COLS * BLOCK_SIZE, ypos))

def draw_piece(surface, piece, x, y, color):
    for i in range(4):
        for j in range(4):
            if piece[i][j]:
                px = x + j
                py = y + i
                if 0 <= px < GRID_COLS and 0 <= py < GRID_ROWS:
                    rect = pygame.Rect(
                        GRID_ORIGIN_X + px * BLOCK_SIZE,
                        GRID_ORIGIN_Y + py * BLOCK_SIZE,
                        BLOCK_SIZE, BLOCK_SIZE
                    )
                    pygame.draw.rect(surface, color, rect)
                    pygame.draw.rect(surface, (50, 50, 50), rect, 1)

def draw_grid_map(surface, grid_map):
    for r in range(GRID_ROWS):
        for c in range(GRID_COLS):
            idx = grid_map[r][c]
            if idx:
                rect = pygame.Rect(
                    GRID_ORIGIN_X + c * BLOCK_SIZE,
                    GRID_ORIGIN_Y + r * BLOCK_SIZE,
                    BLOCK_SIZE, BLOCK_SIZE
                )
                pygame.draw.rect(surface, COLOR_LOOKUP[idx], rect)
                pygame.draw.rect(surface, (50, 50, 50), rect, 1)

def draw_text(surface, text, size, x, y):
    # 'dejavusansmono' 是 PyScript/Pygame-ce 环境中常见的兼容字体
    font = pygame.font.SysFont('dejavusansmono', size, bold=True)
    label = font.render(text, True, (255, 255, 255))
    text_rect = label.get_rect(center=(x, y))
    surface.blit(label, text_rect)

def valid_position(piece, test_x, test_y, grid_map):
    for i in range(4):
        for j in range(4):
            if piece[i][j]:
                px = test_x + j
                py = test_y + i
                if px < 0 or px >= GRID_COLS or py >= GRID_ROWS:
                    return False
                if py >= 0 and grid_map[py][px]:
                    return False
    return True

def check_for_lines(grid_map):
    lines_to_clear = []
    for row in range(GRID_ROWS):
        if all(grid_map[row][col] != 0 for col in range(GRID_COLS)):
            lines_to_clear.append(row)
    for row in reversed(lines_to_clear):
        del grid_map[row]
        grid_map.insert(0, [0 for _ in range(GRID_COLS)])
    return len(lines_to_clear)

game_over = False

score = 0
def add_score(lines):
    global score
    if lines == 1:
        score += 10
    elif lines == 2:
        score += 30
    elif lines == 3:
        score += 60
    elif lines == 4:
        score += 100

def lock_piece():
    global current_piece, current_color, current_color_index, current_x, current_y, game_over, score
    for i in range(4):
        for j in range(4):
            if current_piece[i][j]:
                px = current_x + j
                py = current_y + i
                if 0 <= px < GRID_COLS and 0 <= py < GRID_ROWS:
                    GRID_MAP[py][px] = current_color_index
    lines = check_for_lines(GRID_MAP)
    if lines > 0:
        add_score(lines)
    current_piece, current_color, current_color_index = get_shape()
    current_x, current_y = 3, 0
    if not valid_position(current_piece, current_x, current_y, GRID_MAP):
        game_over = True

# --- 游戏主循环 (重构为异步循环) ---
DROP_INTERVAL = 500
last_drop_time = pygame.time.get_ticks()

current_piece, current_color, current_color_index = get_shape()
current_x, current_y = 3, 0

# 将主函数定义为异步函数
async def main():
    global running, last_drop_time, current_x, current_y, current_piece, game_over, WINDOW
    
    running = True

    while running:
        # 1. 事件处理
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            
            # --- 键盘事件处理 ---
            if event.type == pygame.KEYDOWN:
                if game_over:
                    continue
                if event.key == pygame.K_LEFT:
                    if valid_position(current_piece, current_x - 1, current_y, GRID_MAP):
                        current_x -= 1
                elif event.key == pygame.K_RIGHT:
                    if valid_position(current_piece, current_x + 1, current_y, GRID_MAP):
                        current_x += 1
                elif event.key == pygame.K_DOWN:
                    if valid_position(current_piece, current_x, current_y + 1, GRID_MAP):
                        current_y += 1
                elif event.key == pygame.K_UP:
                    rotated = rotate_piece(current_piece)
                    if valid_position(rotated, current_x, current_y, GRID_MAP):
                        current_piece = rotated
            
            # TODO: 如果需要手机触摸控制，可以在这里添加 pygame.FINGERDOWN 等触摸事件处理逻辑

        # 2. 游戏逻辑更新
        now = pygame.time.get_ticks()
        if not game_over:
            if now - last_drop_time > DROP_INTERVAL:
                if valid_position(current_piece, current_x, current_y + 1, GRID_MAP):
                    current_y += 1
                else:
                    lock_piece()
                last_drop_time = now

        # 3. 绘图渲染
        WINDOW.fill((0, 0, 0))
        draw_grid(WINDOW)
        draw_grid_map(WINDOW, GRID_MAP)
        # 调整计分板位置，避免与 PyScript 的加载信息重叠
        draw_text(WINDOW, f'Score: {score}', 32, GRID_ORIGIN_X + GRID_COLS * BLOCK_SIZE + 120, GRID_ORIGIN_Y + 60)

        if not game_over:
            draw_piece(WINDOW, current_piece, current_x, current_y, current_color)
        else:
            draw_text(WINDOW, 'GAME OVER', 72, WIDTH // 2, HEIGHT // 2)

        pygame.display.flip()

        # 4. 释放控制权给浏览器
        await asyncio.sleep(0) 

# 启动异步主循环
asyncio.run(main())
