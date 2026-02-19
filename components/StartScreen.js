'use client';

export default function StartScreen({ onStart }) {
    return (
        <div id="start-screen" onClick={onStart}>
            <h1>NEON DRIVE</h1>
            <p>Click Anywhere to Start</p>
            <div className="instructions">
                <span className="key">WASD</span> Steer &nbsp;&nbsp;
                <span className="key">Space</span> Drift &nbsp;&nbsp;
                <span className="key">Shift</span> Nitro<br />
                <span className="key">C</span> Camera &nbsp;&nbsp;
                <span className="key">N</span> Night Mode &nbsp;&nbsp;
                Collect orbs for points!
            </div>
        </div>
    );
}
