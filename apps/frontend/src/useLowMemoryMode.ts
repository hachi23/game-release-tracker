import { useEffect, useState } from "react";

// Settings → Appearance: toggle desktop low-memory mode (disables Chromium GPU acceleration).
// Enabled by default for 2 GB+ systems; outside the desktop app the switch is not shown.
export function useLowMemoryMode() {
  const [state, setState] = useState<LowMemoryModeState>({ supported: false, enabled: true, active: true });

  useEffect(() => {
    let live = true;
    void window.releaseTracker?.getLowMemoryMode?.().then(next => {
      if (live) setState(next);
    }, () => undefined);
    return () => { live = false; };
  }, []);

  const setEnabled = async (on: boolean) => {
    const bridge = window.releaseTracker?.setLowMemoryMode;
    if (!bridge) return;
    setState(current => ({ ...current, enabled: on }));
    try {
      setState(await bridge(on));
    } catch {
      setState(current => ({ ...current, enabled: !on }));
    }
  };

  const relaunch = () => window.releaseTracker?.relaunchApp?.();

  return {
    ...state,
    restartRequired: state.supported && state.enabled !== state.active,
    setEnabled,
    relaunch
  };
}
