'use client';

import { useState } from 'react';
import StartScreen from './StartScreen';
import HUD from './HUD';
import GameCanvas from './GameCanvas';

export default function Game() {
    const [started, setStarted] = useState(false);
    const [hudData, setHudData] = useState({
        speed: 0, gear: 0, rpm: 800,
        nitro: 100, maxNitro: 100,
        score: 0, orbsCollected: 0, combo: 1,
    });
    const [mpStatus, setMpStatus] = useState({ message: '', color: '', visible: false });

    const handleStart = () => setStarted(true);

    return (
        <>
            {!started && <StartScreen onStart={handleStart} />}
            {started && (
                <>
                    <GameCanvas onHudUpdate={setHudData} onMpStatus={setMpStatus} />
                    <HUD data={hudData} mpStatus={mpStatus} />
                </>
            )}
        </>
    );
}
