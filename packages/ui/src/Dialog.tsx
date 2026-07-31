import React from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

import { modalOverlayMotion, modalPanelMotion } from './motion';
import { useModalIsolation } from './ModalIsolation';

export interface DialogProps {
  children: React.ReactNode;
  className: string;
  titleId: string;
  closeDisabled?: boolean;
  descriptionId?: string;
  id?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  overlayClassName?: string;
  onClose: () => void;
  style?: React.CSSProperties;
}

const dialogOverlayClassName =
  'dialog-backdrop fixed inset-0 z-[120] flex items-end justify-center bg-ui-text/40 dark:bg-ui-bg/75 sm:items-center sm:p-4';

export const Dialog: React.FC<DialogProps> = ({
  children,
  className,
  titleId,
  closeDisabled = false,
  descriptionId,
  id,
  initialFocusRef,
  overlayClassName,
  onClose,
  style
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { isTopmost, onKeyDown } = useModalIsolation({
    closeDisabled,
    containerRef,
    initialFocusRef,
    onClose,
    open: true,
    panelRef
  });
  const reducedMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.01 }
  } as const;

  const dialog = (
    <motion.div
      {...(shouldReduceMotion ? reducedMotion : modalOverlayMotion)}
      ref={containerRef}
      className={twMerge(dialogOverlayClassName, overlayClassName)}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled && isTopmost()) {
          onClose();
        }
      }}
    >
      <motion.div
        {...(shouldReduceMotion ? reducedMotion : modalPanelMotion)}
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={className}
        style={style}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );

  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body);
};
