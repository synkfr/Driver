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
            const { initAudio, playHonk, cleanupAudio, updateAudio } = await import('../game/audio.js');
            const { initKeyboard, setupMobileControls, keys } = await import('../game/input.js');
            const { buildSupercar } = await import('../game/car.js');
            const { buildEnvironment, updateDayNight, toggleNight } = await import('../game/environment.js');
            const { updateParticles, updateSkidMarks, spawnSmoke, addSkidMark } = await import('../game/particles.js');
            const { toggleCamera, updateCamera } = await import('../game/camera.js');
            const { spawnCollectibles, updateCollectibles, orbs } = await import('../game/collectibles.js');
            const { initMultiplayer, updateMultiplayer, setStatusCallback } = await import('../game/multiplayer.js');
            const { drawMinimap } = await import('../game/ui.js');
            const { PhysicsWorld } = await import('../engine/PhysicsWorld.js');

            setStatusCallback((status) => onMpStatus(status));

            const world = new PhysicsWorld();
            const vehicle = world.createVehicle({
                body: { mass: 1400, wheelBase: 2.6, trackWidth: 1.6 },
                transmission: {
                    isAutomatic: settings?.controls?.transmission !== 'manual',
                    drivetrain: 'RWD',
                },
                assists: {
                    absEnabled: true,
                    tcEnabled: true,
                    scEnabled: true,
                },
            });

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

            let skidMarkTimer = 0;

            let animationId;
            const animate = () => {
                animationId = requestAnimationFrame(animate);
                const delta = Math.min(clock.getDelta(), 0.1);

                vehicle.input.throttle = keys.w ? 1 : 0;
                vehicle.input.brake = keys.s ? 1 : 0;
                vehicle.input.steer = (keys.a ? 1 : 0) + (keys.d ? -1 : 0);
                vehicle.input.handbrake = keys.space;
                vehicle.input.nitro = keys.shift;

                world.step(delta);

                const t = world.telemetry;
                if (t) {
                    gameState.isNitroActive = t.isNitroActive;
                    gameState.nitro = t.nitro;
                    gameState.maxNitro = t.maxNitro;

                    if (gameState.comboTimer > 0) {
                        gameState.comboTimer -= delta;
                        if (gameState.comboTimer <= 0) gameState.combo = 1;
                    }
                    if (t.isDrifting && t.speed > 25) {
                        gameState.score += Math.floor(t.speed * 0.04 * gameState.combo);
                    }

                    const car = carParts.car;
                    car.position.set(vehicle.position.x, vehicle.position.y, vehicle.position.z);
                    car.rotation.y = vehicle.heading;

                    if (carParts.chassis) {
                        const avgFrontComp = (t.wheels[0].compression + t.wheels[1].compression) * 0.5;
                        const avgRearComp = (t.wheels[2].compression + t.wheels[3].compression) * 0.5;
                        const avgLeftComp = (t.wheels[0].compression + t.wheels[2].compression) * 0.5;
                        const avgRightComp = (t.wheels[1].compression + t.wheels[3].compression) * 0.5;
                        carParts.chassis.rotation.x = (avgRearComp - avgFrontComp) * 0.06;
                        carParts.chassis.rotation.z = (avgLeftComp - avgRightComp) * 0.08;
                    }

                    if (carParts.wheels) {
                        carParts.wheels.forEach((w, i) => {
                            if (t.wheels[i]) w.rotation.x = t.wheels[i].spinAngle;
                        });
                    }
                    if (carParts.frontWheels) {
                        carParts.frontWheels.forEach((w) => {
                            w.rotation.y = t.steerAngle;
                        });
                    }

                    if (carParts.tailLightBar) {
                        const braking = keys.s || keys.space;
                        carParts.tailLightBar.material.color.setHex(braking ? 0xff0022 : 0x440000);
                    }

                    if (t.isDrifting && t.speed > 25) {
                        const fwd = new THREE.Vector3(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading));
                        const rgt = new THREE.Vector3(Math.cos(vehicle.heading), 0, -Math.sin(vehicle.heading));
                        spawnSmoke(scene, car.position.x - fwd.x * 2, car.position.z - fwd.z * 2, 1);
                        skidMarkTimer += delta;
                        if (skidMarkTimer > 0.18) {
                            const rearOff = fwd.clone().multiplyScalar(-1.6);
                            addSkidMark(scene, car.position.x + rearOff.x + rgt.x, car.position.z + rearOff.z + rgt.z, vehicle.heading);
                            addSkidMark(scene, car.position.x + rearOff.x - rgt.x, car.position.z + rearOff.z - rgt.z, vehicle.heading);
                            skidMarkTimer = 0;
                        }
                    }

                    updateAudio(
                        t.rpm,
                        t.isDrifting,
                        keys.s && vehicle.forwardSpeed > 5,
                        t.isNitroActive,
                        Math.abs(vehicle.forwardSpeed),
                        t.steerAngle
                    );

                    onHudUpdate({
                        speed: t.speed, gear: t.gearIndex, rpm: t.rpm,
                        nitro: t.nitro, maxNitro: t.maxNitro,
                        score: gameState.score, orbsCollected: gameState.orbsCollected, combo: gameState.combo,
                        damage: t.damage, totalDamage: t.totalDamage,
                        absActive: t.absActive, tcActive: t.tcActive,
                        tireTemp: t.tireTemp, tireWear: t.tireWear,
                    });
                }

                updateParticles(scene, delta);
                updateSkidMarks(scene, delta);
                updateCollectibles(delta, scene, carParts.car, gameState);
                updateDayNight(delta, carParts.car, carParts.headlights, scene);
                updateMultiplayer(carParts.car, Math.abs(vehicle.forwardSpeed), vehicle.heading, t ? t.steerAngle : 0);
                updateCamera(camera, carParts.car);

                const minimapCanvas = window.__minimapCanvas;
                if (minimapCanvas) {
                    drawMinimap(minimapCanvas, carParts.car, vehicle.heading, orbs);
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
