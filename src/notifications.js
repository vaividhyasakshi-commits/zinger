
const SOUND_KEY = "zinger-sound-enabled";

let audioContext = null;

export function isSoundEnabled() {
  return localStorage.getItem(SOUND_KEY) !== "false";
}

export function setSoundEnabled(enabled) {
  localStorage.setItem(SOUND_KEY, String(enabled));
}

export async function unlockNotificationSound() {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return false;

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    return audioContext.state === "running";
  } catch (error) {
    console.warn("Sound unavailable:", error);
    return false;
  }
}

export function playNotificationSound() {
  if (!isSoundEnabled()) return;
  if (!audioContext || audioContext.state !== "running") return;

  const ctx = audioContext;
  const start = ctx.currentTime;

  const notes = [
    { frequency: 880, delay: 0, duration: 0.12 },
    { frequency: 1174.66, delay: 0.10, duration: 0.20 },
  ];

  notes.forEach(({ frequency, delay, duration }) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    const time = start + delay;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(
      0.12,
      time + 0.015
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      time + duration
    );

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(time);
    oscillator.stop(time + duration);
  });
}

export async function enableBeautyNotifications() {
  if (!("Notification" in window)) {
    return {
      success: false,
      message: "Notifications are not supported on this device.",
    };
  }

  try {
    const permission = await Notification.requestPermission();

    return {
      success: permission === "granted",
      message:
        permission === "granted"
          ? "Beauty notifications enabled!"
          : "Please allow notifications in browser settings.",
    };
  } catch {
    return {
      success: false,
      message: "Could not enable notifications.",
    };
  }
}

export async function showBeautyNotification(unreadCount) {
  if (
    unreadCount <= 0 ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const productText =
    unreadCount === 1 ? "product" : "products";

  const title = "Beauty Deals • 20% OFF 💗";
  const body =
    `${unreadCount} ${productText} waiting for you! ✨`;

  const options = {
    body,
    tag: "zinger-beauty-offer",
    renotify: false,
    silent: true,
    icon: `${import.meta.env.BASE_URL}favicon.svg`,
    data: {
      url: window.location.href,
    },
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
    } else {
      const notification = new Notification(title, options);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  } catch (error) {
    console.warn("Beauty notification failed:", error);
  }
}
