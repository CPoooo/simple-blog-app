/**
 * Lets a page veto "leave" actions that don't go through a link (the floating back
 * button, Cancel). The editor registers a guard while it has unsaved changes; with no
 * guard registered, leaving just happens.
 */
type Guard = (proceed: () => void, saveThenGoTo: string) => void;

let guard: Guard | null = null;

export function setLeaveGuard(next: Guard | null) {
  guard = next;
}

/** Run `proceed`, unless the current page wants to ask first ("are you sure?"). */
export function requestLeave(proceed: () => void, saveThenGoTo = "/me/posts") {
  if (guard) guard(proceed, saveThenGoTo);
  else proceed();
}
