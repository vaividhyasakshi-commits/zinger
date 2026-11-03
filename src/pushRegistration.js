// Separate lifecycle logic so permission, concurrency, and logout races can be tested offline.
export function createPushRegistration(deps) {
  let generation = 0;
  let inFlight = null;
  let closing = Promise.resolve();

  function enable(user, { requestPermission = false } = {}) {
    if (!user || user.uid !== deps.currentUid()) return Promise.reject(new Error("Partner login required."));
    if (inFlight?.uid === user.uid && inFlight.generation === generation) return inFlight.promise;
    const permission = deps.permission();
    if (permission === "denied") return Promise.reject(new Error("Allow notifications in Chrome site settings, then try again."));
    if (permission === "unsupported") return Promise.reject(new Error("Notifications are unsupported in this browser."));
    if (permission !== "granted" && !requestPermission) return Promise.reject(new Error("Use Enable Beauty Offers to allow notifications."));
    // Request immediately within the button's user gesture, never from the restore path.
    const permissionResult = permission === "granted" ? Promise.resolve(permission) : deps.requestPermission();
    const current = generation;
    const pendingCleanup = closing;
    const check = () => {
      if (current !== generation || deps.currentUid() !== user.uid) throw new Error("Notification registration cancelled.");
    };
    const promise = (async () => {
      if (await permissionResult !== "granted") throw new Error("Notification permission was not granted.");
      // A quick re-login must not race the preceding session's token revocation.
      await pendingCleanup;
      check();
      const context = await deps.prepare();
      check();
      const token = await deps.token(context);
      if (!token) throw new Error("FCM could not generate a registration token.");
      check();
      await deps.save(user, token);
      check();
      await deps.setEnabled(true, context);
      check();
      return true;
    })().finally(() => {
      if (inFlight?.promise === promise) inFlight = null;
    });
    inFlight = { uid: user.uid, generation: current, promise };
    return promise;
  }

  function disable(user) {
    generation++;
    const previous = inFlight?.promise;
    const previousClosing = closing;
    const operation = (async () => {
      // Suppress notifications before waiting for token/network operations.
      const first = await Promise.allSettled([deps.setEnabled(false)]);
      await previousClosing;
      await previous?.catch(() => {});
      const results = await Promise.allSettled([
        deps.setEnabled(false),
        user ? deps.remove(user) : Promise.resolve(),
        deps.revoke(),
      ]);
      const failed = [...first, ...results].find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
    })();
    closing = operation.catch(() => {});
    return operation;
  }

  return { enable, disable, cancel: () => { generation++; } };
}
