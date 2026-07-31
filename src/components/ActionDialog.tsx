import { useId, type FormEvent, type ReactNode } from 'react';
import { Button, DialogFrame, InlineAlert } from '@acornops/ui';

export function ActionDialog({
  title,
  description,
  children,
  submitLabel,
  pendingLabel = 'Applying…',
  pending,
  danger,
  submitDisabled,
  error,
  onClose,
  onSubmit
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  danger?: boolean;
  submitDisabled?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const generatedId = useId();
  const titleId = `dialog-${generatedId}-title`;
  const formId = `dialog-${generatedId}-form`;
  return (
    <DialogFrame
      title={title}
      titleId={titleId}
      description={description}
      onClose={onClose}
      closeDisabled={pending}
      bodyClassName="bg-ui-surface"
      footer={(
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button className="w-full sm:w-auto" variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button className="w-full sm:w-auto" type="submit" form={formId} variant={danger ? 'danger' : 'primary'} disabled={pending || submitDisabled}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      )}
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-5">
        {children}
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
      </form>
    </DialogFrame>
  );
}
