'use client';

import { useState, useCallback } from 'react';
import MainMenu from './MainMenu';
import HUD from './HUD';
import GameCanvas from './GameCanvas';

const DEFAULT_SETTINGS = {
    graphics: { quality: 'high', shadows: true, pixelRatio: 2, antialiasing: true, particles: true, fog: true },
    audio: { master: 80, engine: 70, effects: 60, music: 50 },
    controls: { steerSensitivity: 50, cameraSmoothing: 50 },
    gameplay: { units: 'kmh', showMinimap: true, showFps: false, showControls: true, autoBrake: false },
};

export default function Game() {
    const [screen, setScreen] = useState('menu');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [hudData, setHudData] = useState({
        speed: 0, gear: 0, rpm: 800,
        nitro: 100, maxNitro: 100,
        score: 0, orbsCollected: 0, combo: 1,
    });
    const [mpStatus, setMpStatus] = useState({ message: '', color: '', visible: false });

    const handlePlay = useCallback(() => setScreen('game'), []);
    const handleBack = useCallback(() => setScreen('menu'), []);

    return (
        <>
            {screen === 'menu' && (
                <MainMenu
                    onPlay={handlePlay}
                    settings={settings}
                    onSettingsChange={setSettings}
                />
            )}
            {screen === 'game' && (
                <>
                    <GameCanvas
                        onHudUpdate={setHudData}
                        onMpStatus={setMpStatus}
                        settings={settings}
                    />
                    <HUD data={hudData} mpStatus={mpStatus} settings={settings} onBack={handleBack} />
                </>
            )}
        </>
    );
}
