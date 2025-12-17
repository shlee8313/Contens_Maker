import { LayoutType } from "../types";

// Standard YouTube 16:9 resolution for generation guidance
const WIDTH = 1280;
const HEIGHT = 720;
const LINE_WIDTH = 15; // Thick lines for better AI recognition

export const generateLayoutBase64 = (layout: LayoutType): string => {
  // Create an off-screen canvas
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) return "";

  // 1. Fill Background White
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. Set Line Style (Black borders)
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = LINE_WIDTH;

  // 3. Draw Lines based on Layout
  ctx.beginPath();

  switch (layout) {
    case 'SINGLE':
        // No lines, just white canvas (though usually we won't use this function for SINGLE)
        break;

    case 'SPLIT_V': // Vertical Split (Left | Right)
        ctx.moveTo(WIDTH / 2, 0);
        ctx.lineTo(WIDTH / 2, HEIGHT);
        break;

    case 'SPLIT_H': // Horizontal Split (Top | Bottom)
        ctx.moveTo(0, HEIGHT / 2);
        ctx.lineTo(WIDTH, HEIGHT / 2);
        break;

    case 'GRID_2X2': // 4 Panels
        // Vertical center
        ctx.moveTo(WIDTH / 2, 0);
        ctx.lineTo(WIDTH / 2, HEIGHT);
        // Horizontal center
        ctx.moveTo(0, HEIGHT / 2);
        ctx.lineTo(WIDTH, HEIGHT / 2);
        break;

    case 'TRI_BOT_SPLIT': // 1 Top, 2 Bottom
        // Horizontal line
        ctx.moveTo(0, HEIGHT / 2);
        ctx.lineTo(WIDTH, HEIGHT / 2);
        // Vertical line (bottom half only)
        ctx.moveTo(WIDTH / 2, HEIGHT / 2);
        ctx.lineTo(WIDTH / 2, HEIGHT);
        break;
        
    case 'TRI_TOP_SPLIT': // 2 Top, 1 Bottom
        // Horizontal line
        ctx.moveTo(0, HEIGHT / 2);
        ctx.lineTo(WIDTH, HEIGHT / 2);
        // Vertical line (top half only)
        ctx.moveTo(WIDTH / 2, 0);
        ctx.lineTo(WIDTH / 2, HEIGHT / 2);
        break;
  }

  ctx.stroke();

  // 4. Add Outer Border (Optional, helps frame the content)
  ctx.strokeRect(0, 0, WIDTH, HEIGHT);

  // Return Base64 Data URL (image/png)
  return canvas.toDataURL("image/png");
};
