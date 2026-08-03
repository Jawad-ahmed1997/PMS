export const NOTIFICATION_SOUND_MUTED_KEY = "pms.notifications.sound-muted";
export const NOTIFICATION_SOUND_PREFERENCE_EVENT = "pms:notification-sound-preference";

export function isNotificationSoundMuted() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(NOTIFICATION_SOUND_MUTED_KEY) === "true";
}

export function setNotificationSoundMuted(muted) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIFICATION_SOUND_MUTED_KEY, String(Boolean(muted)));
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_SOUND_PREFERENCE_EVENT, {
      detail: { muted: Boolean(muted) },
    }),
  );
}
