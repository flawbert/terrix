const CHANNEL_NAME = 'terrix_live_sync_channel';

export function notifyLandLotChange(): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: 'LANDS_UPDATED', timestamp: Date.now() });
      channel.close();
    }
  } catch {
    // Fallback handled by polling
  }
}

export function subscribeToLandLotChanges(onUpdate: () => void): () => void {
  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = () => onUpdate();
    }
  } catch {
    // Ignore in environments without BroadcastChannel
  }

  const handleFocusOrVisibility = () => {
    if (document.visibilityState === 'visible') {
      onUpdate();
    }
  };

  window.addEventListener('focus', handleFocusOrVisibility);
  document.addEventListener('visibilitychange', handleFocusOrVisibility);

  const intervalId = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      onUpdate();
    }
  }, 3000);

  return () => {
    if (channel) channel.close();
    window.removeEventListener('focus', handleFocusOrVisibility);
    window.removeEventListener('visibilitychange', handleFocusOrVisibility);
    window.clearInterval(intervalId);
  };
}
