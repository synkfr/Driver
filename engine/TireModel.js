import { clamp } from './MathUtils.js';
import { SURFACES } from './Surface.js';

const BASE_B_LAT = 10.0;
const BASE_C_LAT = 1.9;
const BASE_D_LAT = 1.0;
const BASE_E_LAT = 0.97;

const BASE_B_LONG = 12.0;
const BASE_C_LONG = 1.65;
const BASE_D_LONG = 1.0;
const BASE_E_LONG = 0.97;

const TEMP_OPTIMAL = 90;
const TEMP_COLD = 60;
const TEMP_HOT = 120;
const TEMP_HEAT_RATE = 40;
const TEMP_COOL_RATE = 15;
const TEMP_AMBIENT = 25;

const WEAR_RATE = 0.00001;
const WEAR_MAX = 0.3;

const pacejka = (slip, B, C, D, E) => {
    return D * Math.sin(C * Math.atan(B * slip - E * (B * slip - Math.atan(B * slip))));
};

const tempGripFactor = (temperature) => {
    if (temperature < TEMP_COLD) {
        return 0.7 + 0.3 * clamp((temperature - TEMP_AMBIENT) / (TEMP_COLD - TEMP_AMBIENT), 0, 1);
    }
    if (temperature <= TEMP_OPTIMAL) {
        return 0.85 + 0.15 * clamp((temperature - TEMP_COLD) / (TEMP_OPTIMAL - TEMP_COLD), 0, 1);
    }
    if (temperature <= TEMP_HOT) {
        return 1.0 - 0.15 * clamp((temperature - TEMP_OPTIMAL) / (TEMP_HOT - TEMP_OPTIMAL), 0, 1);
    }
    return 0.85 - 0.25 * clamp((temperature - TEMP_HOT) / 40, 0, 1);
};

export const computeLateralForce = (slipAngle, load, surface, temperature, wear) => {
    const surfData = surface || SURFACES.ASPHALT;
    const B = BASE_B_LAT * surfData.B;
    const C = BASE_C_LAT * surfData.C;
    const D = load * surfData.D * BASE_D_LAT;
    const E = BASE_E_LAT * surfData.E;

    const rawForce = pacejka(slipAngle, B, C, D, E);

    const tGrip = tempGripFactor(temperature);
    const wGrip = 1.0 - clamp(wear, 0, WEAR_MAX);

    return rawForce * tGrip * wGrip;
};

export const computeLongitudinalForce = (slipRatio, load, surface, temperature, wear) => {
    const surfData = surface || SURFACES.ASPHALT;
    const B = BASE_B_LONG * surfData.B;
    const C = BASE_C_LONG * surfData.C;
    const D = load * surfData.D * BASE_D_LONG;
    const E = BASE_E_LONG * surfData.E;

    const rawForce = pacejka(slipRatio, B, C, D, E);

    const tGrip = tempGripFactor(temperature);
    const wGrip = 1.0 - clamp(wear, 0, WEAR_MAX);

    return rawForce * tGrip * wGrip;
};

export const frictionCircle = (latForce, longForce, maxForce) => {
    const total = Math.sqrt(latForce * latForce + longForce * longForce);
    if (total > maxForce && total > 1e-6) {
        const scale = maxForce / total;
        return { lat: latForce * scale, long: longForce * scale, saturated: true };
    }
    return { lat: latForce, long: longForce, saturated: false };
};

export const updateTireTemperature = (currentTemp, slipMagnitude, load, airSpeed, dt) => {
    const heatGen = slipMagnitude * load * TEMP_HEAT_RATE * 0.0001;
    const cooling = (currentTemp - TEMP_AMBIENT) * TEMP_COOL_RATE * 0.01 * (1 + airSpeed * 0.005);
    return currentTemp + (heatGen - cooling) * dt;
};

export const updateTireWear = (currentWear, slipMagnitude, load, dt) => {
    const wearInc = slipMagnitude * load * WEAR_RATE * dt;
    return clamp(currentWear + wearInc, 0, WEAR_MAX);
};

export const computeSlipAngle = (lateralVel, forwardVel) => {
    if (Math.abs(forwardVel) < 0.5 && Math.abs(lateralVel) < 0.5) return 0;
    return Math.atan2(lateralVel, Math.abs(forwardVel));
};

export const computeSlipRatio = (wheelSpinSpeed, wheelRadius, forwardVel) => {
    const wheelLinearSpeed = wheelSpinSpeed * wheelRadius;
    const refSpeed = Math.max(Math.abs(forwardVel), 0.5);
    return (wheelLinearSpeed - forwardVel) / refSpeed;
};
