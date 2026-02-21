import { Vec3, clamp } from './MathUtils.js';
import { SURFACES } from './Surface.js';

export class Weather {
    constructor() {
        this.type = 'clear';
        this.intensity = 0;
        this.windDirection = new Vec3(1, 0, 0);
        this.windSpeed = 0;
        this.puddles = [];
    }

    setWeather(type, intensity = 0.5) {
        this.type = type;
        this.intensity = clamp(intensity, 0, 1);
    }

    setWind(dirX, dirZ, speed) {
        this.windDirection.set(dirX, 0, dirZ).normalize();
        this.windSpeed = speed;
    }

    addPuddle(x, z, radius, depth = 0.05) {
        this.puddles.push({ x, z, radius, depth });
    }

    clearPuddles() {
        this.puddles.length = 0;
    }

    getSurfaceModifier(worldX, worldZ) {
        if (this.type === 'clear') return SURFACES.ASPHALT;

        for (const p of this.puddles) {
            const dx = worldX - p.x;
            const dz = worldZ - p.z;
            if (dx * dx + dz * dz < p.radius * p.radius) {
                return SURFACES.PUDDLE;
            }
        }

        if (this.type === 'rain') {
            return SURFACES.WET_ASPHALT;
        }

        if (this.type === 'snow') {
            return SURFACES.ICE;
        }

        return SURFACES.ASPHALT;
    }

    getWindForce(frontalArea) {
        if (this.windSpeed < 0.1) return Vec3.ZERO();
        const force = 0.5 * 1.225 * this.windSpeed * this.windSpeed * frontalArea * 0.3;
        return this.windDirection.clone().scale(force);
    }

    checkHydroplane(speed, surface) {
        if (surface !== SURFACES.PUDDLE) return false;
        const threshold = surface.hydroplaneSpeedThreshold || 60;
        return speed > threshold;
    }

    reset() {
        this.type = 'clear';
        this.intensity = 0;
        this.windSpeed = 0;
        this.puddles.length = 0;
    }
}
