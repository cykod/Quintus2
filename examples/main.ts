// Quintus 2.0 — Example game will go here in Phase 1
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D context not available");
ctx.fillStyle = "#16213e";
ctx.fillRect(0, 0, 800, 600);
ctx.fillStyle = "#e94560";
ctx.font = "bold 48px system-ui";
ctx.textAlign = "center";
ctx.fillText("Quintus 2.0", 400, 300);
ctx.font = "20px system-ui";
ctx.fillStyle = "#0f3460";
ctx.fillText("Phase 0 Complete — Engine coming soon", 400, 350);
