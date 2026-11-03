let audioContext = null;
let generation = 0;
const oscillators = new Set();

export function isSoundEnabled() {
  try { return localStorage.getItem("zinger-sound") !== "off"; }
  catch { return true; }
}

export function setSoundEnabled(enabled) {
  try { localStorage.setItem("zinger-sound", enabled ? "on" : "off"); }
  catch { /* Sound still works when browser storage is unavailable. */ }
}

export async function unlockNotificationSound() {
  const current = generation;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    audioContext ||= new AudioContextClass();
    if (audioContext.state !== "running") await audioContext.resume();
    if (current !== generation) {
      await audioContext.suspend();
      return false;
    }
    return audioContext.state === "running";
  } catch { return false; }
}

export function playNotificationSound() {
  if (!isSoundEnabled() || audioContext?.state !== "running") return;
  const ctx = audioContext;
  const start = ctx.currentTime;
  for (const [frequency, delay, duration] of [[880, 0, 0.12], [1174.66, 0.1, 0.2]]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const at = start + delay;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.08, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillators.add(oscillator);
    oscillator.onended = () => {
      oscillators.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(at);
    oscillator.stop(at + duration);
  }
}

export function stopNotificationSound() {
  generation++;
  for (const oscillator of oscillators) {
    try { oscillator.stop(); } catch { /* Already ended. */ }
  }
  oscillators.clear();
  audioContext?.suspend().catch(() => {});
}
