'use client';

import { useEffect, useRef } from 'react';

export default function GameCanvas({ onHudUpdate, onMpStatus, settings }) {
    const containerRef = useRef(null);
    const initialized = useRef(false);
    const cleanupRef = useRef(null);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const initGame = async () => {
            const THREE = await import('three');
            const { initAudio, playHonk, cleanupAudio } = await import('../game/audio.js');
            const { initKeyboard, setupMobileControls } = await import('../game/input.js');
            const { buildSupercar } = await import('../game/car.js');
            const { buildEnvironment, updateDayNight, toggleNight } = await import('../game/environment.js');
            const { updateParticles, updateSkidMarks } = await import('../game/particles.js');
            const { toggleCamera, updateCamera } = await import('../game/camera.js');
            const { spawnCollectibles, updateCollectibles } = await import('../game/collectibles.js');
            const physicsModule = await import('../game/physics.js');
            const { updatePhysics, setHudCallback } = physicsModule;
            const { initMultiplayer, updateMultiplayer, setStatusCallback } = await import('../game/multiplayer.js');
            const { drawMinimap } = await import('../game/ui.js');
            const collectiblesModule = await import('../game/collectibles.js');

            setHudCallback((data) => onHudUpdate(data));
            setStatusCallback((status) => onMpStatus(status));

            const gameState = {
                score: 0, orbsCollected: 0, combo: 1, comboTimer: 0,
                nitro: 100, maxNitro: 100, nitroRegenRate: 5, isNitroActive: false,
            };

            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0xdde5ed);
            scene.fog = new THREE.FogExp2(0xdde5ed, 0.0012);

            const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2500);
            const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            containerRef.current.appendChild(renderer.domElement);

            const clock = new THREE.Clock();

            buildEnvironment(scene);
            const carParts = buildSupercar(scene);
            spawnCollectibles(scene);

            initAudio();
            initKeyboard(toggleCamera, toggleNight, playHonk);
            setupMobileControls();
            initMultiplayer(scene);

            let animationId;
            const animate = () => {
                animationId = requestAnimationFrame(animate);
                const delta = Math.min(clock.getDelta(), 0.1);

                updatePhysics(delta, gameState, carParts, scene);
                updateParticles(scene, delta);
                updateSkidMarks(scene, delta);
                updateCollectibles(delta, scene, carParts.car, gameState);
                updateDayNight(delta, carParts.car, carParts.headlights, scene);
                updateMultiplayer(carParts.car);
                updateCamera(camera, carParts.car);

                const minimapCanvas = window.__minimapCanvas;
                if (minimapCanvas) {
                    drawMinimap(minimapCanvas, carParts.car, physicsModule.heading, collectiblesModule.orbs);
                }

                renderer.render(scene, camera);
            };

            animate();

            const handleResize = () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            };
            window.addEventListener('resize', handleResize);

            cleanupRef.current = () => {
                cancelAnimationFrame(animationId);
                window.removeEventListener('resize', handleResize);
                cleanupAudio();
                renderer.dispose();
                if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
                    containerRef.current.removeChild(renderer.domElement);
                }
            };
        };

        initGame();

        return () => {
            cleanupRef.current?.();
            initialized.current = false;
        };
    }, [onHudUpdate, onMpStatus, settings]);

    return <div ref={containerRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />;
}
