import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  DocumentData,
} from '@angular/fire/firestore';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string;
  provider?: string;
  isAdmin?: boolean;
  active?: boolean;
  firestoreAccess?: boolean;
  accountStatus?: 'Active' | 'Disabled';
  createdAt?: string;
  lastLogin?: string;
  photoURL?: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private firestore = inject(Firestore);
  private readonly adminEmails = ['manirajmca.ac@gmail.com'];

  isAdminEmail(email: string | null | undefined): boolean {
    return !!email && this.adminEmails.includes(email.toLowerCase());
  }

  async getUser(uid: string): Promise<AppUser | null> {
    const ref = doc(this.firestore, `users/${uid}`);
    const snap = await getDoc(ref);
    return snap.exists() ? ({ uid: snap.id, ...(snap.data() as DocumentData) } as AppUser) : null;
  }

  async listUsers(): Promise<AppUser[]> {
    const col = collection(this.firestore, 'users');
    const snap = await getDocs(col);
    return snap.docs.map(
      (docSnap) => ({ uid: docSnap.id, ...(docSnap.data() as DocumentData) }) as AppUser,
    );
  }

  async updateUser(uid: string, data: Partial<AppUser>): Promise<void> {
    const ref = doc(this.firestore, `users/${uid}`);
    await updateDoc(ref, data as DocumentData);
  }

  async createUser(uid: string, data: Partial<AppUser>): Promise<void> {
    const ref = doc(this.firestore, `users/${uid}`);
    await setDoc(ref, data as DocumentData, { merge: true });
  }
}
