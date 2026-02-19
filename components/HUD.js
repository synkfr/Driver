'use client';

import { useRef, useEffect } from 'react';

export default function HUD({ data, mpStatus }) {
    const minimapRef = useRef(null);

    // Expose minimap canvas ref globally for the game engine to draw on
    useEffect(() => {
        if (minimapRef.current) {
            window.__minimapCanvas = minimapRef.current;
        }
        return () => { window.__minimapCanvas = null; };
    }, []);

    const { speed, gear, rpm, nitro, maxNitro, score, orbsCollected, combo } = data;

    const gearDisplay = gear === 0 && speed < 1 ? 'N' : `G${gear + 1}`;
    const rpmWidth = `${Math.max(0, Math.min(100, (rpm / 8000) * 100))}%`;
    const nitroWidth = `${(nitro / maxNitro) * 100}%`;

    return (
        <div id="ui-layer" style={{ display: 'block' }}>
            {/* Score */}
            <div id="hud-top-left">
                <div className="score-item">
                    <span className="score-label">Score</span>
                    <span className="score-value">{score}</span>
                </div>
                <div className="score-item">
                    <span className="score-label">Orbs</span>
                    <span className="score-value">{orbsCollected}</span>
                </div>
                <div className="score-item">
                    <span className="score-label">Combo</span>
                    <span className="score-value">x{combo}</span>
                </div>
            </div>

            {/* Controls help */}
            <div id="controls-help">
                <span className="key">W</span> <span className="key">A</span> <span className="key">S</span> <span className="key">D</span> Steer<br />
                <span className="key">Space</span> Drift<br />
                <span className="key">Shift</span> Nitro Boost<br />
                <span className="key">C</span> Camera<br />
                <span className="key">N</span> Night Mode<br />
                <span className="key">H</span> Honk
            </div>

            {/* Minimap */}
            <div id="minimap-container">
                <canvas id="minimap" ref={minimapRef} width={200} height={200}></canvas>
            </div>

            {/* Speed / Gauges */}
            <div id="hud-bottom-right">
                <div className="hud-row">
                    <div>
                        <span id="speed-text">{Math.round(speed)}</span>{' '}
                        <span style={{ color: '#666', fontSize: '14px' }}>km/h</span>
                    </div>
                    <div id="gear-text">{gearDisplay}</div>
                </div>

                <div id="nitro-container">
                    <div id="nitro-label">Nitro Boost</div>
                    <div id="nitro-bg">
                        <div id="nitro-bar" style={{ width: nitroWidth }}></div>
                    </div>
                </div>

                <div style={{ fontSize: '10px', color: '#666', margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Engine RPM
                </div>
                <div id="rpm-bg">
                    <div id="rpm-bar" style={{ width: rpmWidth }}></div>
                </div>
            </div>

            <div id="boost-indicator"></div>

            {/* Mobile controls */}
            <div id="mobile-controls">
                <div className="mobile-btn" id="mobile-left">◄</div>
                <div className="mobile-btn" id="mobile-right">►</div>
                <div className="mobile-btn" id="mobile-gas">▲</div>
                <div className="mobile-btn" id="mobile-brake">■</div>
                <div className="mobile-btn" id="mobile-boost">⚡</div>
            </div>

            {/* Multiplayer status */}
            {mpStatus.visible && (
                <div
                    style={{
                        position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                        padding: '8px 20px', borderRadius: '20px', fontSize: '13px',
                        fontFamily: 'sans-serif', zIndex: 200, pointerEvents: 'none',
                        color: 'white', background: 'rgba(0,0,0,0.7)',
                        border: `1px solid ${mpStatus.color || 'rgba(255,255,255,0.15)'}`,
                    }}
                >
                    {mpStatus.message}
                </div>
            )}
        </div>
    );
}
