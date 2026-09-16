import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as XLSX from 'xlsx';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../core/services/firebase-sync.service';

const APP_NAME = 'lodge-booking';

export type RoomStatus = 'Available' | 'Reserved' | 'Occupied' | 'Cleaning' | 'Maintenance';
export type BookingStatus = 'Reserved' | 'Checked In' | 'Checked Out' | 'Cancelled';
export type PaymentStatus = 'Paid' | 'Partial' | 'Pending' | 'Refunded';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed';

export interface Room {
  id: string;
  number: string;
  type: string;
  floor: string;
  price: number;
  capacity: number;
  bedType: string;
  amenities: string[];
  status: RoomStatus;
  image: string;
  description: string;
}

export interface Guest {
  id: string;
  name: string;
  email: string;
  mobile: string;
  idProofType: string;
  idProofNumber: string;
  address: string;
}

export interface Booking {
  id: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  specialRequests: string;
  subtotal: number;
  taxes: number;
  discounts: number;
  additionalCharges: number;
  total: number;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  createdAt: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  method: string;
  amount: number;
  status: PaymentStatus;
  paidAt: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  title: string;
  staff: string;
  priority: 'Low' | 'Medium' | 'High';
  status: TaskStatus;
  createdAt: string;
}

export interface LodgeState {
  rooms: Room[];
  guests: Guest[];
  bookings: Booking[];
  payments: Payment[];
  expenses: Expense[];
  housekeeping: HousekeepingTask[];
}

export interface BookingDraft {
  roomId: string;
  guest: Omit<Guest, 'id'>;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  specialRequests: string;
  paymentMethod: string;
  paidAmount: number;
  checkInNow?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LodgeBookingService {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);
  private readonly storageKey = 'u2tools.lodgeBooking.v1';
  private readonly subject = new BehaviorSubject<LodgeState>(this.loadState());
  readonly state$ = this.subject.asObservable();
  private restoringFromCloud = false;

  get snapshot(): LodgeState {
    return this.subject.value;
  }

  constructor() {
    this.syncService.onAuthChange((uid) => {
      if (uid) {
        this.loadFromFirestore().catch((error) =>
          console.error('LodgeBookingService: failed to load from Firestore', error),
        );
      } else {
        this.subject.next(this.demoState());
        localStorage.removeItem(this.storageKey);
      }
    });
  }

  availableRooms(checkIn: string, checkOut: string, roomType = 'All', guests = 1): Room[] {
    return this.snapshot.rooms.filter((room) => {
      if (room.status === 'Maintenance') return false;
      if (room.capacity < guests) return false;
      if (roomType !== 'All' && room.type !== roomType) return false;
      return !this.hasOverlap(room.id, checkIn, checkOut);
    });
  }

  createBooking(
    draft: BookingDraft,
  ): { ok: true; booking: Booking } | { ok: false; message: string } {
    const room = this.snapshot.rooms.find((item) => item.id === draft.roomId);
    if (!room) return { ok: false, message: 'Select a valid room.' };
    if (this.hasOverlap(room.id, draft.checkIn, draft.checkOut)) {
      return { ok: false, message: `Room ${room.number} is already booked for those dates.` };
    }

    const nights = this.nightsBetween(draft.checkIn, draft.checkOut);
    const subtotal = nights * room.price * Math.max(1, draft.rooms);
    const taxes = Math.round(subtotal * 0.12);
    const total = subtotal + taxes;
    const paymentStatus =
      draft.paidAmount >= total ? 'Paid' : draft.paidAmount > 0 ? 'Partial' : 'Pending';
    const guest: Guest = { id: this.id('GST'), ...draft.guest };
    const booking: Booking = {
      id: this.id('SL'),
      guestId: guest.id,
      roomId: room.id,
      checkIn: draft.checkIn,
      checkOut: draft.checkOut,
      guests: draft.guests,
      rooms: draft.rooms,
      specialRequests: draft.specialRequests,
      subtotal,
      taxes,
      discounts: 0,
      additionalCharges: 0,
      total,
      paymentStatus,
      status: draft.checkInNow ? 'Checked In' : 'Reserved',
      createdAt: new Date().toISOString(),
    };

    const payment: Payment = {
      id: this.id('PAY'),
      bookingId: booking.id,
      method: draft.paymentMethod,
      amount: draft.paidAmount,
      status: paymentStatus,
      paidAt: new Date().toISOString(),
    };

    this.update({
      guests: [...this.snapshot.guests, guest],
      bookings: [booking, ...this.snapshot.bookings],
      payments: [payment, ...this.snapshot.payments],
      rooms: this.snapshot.rooms.map((item) =>
        item.id === room.id
          ? { ...item, status: draft.checkInNow ? 'Occupied' : 'Reserved' }
          : item,
      ),
    });
    return { ok: true, booking };
  }

  addOrUpdateRoom(room: Room): { ok: true } | { ok: false; message: string } {
    const normalizedNumber = room.number.trim().toLowerCase();
    if (!normalizedNumber) return { ok: false, message: 'Room number is required.' };
    if (!room.type.trim()) return { ok: false, message: 'Room type is required.' };
    if (!room.floor.trim()) return { ok: false, message: 'Floor is required.' };
    if (!room.bedType.trim()) return { ok: false, message: 'Bed type is required.' };
    if (!Number.isFinite(room.price) || room.price <= 0)
      return { ok: false, message: 'Price must be greater than 0.' };
    if (!Number.isFinite(room.capacity) || room.capacity <= 0)
      return { ok: false, message: 'Capacity must be greater than 0.' };
    if (!room.image.trim()) return { ok: false, message: 'Room image URL is required.' };
    if (!room.description.trim()) return { ok: false, message: 'Room description is required.' };
    if (!room.amenities.length) return { ok: false, message: 'Select at least one amenity.' };
    if (
      this.snapshot.rooms.some(
        (item) => item.id !== room.id && item.number.trim().toLowerCase() === normalizedNumber,
      )
    ) {
      return { ok: false, message: `Room number ${room.number.trim()} already exists.` };
    }

    const normalizedRoom: Room = {
      ...room,
      id: room.id || this.id('ROOM'),
      number: room.number.trim(),
      type: room.type.trim(),
      floor: room.floor.trim(),
      bedType: room.bedType.trim(),
      image: room.image.trim(),
      description: room.description.trim(),
      price: Number(room.price),
      capacity: Number(room.capacity),
      amenities: [...new Set(room.amenities.map((amenity) => amenity.trim()).filter(Boolean))],
    };
    const exists = this.snapshot.rooms.some((item) => item.id === normalizedRoom.id);
    this.update({
      rooms: exists
        ? this.snapshot.rooms.map((item) => (item.id === normalizedRoom.id ? normalizedRoom : item))
        : [normalizedRoom, ...this.snapshot.rooms],
    });
    return { ok: true };
  }

  deleteRoom(roomId: string): { ok: boolean; message: string } {
    const active = this.snapshot.bookings.some(
      (booking) =>
        booking.roomId === roomId && !['Checked Out', 'Cancelled'].includes(booking.status),
    );
    if (active) return { ok: false, message: 'Cannot delete a room with active bookings.' };
    this.update({ rooms: this.snapshot.rooms.filter((room) => room.id !== roomId) });
    return { ok: true, message: 'Room deleted.' };
  }

  cycleRoomStatus(roomId: string): void {
    const next: Record<RoomStatus, RoomStatus> = {
      Available: 'Reserved',
      Reserved: 'Occupied',
      Occupied: 'Cleaning',
      Cleaning: 'Available',
      Maintenance: 'Available',
    };
    this.setRoomStatus(roomId, next[this.roomById(roomId)?.status || 'Available']);
  }

  setRoomStatus(roomId: string, status: RoomStatus): void {
    this.update({
      rooms: this.snapshot.rooms.map((room) => (room.id === roomId ? { ...room, status } : room)),
    });
  }

  checkIn(bookingId: string): void {
    const booking = this.snapshot.bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    this.update({
      bookings: this.snapshot.bookings.map((item) =>
        item.id === bookingId ? { ...item, status: 'Checked In' } : item,
      ),
      rooms: this.snapshot.rooms.map((room) =>
        room.id === booking.roomId ? { ...room, status: 'Occupied' } : room,
      ),
    });
  }

  checkOut(bookingId: string): void {
    const booking = this.snapshot.bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    const task: HousekeepingTask = {
      id: this.id('HSK'),
      roomId: booking.roomId,
      title: 'Post checkout cleaning',
      staff: 'Team A',
      priority: 'High',
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    this.update({
      bookings: this.snapshot.bookings.map((item) =>
        item.id === bookingId ? { ...item, status: 'Checked Out' } : item,
      ),
      rooms: this.snapshot.rooms.map((room) =>
        room.id === booking.roomId ? { ...room, status: 'Cleaning' } : room,
      ),
      housekeeping: [task, ...this.snapshot.housekeeping],
    });
  }

  updatePayment(bookingId: string, method: string, amount: number): void {
    const booking = this.snapshot.bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    const status: PaymentStatus =
      amount >= booking.total ? 'Paid' : amount > 0 ? 'Partial' : 'Pending';
    const payment: Payment = {
      id: this.id('PAY'),
      bookingId,
      method,
      amount,
      status,
      paidAt: new Date().toISOString(),
    };
    this.update({
      bookings: this.snapshot.bookings.map((item) =>
        item.id === bookingId ? { ...item, paymentStatus: status } : item,
      ),
      payments: [payment, ...this.snapshot.payments],
    });
  }

  addExpense(expense: Omit<Expense, 'id'>): void {
    this.update({ expenses: [{ id: this.id('EXP'), ...expense }, ...this.snapshot.expenses] });
  }

  updateHousekeeping(taskId: string, status: TaskStatus): void {
    const task = this.snapshot.housekeeping.find((item) => item.id === taskId);
    const updates: Partial<LodgeState> = {
      housekeeping: this.snapshot.housekeeping.map((item) =>
        item.id === taskId ? { ...item, status } : item,
      ),
    };
    if (task && status === 'Completed') {
      updates.rooms = this.snapshot.rooms.map((room) =>
        room.id === task.roomId && room.status === 'Cleaning'
          ? { ...room, status: 'Available' }
          : room,
      );
    }
    this.update(updates);
  }

  resetDemoData(): void {
    this.subject.next(this.demoState());
    this.persist();
    this.syncToFirestore();
  }

  exportWorkbook(): void {
    const wb = XLSX.utils.book_new();
    Object.entries(this.snapshot).forEach(([sheetName, rows]) => {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows as object[]), sheetName);
    });
    XLSX.writeFile(wb, 'lodge-booking-data.xlsx');
  }

  async importWorkbook(file: File): Promise<string> {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const next: LodgeState = { ...this.snapshot };
    let imported = 0;
    (
      [
        'rooms',
        'guests',
        'bookings',
        'payments',
        'expenses',
        'housekeeping',
      ] as (keyof LodgeState)[]
    ).forEach((key) => {
      const sheet = wb.Sheets[key];
      if (!sheet) return;
      const rows = XLSX.utils.sheet_to_json(sheet) as any[];
      if (rows.length) {
        (next[key] as any[]) = rows.map((row) => ({
          ...row,
          id: row.id || this.id(key.toUpperCase()),
        }));
        imported += rows.length;
      }
    });
    if (!imported)
      throw new Error(
        'No supported sheets found. Expected rooms, guests, bookings, payments, expenses, or housekeeping.',
      );
    this.subject.next(next);
    this.persist();
    this.syncToFirestore();
    return `${imported} records imported.`;
  }

  async syncAllToFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    const data = this.snapshot;
    await Promise.all([
      this.syncService.pushToFirestore(
        APP_NAME,
        'rooms',
        data.rooms as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'guests',
        data.guests as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'bookings',
        data.bookings as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'payments',
        data.payments as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'expenses',
        data.expenses as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'housekeeping',
        data.housekeeping as unknown as Record<string, unknown>[],
      ),
    ]);
  }

  async loadFromFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    try {
      const [rooms, guests, bookings, payments, expenses, housekeeping] = await Promise.all([
        this.syncService.pullFromFirestore<Room>(APP_NAME, 'rooms'),
        this.syncService.pullFromFirestore<Guest>(APP_NAME, 'guests'),
        this.syncService.pullFromFirestore<Booking>(APP_NAME, 'bookings'),
        this.syncService.pullFromFirestore<Payment>(APP_NAME, 'payments'),
        this.syncService.pullFromFirestore<Expense>(APP_NAME, 'expenses'),
        this.syncService.pullFromFirestore<HousekeepingTask>(APP_NAME, 'housekeeping'),
      ]);

      const hasCloudData =
        rooms.length > 0 ||
        guests.length > 0 ||
        bookings.length > 0 ||
        payments.length > 0 ||
        expenses.length > 0 ||
        housekeeping.length > 0;

      if (!hasCloudData) return;

      this.restoringFromCloud = true;
      this.subject.next({
        rooms: rooms.length ? rooms : this.snapshot.rooms,
        guests: guests.length ? guests : this.snapshot.guests,
        bookings: bookings.length ? bookings : this.snapshot.bookings,
        payments: payments.length ? payments : this.snapshot.payments,
        expenses: expenses.length ? expenses : this.snapshot.expenses,
        housekeeping: housekeeping.length ? housekeeping : this.snapshot.housekeeping,
      });
      this.persist();
    } catch (error) {
      console.error('LodgeBookingService: failed to load from Firestore', error);
    } finally {
      this.restoringFromCloud = false;
    }
  }

  roomById(roomId: string): Room | undefined {
    return this.snapshot.rooms.find((room) => room.id === roomId);
  }

  guestById(guestId: string): Guest | undefined {
    return this.snapshot.guests.find((guest) => guest.id === guestId);
  }

  nightsBetween(checkIn: string, checkOut: string): number {
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    return Math.max(1, Math.ceil((end - start) / 86400000));
  }

  private hasOverlap(roomId: string, checkIn: string, checkOut: string): boolean {
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    return this.snapshot.bookings.some((booking) => {
      if (booking.roomId !== roomId || ['Checked Out', 'Cancelled'].includes(booking.status))
        return false;
      const bookingStart = new Date(booking.checkIn).getTime();
      const bookingEnd = new Date(booking.checkOut).getTime();
      return start < bookingEnd && end > bookingStart;
    });
  }

  private update(patch: Partial<LodgeState>): void {
    this.subject.next({ ...this.snapshot, ...patch });
    this.persist();
    this.syncToFirestore();
  }

  private persist(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.snapshot));
  }

  private syncToFirestore(): void {
    if (this.restoringFromCloud || !this.authService.isAuthenticated()) return;
    this.syncAllToFirestore().catch((error) =>
      console.error('LodgeBookingService: Firestore sync failed', error),
    );
  }

  private loadState(): LodgeState {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) return JSON.parse(raw) as LodgeState;
    } catch {
      localStorage.removeItem(this.storageKey);
    }
    return this.demoState();
  }

  private id(prefix: string): string {
    return `${prefix}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  private demoState(): LodgeState {
    const rooms: Room[] = [
      this.room(
        '101',
        'Standard',
        '1',
        1000,
        2,
        '1 Queen Bed',
        'Available',
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=1200&auto=format&fit=crop',
      ),
      this.room(
        '102',
        'Standard',
        '1',
        1000,
        2,
        '1 Queen Bed',
        'Occupied',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1200&auto=format&fit=crop',
      ),
      this.room(
        '103',
        'Deluxe',
        '1',
        1500,
        3,
        '1 King Bed',
        'Reserved',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200&auto=format&fit=crop',
      ),
      this.room(
        '104',
        'Deluxe',
        '1',
        1500,
        3,
        '1 King Bed',
        'Available',
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop',
      ),
      this.room(
        '105',
        'Suite',
        '2',
        2500,
        4,
        '2 Queen Beds',
        'Occupied',
        'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=1200&auto=format&fit=crop',
      ),
      this.room(
        '106',
        'Standard',
        '2',
        1100,
        2,
        '1 Queen Bed',
        'Cleaning',
        'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1200&auto=format&fit=crop',
      ),
      this.room(
        '107',
        'Standard',
        '2',
        950,
        2,
        'Twin Beds',
        'Maintenance',
        'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?q=80&w=1200&auto=format&fit=crop',
      ),
      this.room(
        '108',
        'Family',
        '2',
        2200,
        5,
        '2 Double Beds',
        'Available',
        'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?q=80&w=1200&auto=format&fit=crop',
      ),
    ];
    const guests: Guest[] = [
      {
        id: 'GST001',
        name: 'Maniraj S',
        email: 'maniraj@email.com',
        mobile: '9876543210',
        idProofType: 'Aadhaar Card',
        idProofNumber: 'XXXX-1234',
        address: 'Chennai',
      },
      {
        id: 'GST002',
        name: 'Ms. Priya',
        email: 'priya@email.com',
        mobile: '9840011122',
        idProofType: 'Driving License',
        idProofNumber: 'DL-5542',
        address: 'Coimbatore',
      },
      {
        id: 'GST003',
        name: 'Mr. Karthik',
        email: 'karthik@email.com',
        mobile: '9790099900',
        idProofType: 'Passport',
        idProofNumber: 'P78452',
        address: 'Madurai',
      },
    ];
    const bookings: Booking[] = [
      this.booking(
        'SL123456',
        guests[0].id,
        rooms[2].id,
        '2026-09-11',
        '2026-09-12',
        2,
        1680,
        'Paid',
        'Reserved',
      ),
      this.booking(
        'SL123457',
        guests[1].id,
        rooms[1].id,
        '2026-09-11',
        '2026-09-13',
        2,
        2240,
        'Partial',
        'Checked In',
      ),
      this.booking(
        'SL123458',
        guests[2].id,
        rooms[4].id,
        '2026-09-10',
        '2026-09-12',
        3,
        5600,
        'Paid',
        'Checked In',
      ),
    ];
    return {
      rooms,
      guests,
      bookings,
      payments: [
        {
          id: 'PAY001',
          bookingId: 'SL123456',
          method: 'UPI',
          amount: 1680,
          status: 'Paid',
          paidAt: '2026-09-11T09:30:00.000Z',
        },
        {
          id: 'PAY002',
          bookingId: 'SL123457',
          method: 'Cash',
          amount: 1000,
          status: 'Partial',
          paidAt: '2026-09-11T09:45:00.000Z',
        },
      ],
      expenses: [
        {
          id: 'EXP001',
          date: '2026-09-11',
          category: 'Laundry',
          description: 'Bedsheet wash',
          amount: 850,
        },
        {
          id: 'EXP002',
          date: '2026-09-11',
          category: 'Maintenance',
          description: 'AC service',
          amount: 1400,
        },
      ],
      housekeeping: [
        {
          id: 'HSK001',
          roomId: rooms[6].id,
          title: 'Fix washroom tap',
          staff: 'Ravi',
          priority: 'High',
          status: 'Pending',
          createdAt: '2026-09-11T08:00:00.000Z',
        },
        {
          id: 'HSK002',
          roomId: rooms[5].id,
          title: 'Change bedsheet',
          staff: 'Team A',
          priority: 'Medium',
          status: 'In Progress',
          createdAt: '2026-09-11T09:00:00.000Z',
        },
      ],
    };
  }

  private room(
    number: string,
    type: string,
    floor: string,
    price: number,
    capacity: number,
    bedType: string,
    status: RoomStatus,
    image: string,
  ): Room {
    return {
      id: `ROOM${number}`,
      number,
      type,
      floor,
      price,
      capacity,
      bedType,
      status,
      image,
      amenities: ['AC', 'Free Wi-Fi', 'TV', 'Room Service', 'Attached Bathroom'],
      description: `${type} room ${number} with comfortable bedding, clean linen, warm lighting, and practical amenities for business and family stays.`,
    };
  }

  private booking(
    id: string,
    guestId: string,
    roomId: string,
    checkIn: string,
    checkOut: string,
    guests: number,
    total: number,
    paymentStatus: PaymentStatus,
    status: BookingStatus,
  ): Booking {
    return {
      id,
      guestId,
      roomId,
      checkIn,
      checkOut,
      guests,
      rooms: 1,
      specialRequests: '',
      subtotal: Math.round(total / 1.12),
      taxes: total - Math.round(total / 1.12),
      discounts: 0,
      additionalCharges: 0,
      total,
      paymentStatus,
      status,
      createdAt: '2026-09-11T09:00:00.000Z',
    };
  }
}
