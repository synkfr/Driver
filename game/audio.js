// ==========================================
// AUDIO — Real SFX engine + realistic tire screech + honk
// ==========================================
// Engine: MP3 loop with pitch/volume scaling
// Tires: White noise → bandpass filter (sounds like real rubber on asphalt)
// Boost: Low sine rumble
// Honk: MP3 one-shot

let audioCtx;

// MP3-based audio
let engineAudio = null;
let engineGainNode = null;
let honkAudio = null;

// Synth layers
let engineOsc, engineGain, engineFilter;
let boostOsc, boostGain;

// Tire screech — white noise through bandpass (realistic rubber sound)
let tireNoiseSource = null;
let tireNoiseBuffer = null;
let tireBandpass, tireBandpass2, tireGain, tireHighpass;

const createWhiteNoiseBuffer = (ctx, durationSec) => {
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * durationSec;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
};

export const initAudio = () => {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // === MP3 Engine Idle Loop ===
        engineAudio = new Audio('sfx/car-engine-idle.mp3');
        engineAudio.loop = true;
        engineAudio.volume = 0.6;
        engineAudio.playbackRate = 1.0;
        engineAudio.play().catch(() => {
            document.addEventListener('click', function playOnClick() {
                engineAudio.play();
                document.removeEventListener('click', playOnClick);
            }, { once: true });
        });

        // Connect to Web Audio for pitch control
        const source = audioCtx.createMediaElementSource(engineAudio);
        engineGainNode = audioCtx.createGain();
        engineGainNode.gain.value = 0.6;
        source.connect(engineGainNode);
        engineGainNode.connect(audioCtx.destination);

        // === Honk (one-shot) ===
        honkAudio = new Audio('sfx/car-honk.mp3');
        honkAudio.volume = 0.8;

        // === Synth RPM whine layer ===
        engineOsc = audioCtx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.setValueAtTime(50, audioCtx.currentTime);
        engineFilter = audioCtx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 300;
        engineGain = audioCtx.createGain();
        engineGain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(audioCtx.destination);
        engineOsc.start();

        // === REALISTIC TIRE SCREECH ===
        tireNoiseBuffer = createWhiteNoiseBuffer(audioCtx, 2);

        tireNoiseSource = audioCtx.createBufferSource();
        tireNoiseSource.buffer = tireNoiseBuffer;
        tireNoiseSource.loop = true;

        tireHighpass = audioCtx.createBiquadFilter();
        tireHighpass.type = 'highpass';
        tireHighpass.frequency.value = 1200;
        tireHighpass.Q.value = 0.5;

        tireBandpass = audioCtx.createBiquadFilter();
        tireBandpass.type = 'bandpass';
        tireBandpass.frequency.value = 2500;
        tireBandpass.Q.value = 1.5;

        tireBandpass2 = audioCtx.createBiquadFilter();
        tireBandpass2.type = 'bandpass';
        tireBandpass2.frequency.value = 3200;
        tireBandpass2.Q.value = 2.0;

        tireGain = audioCtx.createGain();
        tireGain.gain.setValueAtTime(0, audioCtx.currentTime);

        tireNoiseSource.connect(tireHighpass);
        tireHighpass.connect(tireBandpass);
        tireBandpass.connect(tireBandpass2);
        tireBandpass2.connect(tireGain);
        tireGain.connect(audioCtx.destination);
        tireNoiseSource.start();

        // === Boost rumble ===
        boostOsc = audioCtx.createOscillator();
        boostOsc.type = 'sine';
        boostOsc.frequency.value = 120;
        boostGain = audioCtx.createGain();
        boostGain.gain.setValueAtTime(0, audioCtx.currentTime);
        boostOsc.connect(boostGain);
        boostGain.connect(audioCtx.destination);
        boostOsc.start();

    } catch (e) {
        console.warn('Audio init failed:', e);
    }
};

export const playHonk = () => {
    if (honkAudio) {
        honkAudio.currentTime = 0;
        honkAudio.play().catch(() => { });
    }
};

export const updateAudio = (rpm, isDrifting, isBraking, isBoosting, speed, steerAmount) => {
    if (!audioCtx || audioCtx.state === 'suspended') {
        audioCtx?.resume();
        return;
    }

    // --- Engine MP3: pitch scales with RPM ---
    const rpmFactor = Math.max(0, Math.min(1, (rpm - 800) / 7200));
    if (engineAudio) {
        engineAudio.playbackRate = 0.7 + rpmFactor * 1.3;
        if (engineGainNode) {
            const vol = 0.3 + rpmFactor * 0.5;
            engineGainNode.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
        }
    }

    // --- Synth RPM whine ---
    const targetFreq = 45 + rpmFactor * 220 + (isBoosting ? 50 : 0);
    engineOsc.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.15);
    engineFilter.frequency.setTargetAtTime(180 + rpmFactor * 450, audioCtx.currentTime, 0.1);
    engineGain.gain.setTargetAtTime(0.03 + rpmFactor * 0.07, audioCtx.currentTime, 0.1);

    // --- TIRE SCREECH ---
    let tireVolume = 0;
    let tirePitch = 2500;
    const steerAbs = Math.abs(steerAmount || 0);

    if (isDrifting) {
        tireVolume = 0.25 + Math.min(speed * 0.002, 0.15);
        tirePitch = 1800 + Math.random() * 600;
    } else if (steerAbs > 0.05 && speed > 15) {
        const cornerIntensity = steerAbs * Math.min(speed / 80, 1);
        tireVolume = cornerIntensity * 0.18;
        tirePitch = 2200 + cornerIntensity * 1500;
    }

    if (isBraking && speed > 10) {
        tireVolume = Math.max(tireVolume, 0.12 + Math.min(speed * 0.001, 0.1));
        tirePitch = Math.min(tirePitch, 2000);
    }

    tireGain?.gain.setTargetAtTime(tireVolume, audioCtx.currentTime, 0.06);
    tireBandpass?.frequency.setTargetAtTime(tirePitch, audioCtx.currentTime, 0.08);
    tireBandpass2?.frequency.setTargetAtTime(tirePitch * 1.2 + Math.random() * 200, audioCtx.currentTime, 0.08);

    // --- Boost rumble ---
    if (isBoosting) {
        boostGain.gain.setTargetAtTime(0.1, audioCtx.currentTime, 0.05);
        boostOsc.frequency.setTargetAtTime(85 + Math.random() * 35, audioCtx.currentTime, 0.05);
    } else {
        boostGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
    }
};
