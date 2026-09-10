"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";

type DrawData = {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  color: string;
  lineWidth: number;
  tool: "brush" | "eraser";
};

type DrawingCanvasProps = {
  disabled?: boolean;
  onDraw?: (data: DrawData) => void;
  onClear?: () => void;
};

const colors = [
  "#111827",
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#FFFFFF",
];

export default function DrawingCanvas({
  disabled = false,
  onDraw,
  onClear,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawingRef = useRef(false);

  const lastPositionRef = useRef({
    x: 0,
    y: 0,
  });

  const [lineWidth, setLineWidth] = useState(4);

  const [color, setColor] = useState("#111827");

  const [tool, setTool] = useState<"brush" | "eraser">("brush");

  const [history, setHistory] = useState<ImageData[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext("2d");

    if (!context) return;

    context.lineCap = "round";
    context.lineJoin = "round";
  }, []);

  useEffect(() => {
    function drawRemote(data: DrawData) {
      const canvas = canvasRef.current;

      if (!canvas) return;

      const context = canvas.getContext("2d");

      if (!context) return;

      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = data.lineWidth;

      context.strokeStyle = data.tool === "eraser" ? "#FFFFFF" : data.color;

      context.beginPath();

      context.moveTo(data.previousX, data.previousY);

      context.lineTo(data.x, data.y);

      context.stroke();
    }

    function clearRemote() {
      const canvas = canvasRef.current;

      if (!canvas) return;

      const context = canvas.getContext("2d");

      if (!context) return;

      context.clearRect(0, 0, canvas.width, canvas.height);

      setHistory([]);
    }

    socket.on("draw", drawRemote);

    socket.on("clear-canvas", clearRemote);

    return () => {
      socket.off("draw", drawRemote);

      socket.off("clear-canvas", clearRemote);
    };
  }, []);

  function getPosition(
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;

    const scaleY = canvas.height / rect.height;

    if ("touches" in event) {
      const touch = event.touches[0];

      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function saveHistory() {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext("2d");

    if (!context) return;

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    setHistory((current) => [...current, imageData]);
  }

  function startDrawing(
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) {
    if (disabled) return;

    saveHistory();

    const position = getPosition(event);

    drawingRef.current = true;

    lastPositionRef.current = position;
  }

  function draw(
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) {
    if (disabled) return;

    if (!drawingRef.current) return;

    event.preventDefault();

    const canvas = canvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext("2d");

    if (!context) return;

    const position = getPosition(event);

    const previous = lastPositionRef.current;

    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = lineWidth;

    context.strokeStyle = tool === "eraser" ? "#FFFFFF" : color;

    context.beginPath();

    context.moveTo(previous.x, previous.y);

    context.lineTo(position.x, position.y);

    context.stroke();

    const data: DrawData = {
      x: position.x,
      y: position.y,
      previousX: previous.x,
      previousY: previous.y,
      color,
      lineWidth,
      tool,
    };

    onDraw?.(data);

    lastPositionRef.current = position;
  }

  function stopDrawing() {
    drawingRef.current = false;
  }

  function undo() {
    if (disabled) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext("2d");

    if (!context) return;

    setHistory((current) => {
      if (current.length === 0) {
        return current;
      }

      const previous = current[current.length - 1];

      context.putImageData(previous, 0, 0);

      return current.slice(0, -1);
    });
  }

  function clearCanvas() {
    if (disabled) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext("2d");

    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    setHistory([]);

    onClear?.();
  }

  function selectColor(selectedColor: string) {
    setColor(selectedColor);
    setTool("brush");
  }

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
        <canvas
          ref={canvasRef}
          width={900}
          height={600}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`block h-auto w-full touch-none ${
            disabled ? "cursor-not-allowed" : "cursor-crosshair"
          }`}
        />
      </div>

      {!disabled && (
        <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">Color</span>

              <div className="flex flex-wrap gap-1.5">
                {colors.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => selectColor(item)}
                    className={`h-7 w-7 rounded-full border-2 transition ${
                      color === item && tool === "brush"
                        ? "scale-110 border-purple-500 ring-2 ring-purple-200"
                        : "border-gray-300"
                    }`}
                    style={{
                      backgroundColor: item,
                    }}
                    aria-label={`Select ${item}`}
                  />
                ))}
              </div>

              <input
                type="color"
                value={color}
                onChange={(event) => {
                  setColor(event.target.value);
                  setTool("brush");
                }}
                className="h-8 w-8 cursor-pointer rounded-lg border border-gray-300 bg-white p-0.5"
                aria-label="Custom color"
              />
            </div>

            <div className="h-7 w-px bg-gray-200" />

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">Size</span>

              <input
                type="range"
                min="1"
                max="30"
                value={lineWidth}
                onChange={(event) => setLineWidth(Number(event.target.value))}
                className="w-28 cursor-pointer"
              />

              <span className="min-w-[38px] text-sm font-medium text-gray-600">
                {lineWidth}px
              </span>
            </div>

            <div className="h-7 w-px bg-gray-200" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTool("brush")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  tool === "brush"
                    ? "bg-purple-100 text-purple-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                🖌️ Brush
              </button>

              <button
                type="button"
                onClick={() => setTool("eraser")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  tool === "eraser"
                    ? "bg-purple-100 text-purple-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                🧽 Eraser
              </button>

              <button
                type="button"
                onClick={undo}
                disabled={history.length === 0}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↩️ Undo
              </button>

              <button
                type="button"
                onClick={clearCanvas}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                🗑️ Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
