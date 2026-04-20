import React, { useEffect, useRef, useCallback } from "react";

// Adani theme colors (Blues, Purples, Violets, Reds) that work well in both themes
const COLORS = [
    { r: 11, g: 116, b: 176 },   // #0B74B0 (Adani Blue)
    { r: 117, g: 71, b: 156 },   // #75479C (Purple)
    { r: 189, g: 56, b: 97 },    // #BD3861 (Red/Pink)
    { r: 77, g: 168, b: 216 },   // #4DA8D8 (Light Blue)
    { r: 139, g: 92, b: 246 },   // Violet-500
];

export function NeuralBackground({ theme }: { theme: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<any[]>([]);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const animFrameRef = useRef(0);

    const initParticles = useCallback((width: number, height: number) => {
        const count = Math.min(Math.floor((width * height) / 9000), 110);
        const particles = [];
        for (let i = 0; i < count; i++) {
            const color = COLORS[Math.floor(Math.random() * COLORS.length)];
            const initialVx = (Math.random() - 0.5) * 0.8;
            const initialVy = (Math.random() - 0.5) * 0.8;

            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: initialVx,
                vy: initialVy,
                baseVx: initialVx,
                baseVy: initialVy,
                size: 2 + Math.random() * 3,
                baseOpacity: 0.5 + Math.random() * 0.4,
                r: color.r,
                g: color.g,
                b: color.b,
                pulseSpeed: 0.3 + Math.random() * 0.8,
                pulseOffset: Math.random() * Math.PI * 2,
            });
        }
        particlesRef.current = particles;
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            initParticles(window.innerWidth, window.innerHeight);
        };

        const handleMouse = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };

        resize();
        window.addEventListener("resize", resize);
        window.addEventListener("mousemove", handleMouse);

        let time = 0;
        const connectionDist = 200;

        const draw = () => {
            time += 0.008;
            const w = window.innerWidth;
            const h = window.innerHeight;
            ctx.clearRect(0, 0, w, h);

            const particles = particlesRef.current;
            const mx = mouseRef.current.x;
            const my = mouseRef.current.y;

            // Theme adjustments
            const isDark = theme === 'dark';
            // In light mode, we want strong, rich colors that pop against white
            const baseAlphaMult = isDark ? 1 : 1.2;
            const connectionAlphaMult = isDark ? 0.3 : 0.4;

            // Update positions
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                const dx = p.x - mx;
                const dy = p.y - my;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Gentle mouse interaction
                if (dist < 200 && dist > 0) {
                    const force = (200 - dist) / 200;
                    p.vx += (dx / dist) * force * 0.15;
                    p.vy += (dy / dist) * force * 0.15;
                }

                // Add base drift back in towards their original inherent velocity
                p.vx = p.vx * 0.985 + p.baseVx * 0.015;
                p.vy = p.vy * 0.985 + p.baseVy * 0.015;

                p.x += p.vx;
                p.y += p.vy;

                // Bounce off edges playfully instead of wrapping aggressively or drifting off
                if (p.x < 0) { p.x = 0; p.vx *= -1; p.baseVx *= -1; }
                if (p.x > w) { p.x = w; p.vx *= -1; p.baseVx *= -1; }
                if (p.y < 0) { p.y = 0; p.vy *= -1; p.baseVy *= -1; }
                if (p.y > h) { p.y = h; p.vy *= -1; p.baseVy *= -1; }
            }

            // Draw connections (behind particles)
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const a = particles[i];
                    const b = particles[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < connectionDist) {
                        const strength = (1 - dist / connectionDist);
                        // Make lines thicker and darker in light mode
                        let alpha = strength * connectionAlphaMult;
                        if (!isDark) alpha = Math.min(alpha * 1.5, 0.8);

                        const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
                        gradient.addColorStop(0, `rgba(${a.r}, ${a.g}, ${a.b}, ${alpha})`);
                        gradient.addColorStop(1, `rgba(${b.r}, ${b.g}, ${b.b}, ${alpha})`);

                        ctx.beginPath();
                        ctx.strokeStyle = gradient;
                        ctx.lineWidth = isDark ? strength * 1.5 : strength * 2.2;
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }

            // Draw particles
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                const pulse = Math.sin(time * p.pulseSpeed + p.pulseOffset) * 0.15 + 0.85;
                // Clamp max opacity to 1
                const opacity = Math.min(p.baseOpacity * pulse * baseAlphaMult, 1);

                // Mouse proximity boost - nodes near cursor glow brighter
                const mDx = p.x - mx;
                const mDy = p.y - my;
                const mDist = Math.sqrt(mDx * mDx + mDy * mDy);
                const proximityBoost = mDist < 200 ? (1 - mDist / 200) * 0.5 : 0;

                // Outer glow ring
                const boostedOpacity = opacity + proximityBoost;
                const glowSize = p.size * (isDark ? (8 + proximityBoost * 6) : (5 + proximityBoost * 4));
                const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
                glow.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, ${boostedOpacity * (isDark ? 0.15 : 0.08)})`);
                glow.addColorStop(0.4, `rgba(${p.r}, ${p.g}, ${p.b}, ${boostedOpacity * (isDark ? 0.05 : 0.03)})`);
                glow.addColorStop(1, `rgba(${p.r}, ${p.g}, ${p.b}, 0)`);
                ctx.beginPath();
                ctx.fillStyle = glow;
                ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
                ctx.fill();

                // Inner bright core
                const coreGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                coreGrad.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, ${opacity})`);
                coreGrad.addColorStop(0.6, `rgba(${p.r}, ${p.g}, ${p.b}, ${opacity * 0.7})`);
                coreGrad.addColorStop(1, `rgba(${p.r}, ${p.g}, ${p.b}, 0)`);
                ctx.beginPath();
                ctx.fillStyle = coreGrad;
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();

                // Bright center dot
                ctx.beginPath();
                ctx.fillStyle = `rgba(${Math.min(p.r + (isDark ? 60 : 30), 255)}, ${Math.min(p.g + (isDark ? 60 : 30), 255)}, ${Math.min(p.b + (isDark ? 60 : 30), 255)}, ${isDark ? opacity * 0.9 : 1})`;
                ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }

            animFrameRef.current = requestAnimationFrame(draw);
        };

        animFrameRef.current = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animFrameRef.current);
            window.removeEventListener("resize", resize);
            window.removeEventListener("mousemove", handleMouse);
        };
    }, [initParticles, theme]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none transition-opacity duration-1000"
            style={{ zIndex: 0 }}
        />
    );
}
