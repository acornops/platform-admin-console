import React from 'react';

import { formInputClassName, formTextareaClassName } from './formControlStyles';

export function textInputClassName(className?: string): string {
  return formInputClassName(className);
}

export type TextInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={textInputClassName(className)}
      {...props}
    />
  )
);

TextInput.displayName = 'TextInput';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={formTextareaClassName(className)}
      {...props}
    />
  )
);

Textarea.displayName = 'Textarea';
