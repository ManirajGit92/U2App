import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { UserService, AppUser } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-user-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="admin-page">
      <div class="admin-header">
        <div>
          <h1>User management</h1>
          <p>Review accounts, grant Firestore access, and manage active status for users.</p>
        </div>
        <button class="btn btn-primary" type="button" (click)="fetchUsers()" [disabled]="isLoading">
          {{ isLoading ? 'Refreshing…' : 'Refresh users' }}
        </button>
      </div>

      @if (errorMessage) {
        <div class="alert error">{{ errorMessage }}</div>
      }

      <div class="user-table-wrapper">
        @if (!users.length && !isLoading) {
          <div class="empty-state">No users found yet.</div>
        }

        <table *ngIf="users.length > 0" class="user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Admin</th>
              <th>Firestore</th>
              <th>Status</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (user of users; track user.uid) {
              <tr>
                <td>{{ user.displayName || user.username || '–' }}</td>
                <td>{{ user.email }}</td>
                <td>
                  <label class="switch">
                    <input
                      type="checkbox"
                      [checked]="user.isAdmin"
                      (change)="toggleAdmin(user, $event.target.checked)"
                      [disabled]="user.uid === currentUserId"
                    />
                    <span class="slider"></span>
                  </label>
                </td>
                <td>
                  <label class="switch">
                    <input
                      type="checkbox"
                      [checked]="user.firestoreAccess"
                      (change)="toggleFirestoreAccess(user, $event.target.checked)"
                    />
                    <span class="slider"></span>
                  </label>
                </td>
                <td>
                  <select
                    #statusSelect
                    [value]="user.accountStatus"
                    (change)="updateStatus(user, statusSelect.value)"
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </td>
                <td>{{ user.lastLogin || 'Never' }}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" type="button" (click)="saveUser(user)">
                    Save
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [
    `
      .admin-page {
        min-height: 100vh;
        padding: 1rem;
      }
      .admin-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .admin-header h1 {
        margin: 0;
        font-size: 1.75rem;
      }
      .admin-header p {
        margin: 0.5rem 0 0 0;
        color: var(--text-secondary);
      }
      .alert {
        margin-bottom: 1rem;
        padding: 0.85rem 1rem;
        border-radius: var(--radius-md);
      }
      .alert.error {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.25);
        color: #b91c1c;
      }
      .user-table-wrapper {
        overflow-x: auto;
      }
      .empty-state {
        padding: 1.5rem;
        border: 1px dashed var(--border-color);
        border-radius: var(--radius-md);
        color: var(--text-secondary);
        text-align: center;
      }
      .user-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 840px;
      }
      .user-table th,
      .user-table td {
        padding: 0.85rem 0.75rem;
        border-bottom: 1px solid var(--border-color);
        text-align: left;
      }
      .user-table th {
        color: var(--text-secondary);
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      select {
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 0.45rem 0.5rem;
        background: var(--bg-primary);
        color: var(--text-primary);
      }
      .btn-sm {
        padding: 0.45rem 0.7rem;
        font-size: 0.82rem;
      }
      .switch {
        position: relative;
        display: inline-block;
        width: 40px;
        height: 22px;
      }
      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background-color: var(--border-color);
        border-radius: 999px;
        transition: background-color 0.15s ease-in-out;
      }
      .slider::before {
        content: '';
        position: absolute;
        left: 3px;
        top: 3px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: white;
        transition: transform 0.15s ease-in-out;
      }
      input:checked + .slider {
        background-color: var(--accent-primary);
      }
      input:checked + .slider::before {
        transform: translateX(18px);
      }
    `,
  ],
})
export class AdminComponent {
  authService = inject(FirebaseAuthService);
  userService = inject(UserService);
  toast = inject(ToastService);

  users: AppUser[] = [];
  errorMessage: string | null = null;
  isLoading = false;

  get currentUserId(): string | null {
    return this.authService.user()?.uid ?? null;
  }

  constructor() {
    this.fetchUsers();
  }

  async fetchUsers(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;

    try {
      this.users = await this.userService.listUsers();
    } catch (error: unknown) {
      this.errorMessage = (error as Error).message || 'Unable to load user list.';
    } finally {
      this.isLoading = false;
    }
  }

  async toggleFirestoreAccess(user: AppUser, enabled: boolean): Promise<void> {
    await this.persistUserChanges(user.uid, { firestoreAccess: enabled });
    user.firestoreAccess = enabled;
  }

  async toggleAdmin(user: AppUser, isAdmin: boolean): Promise<void> {
    if (user.uid === this.currentUserId) {
      this.toast.show(
        'Warning',
        'You cannot remove admin privileges from your own account here.',
        'warning',
      );
      return;
    }
    await this.persistUserChanges(user.uid, { isAdmin });
    user.isAdmin = isAdmin;
  }

  async updateStatus(user: AppUser, status: string): Promise<void> {
    const accountStatus = status === 'Disabled' ? 'Disabled' : 'Active';
    await this.persistUserChanges(user.uid, { accountStatus });
    user.accountStatus = accountStatus as AppUser['accountStatus'];
  }

  async saveUser(user: AppUser): Promise<void> {
    await this.persistUserChanges(user.uid, {
      firestoreAccess: user.firestoreAccess ?? false,
      isAdmin: user.isAdmin ?? false,
      accountStatus: user.accountStatus ?? 'Active',
    });
  }

  private async persistUserChanges(uid: string, changes: Partial<AppUser>): Promise<void> {
    try {
      await this.userService.updateUser(uid, changes);
      this.toast.show('Saved', 'User details updated successfully.', 'success');
    } catch (error: unknown) {
      this.toast.show('Error', 'Unable to update user details.', 'error');
      console.error('AdminComponent: saveUser failed', error);
    }
  }
}
