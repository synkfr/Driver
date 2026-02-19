// ==========================================
// INPUT — Keyboard & Mobile Touch
// ==========================================

export const keys = {
    w: false, a: false, s: false, d: false,
    space: false, shift: false, c: false, n: false, h: false,
};

export const initKeyboard = (onCameraToggle, onNightToggle, onHonk) => {
    document.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (k === ' ') { keys.space = true; e.preventDefault(); }
        else if (k === 'shift') keys.shift = true;
        else if (k in keys) keys[k] = true;

        if (k === 'c' && !e.repeat) onCameraToggle();
        if (k === 'n' && !e.repeat) onNightToggle();
        if (k === 'h' && !e.repeat && onHonk) onHonk();
    });

    document.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (k === ' ') keys.space = false;
        else if (k === 'shift') keys.shift = false;
        else if (k in keys) keys[k] = false;
    });
};

export const setupMobileControls = () => {
    const touchButtons = {
        'mobile-left': 'a',
        'mobile-right': 'd',
        'mobile-gas': 'w',
        'mobile-brake': 's',
        'mobile-boost': 'shift',
    };

    for (const [id, key] of Object.entries(touchButtons)) {
        const btn = document.getElementById(id);
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys[key] = true;
        });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[key] = false;
        });
    }
};
