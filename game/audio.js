const ENGINE = {
    MIN_PLAYBACK_RATE: 0.7,
    MAX_PLAYBACK_RATE: 2.0,
    MIN_VOLUME: 0.3,
    MAX_VOLUME: 0.8,
    RPM_MIN: 800,
    RPM_MAX: 8000,
};

const SYNTH = {
    FREQ_MIN: 45,
    FREQ_MAX: 265,
    FILTER_MIN: 180,
    FILTER_MAX: 630,
    GAIN_MIN: 0.03,
    GAIN_MAX: 0.1,
    BOOST_OFFSET: 50,
};

const TIRE = {
    HIGHPASS_FREQ: 1200,
    HIGHPASS_Q: 0.5,
    BANDPASS_BASE: 2500,
    BANDPASS_Q: 1.5,
    BANDPASS2_RATIO: 1.2,
    BANDPASS2_Q: 2.0,
    VOLUME_DRIFT: 0.25,
    VOLUME_CORNER_MAX: 0.18,
    VOLUME_BRAKE: 0.12,
    STEER_THRESHOLD: 0.05,
    SPEED_THRESHOLD: 15,
    BRAKE_SPEED_THRESHOLD: 10,
};

const BOOST = {
    FREQ_MIN: 85,
    FREQ_RANGE: 35,
    GAIN: 0.1,
};

let audioCtx = null;
let engineAudio = null;
let engineGainNode = null;
let honkAudio = null;
let engineOsc, engineGain, engineFilter;
let boostOsc, boostGain;
let tireNoiseSource = null;
let tireBandpass, tireBandpass2, tireGain, tireHighpass;

const createWhiteNoiseBuffer = (ctx, durationSec = 2) => {
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
    if (typeof window === 'undefined') return;
    if (audioCtx) return;

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();

        engineAudio = new Audio('/sfx/car-engine-idle.mp3');
        engineAudio.loop = true;
        engineAudio.volume = 0.6;
        engineAudio.playbackRate = 1.0;
        engineAudio.play().catch(() => {
            document.addEventListener('click', function resume() {
                engineAudio.play();
                document.removeEventListener('click', resume);
            }, { once: true });
        });

        const source = audioCtx.createMediaElementSource(engineAudio);
        engineGainNode = audioCtx.createGain();
        engineGainNode.gain.value = 0.6;
        source.connect(engineGainNode);
        engineGainNode.connect(audioCtx.destination);

        honkAudio = new Audio('/sfx/car-honk.mp3');
        honkAudio.volume = 0.8;

        engineOsc = audioCtx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.setValueAtTime(SYNTH.FREQ_MIN, audioCtx.currentTime);
        engineFilter = audioCtx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = SYNTH.FILTER_MIN;
        engineGain = audioCtx.createGain();
        engineGain.gain.setValueAtTime(SYNTH.GAIN_MIN, audioCtx.currentTime);
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(audioCtx.destination);
        engineOsc.start();

        const noiseBuffer = createWhiteNoiseBuffer(audioCtx, 2);
        tireNoiseSource = audioCtx.createBufferSource();
        tireNoiseSource.buffer = noiseBuffer;
        tireNoiseSource.loop = true;

        tireHighpass = audioCtx.createBiquadFilter();
        tireHighpass.type = 'highpass';
        tireHighpass.frequency.value = TIRE.HIGHPASS_FREQ;
        tireHighpass.Q.value = TIRE.HIGHPASS_Q;

        tireBandpass = audioCtx.createBiquadFilter();
        tireBandpass.type = 'bandpass';
        tireBandpass.frequency.value = TIRE.BANDPASS_BASE;
        tireBandpass.Q.value = TIRE.BANDPASS_Q;

        tireBandpass2 = audioCtx.createBiquadFilter();
        tireBandpass2.type = 'bandpass';
        tireBandpass2.frequency.value = TIRE.BANDPASS_BASE * TIRE.BANDPASS2_RATIO;
        tireBandpass2.Q.value = TIRE.BANDPASS2_Q;

        tireGain = audioCtx.createGain();
        tireGain.gain.setValueAtTime(0, audioCtx.currentTime);

        tireNoiseSource.connect(tireHighpass);
        tireHighpass.connect(tireBandpass);
        tireBandpass.connect(tireBandpass2);
        tireBandpass2.connect(tireGain);
        tireGain.connect(audioCtx.destination);
        tireNoiseSource.start();

        boostOsc = audioCtx.createOscillator();
        boostOsc.type = 'sine';
        boostOsc.frequency.value = BOOST.FREQ_MIN;
        boostGain = audioCtx.createGain();
        boostGain.gain.setValueAtTime(0, audioCtx.currentTime);
        boostOsc.connect(boostGain);
        boostGain.connect(audioCtx.destination);
        boostOsc.start();
    } catch (e) {
        console.warn('Audio init failed:', e);
    }
};

export const cleanupAudio = () => {
    try {
        engineOsc?.stop();
        boostOsc?.stop();
        tireNoiseSource?.stop();
    } catch { }

    if (engineAudio) {
        engineAudio.pause();
        engineAudio.src = '';
        engineAudio = null;
    }

    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }

    engineGainNode = null;
    honkAudio = null;
    engineOsc = engineGain = engineFilter = null;
    boostOsc = boostGain = null;
    tireNoiseSource = tireBandpass = tireBandpass2 = tireGain = tireHighpass = null;
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

    const now = audioCtx.currentTime;
    const rpmFactor = Math.max(0, Math.min(1, (rpm - ENGINE.RPM_MIN) / (ENGINE.RPM_MAX - ENGINE.RPM_MIN)));

    if (engineAudio) {
        engineAudio.playbackRate = ENGINE.MIN_PLAYBACK_RATE + rpmFactor * (ENGINE.MAX_PLAYBACK_RATE - ENGINE.MIN_PLAYBACK_RATE);
        if (engineGainNode) {
            const vol = ENGINE.MIN_VOLUME + rpmFactor * (ENGINE.MAX_VOLUME - ENGINE.MIN_VOLUME);
            engineGainNode.gain.setTargetAtTime(vol, now, 0.1);
        }
    }

    const targetFreq = SYNTH.FREQ_MIN + rpmFactor * (SYNTH.FREQ_MAX - SYNTH.FREQ_MIN) + (isBoosting ? SYNTH.BOOST_OFFSET : 0);
    engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.15);
    engineFilter.frequency.setTargetAtTime(SYNTH.FILTER_MIN + rpmFactor * (SYNTH.FILTER_MAX - SYNTH.FILTER_MIN), now, 0.1);
    engineGain.gain.setTargetAtTime(SYNTH.GAIN_MIN + rpmFactor * (SYNTH.GAIN_MAX - SYNTH.GAIN_MIN), now, 0.1);

    let tireVolume = 0;
    let tirePitch = TIRE.BANDPASS_BASE;
    const steerAbs = Math.abs(steerAmount || 0);

    if (isDrifting) {
        tireVolume = TIRE.VOLUME_DRIFT + Math.min(speed * 0.002, 0.15);
        tirePitch = 1800 + Math.random() * 600;
    } else if (steerAbs > TIRE.STEER_THRESHOLD && speed > TIRE.SPEED_THRESHOLD) {
        const cornerIntensity = steerAbs * Math.min(speed / 80, 1);
        tireVolume = cornerIntensity * TIRE.VOLUME_CORNER_MAX;
        tirePitch = 2200 + cornerIntensity * 1500;
    }

    if (isBraking && speed > TIRE.BRAKE_SPEED_THRESHOLD) {
        tireVolume = Math.max(tireVolume, TIRE.VOLUME_BRAKE + Math.min(speed * 0.001, 0.1));
        tirePitch = Math.min(tirePitch, 2000);
    }

    tireGain?.gain.setTargetAtTime(tireVolume, now, 0.06);
    tireBandpass?.frequency.setTargetAtTime(tirePitch, now, 0.08);
    tireBandpass2?.frequency.setTargetAtTime(tirePitch * TIRE.BANDPASS2_RATIO + Math.random() * 200, now, 0.08);

    if (isBoosting) {
        boostGain.gain.setTargetAtTime(BOOST.GAIN, now, 0.05);
        boostOsc.frequency.setTargetAtTime(BOOST.FREQ_MIN + Math.random() * BOOST.FREQ_RANGE, now, 0.05);
    } else {
        boostGain.gain.setTargetAtTime(0, now, 0.15);
    }
};
