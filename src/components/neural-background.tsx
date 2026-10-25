"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number[];
  pulse: number;
  brightness: number;
}

interface NeuralBackgroundProps {
  className?: string;
}

export const NeuralBackground = ({ className = "" }: NeuralBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const mouseRef = useRef({ x: 0, y: 0 });
  const { theme } = useTheme();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Create nodes
    const nodes: Node[] = [];
    const nodeCount = Math.min(50, Math.floor((canvas.width * canvas.height) / 15000));

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        connections: [],
        pulse: Math.random() * Math.PI * 2,
        brightness: 0,
      });
    }

    // Create connections between nearby nodes
    const maxDistance = 150;
    nodes.forEach((node, i) => {
      nodes.forEach((otherNode, j) => {
        if (i !== j) {
          const distance = Math.sqrt(
            Math.pow(node.x - otherNode.x, 2) + Math.pow(node.y - otherNode.y, 2)
          );
          if (distance < maxDistance) {
            node.connections.push(j);
          }
        }
      });
    });

    // Theme colors - ash tones for neutral, professional look
    const getThemeColors = () => {
      if (theme === "dark") {
        return {
          node: "#9ca3af", // Light ash gray
          connection: "#6b7280", // Medium ash gray
          pulse: "#d1d5db", // Very light ash gray
          glow: "#4b5563", // Dark ash gray
        };
      } else {
        return {
          node: "#6b7280", // Medium ash gray
          connection: "#9ca3af", // Light ash gray
          pulse: "#6b7280", // Medium ash gray
          glow: "#f3f4f6", // Very light ash gray
        };
      }
    };

    // Purely decorative, so it must never compete with the app: 30 fps cap,
    // paused in hidden tabs, started only once the browser is idle
    const FRAME_INTERVAL = 1000 / 30;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastFrame = 0;

    const animate = (now = 0) => {
      if (!reducedMotion) {
        animationRef.current = requestAnimationFrame(animate);
      }
      if (now - lastFrame < FRAME_INTERVAL) return;
      lastFrame = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const colors = getThemeColors();

      // Update nodes
      nodes.forEach((node) => {
        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off edges
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

        // Keep within bounds
        node.x = Math.max(0, Math.min(canvas.width, node.x));
        node.y = Math.max(0, Math.min(canvas.height, node.y));

        // Update pulse
        node.pulse += 0.02;

        // Calculate distance to mouse
        const mouseDistance = Math.sqrt(
          Math.pow(node.x - mouseRef.current.x, 2) + Math.pow(node.y - mouseRef.current.y, 2)
        );

        // Update brightness based on mouse proximity - more subtle
        const maxMouseDistance = 150; // Reduced from 200 to 150
        node.brightness = Math.max(0, (1 - mouseDistance / maxMouseDistance) * 0.6); // Reduced max brightness to 0.6
      });

      // Draw connections
      nodes.forEach((node) => {
        node.connections.forEach((connectionIndex) => {
          const connectedNode = nodes[connectionIndex];
          if (connectedNode) {
            const distance = Math.sqrt(
              Math.pow(node.x - connectedNode.x, 2) + Math.pow(node.y - connectedNode.y, 2)
            );

            if (distance < maxDistance) {
              const opacity = Math.max(0, 1 - distance / maxDistance) * 0.15; // Reduced from 0.3 to 0.15
              const lineWidth = Math.max(0.3, 1.2 - distance / maxDistance); // Reduced from 0.5-2 to 0.3-1.2

              ctx.beginPath();
              ctx.moveTo(node.x, node.y);
              ctx.lineTo(connectedNode.x, connectedNode.y);
              ctx.strokeStyle = `${colors.connection}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`;
              ctx.lineWidth = lineWidth;
              ctx.stroke();
            }
          }
        });
      });

      // Draw nodes
      nodes.forEach((node) => {
        const pulseSize = 2 + Math.sin(node.pulse) * 1; // Reduced from 3+2 to 2+1
        const nodeSize = pulseSize + node.brightness * 2; // Reduced from 4 to 2
        const nodeOpacity = 0.3 + node.brightness * 0.2; // Reduced from 0.6+0.4 to 0.3+0.2

        // Draw glow effect - more subtle
        if (node.brightness > 0.3) { // Only show glow when brightness is higher
          const gradient = ctx.createRadialGradient(
            node.x, node.y, 0,
            node.x, node.y, nodeSize * 2 // Reduced from 3 to 2
          );
          gradient.addColorStop(0, `${colors.glow}${Math.floor(node.brightness * 50).toString(16).padStart(2, '0')}`); // Reduced from 100 to 50
          gradient.addColorStop(1, `${colors.glow}00`);

          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeSize * 2, 0, Math.PI * 2); // Reduced from 3 to 2
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeSize, 0, Math.PI * 2);
        ctx.fillStyle = `${colors.node}${Math.floor(nodeOpacity * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();

        // Draw pulse ring - more subtle
        if (node.brightness > 0.7) { // Only show pulse ring when brightness is very high
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeSize + 3, 0, Math.PI * 2); // Reduced from 5 to 3
          ctx.strokeStyle = `${colors.pulse}${Math.floor(node.brightness * 60).toString(16).padStart(2, '0')}`; // Reduced from 100 to 60
          ctx.lineWidth = 0.5; // Reduced from 1 to 0.5
          ctx.stroke();
        }
      });
    };

    const stop = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else if (!animationRef.current) {
        animate();
      }
    };

    // Mouse event handlers
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Safari has no requestIdleCallback
    const canIdle = typeof window.requestIdleCallback === "function";
    const startHandle = canIdle
      ? window.requestIdleCallback(() => animate(), { timeout: 2000 })
      : setTimeout(() => animate(), 300) as unknown as number;

    // Cleanup
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (canIdle) {
        window.cancelIdleCallback(startHandle);
      } else {
        clearTimeout(startHandle);
      }
      stop();
    };
  }, [isClient, theme]);

  if (!isClient) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      style={{ background: "transparent" }}
    />
  );
};
