import {
  getModalFocusWrapIndex,
  shouldCloseModalOnKeyDown
} from './ModalIsolation';

export const getOverlayFocusWrapIndex = getModalFocusWrapIndex;

export function shouldCloseOverlayOnKeyDown(
  key: string,
  closeDisabled = false
): boolean {
  return shouldCloseModalOnKeyDown(key, closeDisabled);
}
