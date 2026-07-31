export interface ToastInput {
  message: string;
  tone?: 'success' | 'danger';
}

export interface PageProps {
  resourceId?: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  notify: (input: string | ToastInput) => void;
  canMutate: boolean;
}
