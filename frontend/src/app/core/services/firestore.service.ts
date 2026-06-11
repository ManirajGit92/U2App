import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  writeBatch,
  QueryConstraint,
  DocumentData,
  DocumentReference,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

/** A single batch operation descriptor. */
export interface BatchOp {
  type: 'set' | 'update' | 'delete';
  path: string;
  data?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private firestore = inject(Firestore);

  // ───────────────────── Path Helpers ──────────────────────

  /** Build a Firestore path scoped to a user + app module. */
  getUserAppPath(uid: string, appName: string): string {
    return `users/${uid}/apps/${appName}`;
  }

  /** Build a Firestore path to a subcollection within a user app. */
  getUserCollectionPath(uid: string, appName: string, collectionName: string): string {
    return `users/${uid}/apps/${appName}/${collectionName}`;
  }

  /** Build a path to the user profile document. */
  getUserProfilePath(uid: string): string {
    return `users/${uid}`;
  }

  // ───────────────────── Document Ops ─────────────────────

  /** Get a single document once. */
  async getDocument<T>(path: string): Promise<T | null> {
    const ref = doc(this.firestore, path) as DocumentReference<T>;
    const snap = await getDoc(ref);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
  }

  /** Subscribe to real-time updates on a single document. */
  watchDocument<T>(path: string): Observable<T | null> {
    return new Observable<T | null>((subscriber) => {
      const ref = doc(this.firestore, path);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          subscriber.next(
            snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as T) : null,
          );
        },
        (error) => subscriber.error(error),
      );
      return () => unsub();
    });
  }

  /** Create or fully overwrite a document. */
  async setDocument<T>(path: string, data: T): Promise<void> {
    const ref = doc(this.firestore, path);
    await setDoc(ref, data as DocumentData, { merge: true });
  }

  /** Partially update fields on an existing document. */
  async updateDocument<T>(path: string, data: T): Promise<void> {
    const ref = doc(this.firestore, path);
    await updateDoc(ref, data as DocumentData);
  }

  /** Delete a document. */
  async deleteDocument(path: string): Promise<void> {
    const ref = doc(this.firestore, path);
    await deleteDoc(ref);
  }

  // ───────────────────── Collection Ops ───────────────────

  /** Add a document with an auto-generated ID and return that ID. */
  async addDocument(collectionPath: string, data: Record<string, unknown>): Promise<string> {
    const col = collection(this.firestore, collectionPath);
    const ref = await addDoc(col, data);
    return ref.id;
  }

  /** Get all documents in a collection once. */
  async getCollection<T>(collectionPath: string): Promise<T[]> {
    const col = collection(this.firestore, collectionPath);
    const snap = await getDocs(col);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T);
  }

  /** Subscribe to real-time updates on a collection. */
  watchCollection<T>(collectionPath: string, ...constraints: QueryConstraint[]): Observable<T[]> {
    return new Observable<T[]>((subscriber) => {
      const col = collection(this.firestore, collectionPath);
      const q = constraints.length > 0 ? query(col, ...constraints) : query(col);
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T);
          subscriber.next(items);
        },
        (error) => subscriber.error(error),
      );
      return () => unsub();
    });
  }

  // ───────────────────── Batch Operations ─────────────────

  /** Execute multiple write operations atomically. */
  async batchWrite(operations: BatchOp[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    for (const op of operations) {
      const ref = doc(this.firestore, op.path);
      switch (op.type) {
        case 'set':
          batch.set(ref, op.data ?? {}, { merge: true });
          break;
        case 'update':
          batch.update(ref, op.data ?? {});
          break;
        case 'delete':
          batch.delete(ref);
          break;
      }
    }
    await batch.commit();
  }

  /**
   * Replace an entire collection's content by deleting all existing docs
   * and writing the new ones. Uses batch writes (max 500 per batch).
   */
  async replaceCollection(collectionPath: string, items: Record<string, unknown>[]): Promise<void> {
    // 1. Delete existing documents
    const col = collection(this.firestore, collectionPath);
    const existing = await getDocs(col);

    const deleteBatches = this.chunkArray(existing.docs, 450);
    for (const chunk of deleteBatches) {
      const batch = writeBatch(this.firestore);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // 2. Write new documents
    const writeBatches = this.chunkArray(items, 450);
    for (const chunk of writeBatches) {
      const batch = writeBatch(this.firestore);
      for (const item of chunk) {
        const docRef = doc(col); // auto-ID
        batch.set(docRef, item);
      }
      await batch.commit();
    }
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
