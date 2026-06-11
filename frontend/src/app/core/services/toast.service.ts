import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);

  show(title: string, message: string, type: ToastMessage['type'] = 'info'): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.messages.update((current) => [...current, { id, title, message, type }]);

    setTimeout(() => {
      this.dismiss(id);
    }, 3000);
  }

  dismiss(id: string): void {
    this.messages.update((current) => current.filter((toast) => toast.id !== id));
  }
}
