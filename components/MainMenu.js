'use client';

import { useState } from 'react';

const TABS = [
    { id: 'main', label: 'Main' },
    { id: 'graphics', label: 'Graphics' },
    { id: 'audio', label: 'Audio' },
    { id: 'controls', label: 'Controls' },
    { id: 'gameplay', label: 'Gameplay' },
];

function Slider({ label, value, onChange, min = 0, max = 100, suffix = '%' }) {
    return (
        <div className="menu-setting-row">
            <span className="menu-setting-label">{label}</span>
            <div className="menu-slider-wrap">
                <input
                    type="range" min={min} max={max} value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="menu-slider"
                />
                <span className="menu-slider-value">{value}{suffix}</span>
            </div>
        </div>
    );
}

function Toggle({ label, value, onChange, description }) {
    return (
        <div className="menu-setting-row">
            <div>
                <span className="menu-setting-label">{label}</span>
                {description && <span className="menu-setting-desc">{description}</span>}
            </div>
            <button
                className={`menu-toggle ${value ? 'active' : ''}`}
                onClick={() => onChange(!value)}
            >
                {value ? 'ON' : 'OFF'}
            </button>
        </div>
    );
}

function Select({ label, value, options, onChange }) {
    return (
        <div className="menu-setting-row">
            <span className="menu-setting-label">{label}</span>
            <div className="menu-select-group">
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        className={`menu-select-btn ${value === opt.value ? 'active' : ''}`}
                        onClick={() => onChange(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function MainPanel({ onPlay }) {
    return (
        <div className="menu-main-panel">
            <button className="menu-play-btn" onClick={onPlay}>
                <span className="play-icon">▶</span>
                <span>PLAY</span>
            </button>
            <div className="menu-main-info">
                <div className="menu-info-block">
                    <h3>How to Play</h3>
                    <div className="menu-controls-grid">
                        <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> <span>Steer</span></div>
                        <div><kbd>Space</kbd> <span>Handbrake / Drift</span></div>
                        <div><kbd>Shift</kbd> <span>Nitro Boost</span></div>
                        <div><kbd>C</kbd> <span>Cycle Camera</span></div>
                        <div><kbd>N</kbd> <span>Toggle Night</span></div>
                        <div><kbd>H</kbd> <span>Honk</span></div>
                    </div>
                </div>
                <div className="menu-info-block">
                    <h3>Tips</h3>
                    <ul>
                        <li>Collect neon orbs for score multipliers</li>
                        <li>Drift around corners for bonus points</li>
                        <li>Chain combos by collecting orbs quickly</li>
                        <li>Use nitro on long straights for top speed</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

function GraphicsPanel({ settings, onChange }) {
    const g = settings.graphics;
    const set = (key, val) => onChange({ ...settings, graphics: { ...g, [key]: val } });

    return (
        <div className="menu-settings-panel">
            <Select label="Quality Preset" value={g.quality}
                options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'ultra', label: 'Ultra' }]}
                onChange={(v) => {
                    const presets = {
                        low: { shadows: false, pixelRatio: 1, antialiasing: false, particles: false, fog: false },
                        medium: { shadows: true, pixelRatio: 1, antialiasing: false, particles: true, fog: true },
                        high: { shadows: true, pixelRatio: 2, antialiasing: true, particles: true, fog: true },
                        ultra: { shadows: true, pixelRatio: 3, antialiasing: true, particles: true, fog: true },
                    };
                    onChange({ ...settings, graphics: { ...g, quality: v, ...presets[v] } });
                }}
            />
            <Toggle label="Shadows" value={g.shadows} onChange={(v) => set('shadows', v)} description="Dynamic shadow rendering" />
            <Toggle label="Anti-Aliasing" value={g.antialiasing} onChange={(v) => set('antialiasing', v)} description="Smooth jagged edges" />
            <Toggle label="Particles" value={g.particles} onChange={(v) => set('particles', v)} description="Smoke and drift effects" />
            <Toggle label="Fog" value={g.fog} onChange={(v) => set('fog', v)} description="Distance fog effect" />
            <Slider label="Pixel Ratio" value={g.pixelRatio} onChange={(v) => set('pixelRatio', v)} min={1} max={3} suffix="x" />
        </div>
    );
}

function AudioPanel({ settings, onChange }) {
    const a = settings.audio;
    const set = (key, val) => onChange({ ...settings, audio: { ...a, [key]: val } });

    return (
        <div className="menu-settings-panel">
            <Slider label="Master Volume" value={a.master} onChange={(v) => set('master', v)} />
            <Slider label="Engine Sound" value={a.engine} onChange={(v) => set('engine', v)} />
            <Slider label="Effects (Tires, Drift)" value={a.effects} onChange={(v) => set('effects', v)} />
            <Slider label="Music" value={a.music} onChange={(v) => set('music', v)} />
        </div>
    );
}

function ControlsPanel({ settings, onChange }) {
    const c = settings.controls;
    const set = (key, val) => onChange({ ...settings, controls: { ...c, [key]: val } });

    return (
        <div className="menu-settings-panel">
            <Slider label="Steering Sensitivity" value={c.steerSensitivity} onChange={(v) => set('steerSensitivity', v)} />
            <Slider label="Camera Smoothing" value={c.cameraSmoothing} onChange={(v) => set('cameraSmoothing', v)} />
            <div className="menu-info-block" style={{ marginTop: 20 }}>
                <h3>Keyboard Bindings</h3>
                <div className="menu-controls-grid compact">
                    <div><kbd>W</kbd> Accelerate</div>
                    <div><kbd>S</kbd> Brake / Reverse</div>
                    <div><kbd>A</kbd> Steer Left</div>
                    <div><kbd>D</kbd> Steer Right</div>
                    <div><kbd>Space</kbd> Handbrake</div>
                    <div><kbd>Shift</kbd> Nitro</div>
                    <div><kbd>C</kbd> Camera</div>
                    <div><kbd>N</kbd> Night Mode</div>
                    <div><kbd>H</kbd> Honk</div>
                    <div><kbd>Esc</kbd> Pause</div>
                </div>
            </div>
        </div>
    );
}

function GameplayPanel({ settings, onChange }) {
    const gp = settings.gameplay;
    const set = (key, val) => onChange({ ...settings, gameplay: { ...gp, [key]: val } });

    return (
        <div className="menu-settings-panel">
            <Select label="Speed Units" value={gp.units}
                options={[{ value: 'kmh', label: 'km/h' }, { value: 'mph', label: 'mph' }]}
                onChange={(v) => set('units', v)}
            />
            <Toggle label="Show Minimap" value={gp.showMinimap} onChange={(v) => set('showMinimap', v)} />
            <Toggle label="Show FPS Counter" value={gp.showFps} onChange={(v) => set('showFps', v)} />
            <Toggle label="Show Controls Overlay" value={gp.showControls} onChange={(v) => set('showControls', v)} />
            <Toggle label="Auto-Brake on Collision" value={gp.autoBrake} onChange={(v) => set('autoBrake', v)} description="Automatically brakes before hitting walls" />
            <button className="menu-reset-btn" onClick={() => onChange({
                ...settings, gameplay: { units: 'kmh', showMinimap: true, showFps: false, showControls: true, autoBrake: false }
            })}>Reset to Defaults</button>
        </div>
    );
}

export default function MainMenu({ onPlay, settings, onSettingsChange }) {
    const [activeTab, setActiveTab] = useState('main');

    const renderPanel = () => {
        switch (activeTab) {
            case 'main': return <MainPanel onPlay={onPlay} />;
            case 'graphics': return <GraphicsPanel settings={settings} onChange={onSettingsChange} />;
            case 'audio': return <AudioPanel settings={settings} onChange={onSettingsChange} />;
            case 'controls': return <ControlsPanel settings={settings} onChange={onSettingsChange} />;
            case 'gameplay': return <GameplayPanel settings={settings} onChange={onSettingsChange} />;
        }
    };

    return (
        <div className="menu-overlay">
            <div className="menu-bg-animation" />
            <div className="menu-container">
                <div className="menu-header">
                    <h1 className="menu-title">NEON DRIVE</h1>
                    <p className="menu-subtitle">Open World Drift Racer</p>
                </div>

                <div className="menu-body">
                    <nav className="menu-nav">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                className={`menu-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                    <div className="menu-content">
                        {renderPanel()}
                    </div>
                </div>

                <div className="menu-footer">
                    <span>v3.0</span>
                    <span>Built with Three.js + Next.js</span>
                </div>
            </div>
        </div>
    );
}
