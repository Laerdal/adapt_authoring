import { useEffect, useId, type RefObject } from 'react';

const MENU_OPEN_EVENT = 'sb-menu-open';

/**
 * Shared behaviour for the Storyboard dropdown menus: Escape closes the menu
 * (returning focus to its trigger) and opening one menu closes any other open
 * menu, so only one is ever expanded at a time.
 */
export function useExclusiveMenu(
  open: boolean,
  setOpen: (open: boolean) => void,
  triggerRef: RefObject<HTMLElement | null>,
) {
  const id = useId();

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(MENU_OPEN_EVENT, { detail: id }));
    const onOtherOpened = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener(MENU_OPEN_EVENT, onOtherOpened);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener(MENU_OPEN_EVENT, onOtherOpened);
      document.removeEventListener('keydown', onKeyDown);
    };
    // setOpen/triggerRef are stable for a given menu instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);
}
