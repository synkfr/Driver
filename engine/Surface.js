export const SURFACES = {
    ASPHALT: {
        name: 'asphalt',
        friction: 1.0,
        roughness: 0.8,
        dust: 0.0,
        B: 1.0, C: 1.0, D: 1.0, E: 1.0,
    },
    WET_ASPHALT: {
        name: 'wet_asphalt',
        friction: 0.7,
        roughness: 0.6,
        dust: 0.0,
        B: 0.85, C: 0.95, D: 0.7, E: 1.1,
    },
    DIRT: {
        name: 'dirt',
        friction: 0.6,
        roughness: 1.0,
        dust: 0.8,
        B: 0.7, C: 0.8, D: 0.6, E: 0.9,
    },
    ICE: {
        name: 'ice',
        friction: 0.15,
        roughness: 0.2,
        dust: 0.0,
        B: 0.4, C: 0.5, D: 0.15, E: 1.2,
    },
    PUDDLE: {
        name: 'puddle',
        friction: 0.3,
        roughness: 0.1,
        dust: 0.0,
        B: 0.5, C: 0.6, D: 0.3, E: 1.0,
        hydroplaneSpeedThreshold: 60,
    },
};

export const getSurface = (name) => {
    return SURFACES[name] || SURFACES.ASPHALT;
};
