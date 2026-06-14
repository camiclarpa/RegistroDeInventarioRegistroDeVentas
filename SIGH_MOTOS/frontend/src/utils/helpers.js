import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs) => twMerge(clsx(inputs));
export function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const generateId = () => Math.random().toString(36).substring(2, 9);
export const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};
export const beepSound = () => {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    }
    catch {
        // AudioContext not available
    }
};
export const truncate = (str, maxLen = 40) => str.length > maxLen ? str.slice(0, maxLen - 3) + '…' : str;
export const todayISO = () => new Date().toISOString().split('T')[0];
export const startOfMonthISO = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
};
