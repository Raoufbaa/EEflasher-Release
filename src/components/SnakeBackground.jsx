'use client';

import { useEffect, useRef } from 'react';
import styles from '@/styles/SnakeBackground.module.css';

export default function SnakeBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const CELL = 48;
    const SNAKE_COUNT = 3;
    const SNAKE_LEN = 6;
    const SPEED = 120;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    
    resize();
    window.addEventListener('resize', resize);

    const DIRS = [
      { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 0, y: 1 }, { x: 0, y: -1 }
    ];

    function randInt(a, b) {
      return Math.floor(Math.random() * (b - a + 1)) + a;
    }

    function makeSnake() {
      const cols = Math.floor(window.innerWidth / CELL);
      const rows = Math.floor(window.innerHeight / CELL);
      return {
        cells: Array.from({ length: SNAKE_LEN }, () => ({
          x: randInt(2, Math.max(2, cols - 3)),
          y: randInt(2, Math.max(2, rows - 3))
        })),
        dir: randInt(0, 3),
        hue: randInt(200, 230)
      };
    }

    let snakes = Array.from({ length: SNAKE_COUNT }, makeSnake);

    function step(snake) {
      const cols = Math.floor(canvas.width / CELL);
      const rows = Math.floor(canvas.height / CELL);
      const head = snake.cells[0];
      const d = DIRS[snake.dir];
      const nx = head.x + d.x;
      const ny = head.y + d.y;

      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) {
        snake.dir = randInt(0, 3);
        return;
      }

      if (Math.random() < 0.15) {
        const turns = [0, 1, 2, 3].filter(i => {
          const t = DIRS[i];
          return !(t.x === -d.x && t.y === -d.y);
        });
        snake.dir = turns[randInt(0, turns.length - 1)];
      }

      snake.cells.unshift({ x: nx, y: ny });
      snake.cells.pop();
    }

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cols = Math.floor(canvas.width / CELL);
      const rows = Math.floor(canvas.height / CELL);

      /* dot grid */
      ctx.fillStyle = 'rgba(255,255,255,0.028)';
      for (let x = 0; x <= cols; x++) {
        for (let y = 0; y <= rows; y++) {
          ctx.beginPath();
          ctx.arc(x * CELL, y * CELL, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      /* snakes */
      snakes.forEach(snake => {
        snake.cells.forEach((cell, i) => {
          const alpha = (1 - i / snake.cells.length) * 0.55;
          ctx.strokeStyle = `hsla(${snake.hue}, 30%, 45%, ${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(
            cell.x * CELL + 0.5,
            cell.y * CELL + 0.5,
            CELL - 1,
            CELL - 1
          );
        });
      });
    }

    const interval = setInterval(() => {
      snakes.forEach(step);
      draw();
    }, SPEED);

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      clearInterval(interval);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="bgCanvas"
      className={styles.canvasBg}
    />
  );
}
