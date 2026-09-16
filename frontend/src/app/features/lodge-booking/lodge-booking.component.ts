import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  Booking,
  BookingDraft,
  Expense,
  Guest,
  HousekeepingTask,
  LodgeBookingService,
  LodgeState,
  Payment,
  Room,
  RoomStatus,
} from './lodge-booking.service';

type LodgeTab =
  | 'dashboard'
  | 'booking'
  | 'rooms'
  | 'check'
  | 'status'
  | 'guests'
  | 'bookings'
  | 'payments'
  | 'expenses'
  | 'housekeeping'
  | 'reports'
  | 'settings';
type BookingStep = 'search' | 'details' | 'guest' | 'review' | 'payment' | 'confirmed';

interface NavItem {
  key: LodgeTab;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-lodge-booking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="lodge-shell"
      [class.nav-collapsed]="navCollapsed"
      [class.mobile-open]="mobileMenuOpen"
    >
      <div class="mobile-backdrop" *ngIf="mobileMenuOpen" (click)="mobileMenuOpen = false"></div>

      <aside class="lodge-sidebar">
        <div class="brand">
          <div class="brand-mark"><i class="pi pi-building"></i></div>
          <div class="brand-copy" *ngIf="!navCollapsed">
            <strong>Sai Lodge</strong>
            <span>Comfort Stay, Happy Guests</span>
          </div>
          <button
            class="icon-btn collapse"
            type="button"
            (click)="navCollapsed = !navCollapsed"
            title="Collapse navigation"
          >
            <i class="pi pi-angle-left"></i>
          </button>
        </div>

        <nav>
          <button
            *ngFor="let item of navItems"
            type="button"
            class="nav-item"
            [class.active]="currentTab === item.key"
            (click)="setTab(item.key)"
            [title]="navCollapsed ? item.label : ''"
          >
            <i [class]="item.icon"></i>
            <span *ngIf="!navCollapsed">{{ item.label }}</span>
          </button>
        </nav>

        <div class="sidebar-card" *ngIf="!navCollapsed">
          <img
            src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop"
            alt="Lodge exterior"
          />
          <strong>Good Guests<br />Great Memories</strong>
        </div>
      </aside>

      <header class="mobile-top">
        <button class="icon-btn" type="button" (click)="mobileMenuOpen = true" title="Open menu">
          <i class="pi pi-bars"></i>
        </button>
        <strong>{{ currentNav?.label }}</strong>
        <button class="icon-btn" type="button" (click)="exportData()" title="Export data">
          <i class="pi pi-download"></i>
        </button>
      </header>

      <main class="lodge-main">
        <section class="topbar">
          <div class="search">
            <i class="pi pi-search"></i>
            <input
              [(ngModel)]="globalSearch"
              placeholder="Search guest, mobile, booking ID, or room number..."
            />
          </div>
          <div class="top-actions">
            <div class="date-chip">
              <i class="pi pi-calendar"></i><span>{{ todayLabel }}</span>
            </div>
            <button class="icon-btn" type="button" title="Notifications">
              <i class="pi pi-bell"></i><b>3</b>
            </button>
            <div class="profile">
              <span>MR</span>
              <div><strong>Maniraj</strong><small>Receptionist</small></div>
            </div>
          </div>
        </section>

        <ng-container [ngSwitch]="currentTab">
          <section *ngSwitchCase="'dashboard'" class="stack">
            <div class="metric-grid">
              <article *ngFor="let metric of metrics" class="metric-card" [class]="metric.tone">
                <i [class]="metric.icon"></i>
                <div>
                  <strong>{{ metric.value }}</strong
                  ><span>{{ metric.label }}</span>
                </div>
              </article>
            </div>

            <div class="dashboard-grid">
              <article class="panel find-panel">
                <div class="panel-title">
                  <i class="pi pi-calendar-plus"></i>
                  <h2>Find & Book a Room</h2>
                </div>
                <div class="form-grid compact">
                  <label>Check In<input type="date" [(ngModel)]="searchForm.checkIn" /></label>
                  <label>Check Out<input type="date" [(ngModel)]="searchForm.checkOut" /></label>
                  <label
                    >Guests<select [(ngModel)]="searchForm.guests">
                      <option *ngFor="let n of [1, 2, 3, 4, 5, 6]" [ngValue]="n">
                        {{ n }} Guest{{ n > 1 ? 's' : '' }}
                      </option>
                    </select></label
                  >
                  <label
                    >Room Type<select [(ngModel)]="searchForm.type">
                      <option>All</option>
                      <option *ngFor="let type of roomTypes">{{ type }}</option>
                    </select></label
                  >
                  <button class="primary-action" type="button" (click)="openBookingSearch()">
                    <i class="pi pi-search"></i>Search Rooms
                  </button>
                </div>
              </article>

              <article class="hero-card">
                <img
                  src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200&auto=format&fit=crop"
                  alt="Comfortable room"
                />
                <div>
                  <strong>Comfortable Stay<br />Affordable Price</strong
                  ><span>Your home away from home</span>
                </div>
              </article>
            </div>

            <div class="content-grid">
              <article class="panel span-5">
                <div class="panel-title split">
                  <span><i class="pi pi-th-large"></i>Room Status</span
                  ><button type="button" (click)="setTab('status')">View All Rooms</button>
                </div>
                <div class="status-filters">
                  <button
                    type="button"
                    [class.active]="statusFilter === 'All'"
                    (click)="statusFilter = 'All'"
                  >
                    All ({{ state.rooms.length }})
                  </button>
                  <button
                    type="button"
                    *ngFor="let status of statuses"
                    [class]="statusClass(status)"
                    [class.active]="statusFilter === status"
                    (click)="statusFilter = status"
                  >
                    {{ status }} ({{ countRooms(status) }})
                  </button>
                </div>
                <div class="room-grid">
                  <button
                    *ngFor="let room of filteredRooms().slice(0, 8)"
                    type="button"
                    class="room-tile"
                    [class]="statusClass(room.status)"
                    (click)="cycleRoom(room)"
                  >
                    <i class="pi pi-warehouse"></i>
                    <strong>{{ room.number }}</strong>
                    <span>{{ room.type }}</span>
                    <b>{{ room.status }}</b>
                    <small>{{ room.bedType }}</small>
                  </button>
                </div>
              </article>

              <article class="panel span-4">
                <div class="panel-title split">
                  <span><i class="pi pi-sign-in"></i>Quick Check In</span>
                  <label class="toggle"
                    ><input type="checkbox" [(ngModel)]="quickCheckIn.walkIn" />Walk-in</label
                  >
                </div>
                <div class="form-grid two">
                  <label
                    >Guest Name<input [(ngModel)]="quickCheckIn.name" placeholder="Enter full name"
                  /></label>
                  <label
                    >Mobile Number<input
                      [(ngModel)]="quickCheckIn.mobile"
                      placeholder="Enter mobile number"
                  /></label>
                  <label
                    >ID Proof Type<select [(ngModel)]="quickCheckIn.idProofType">
                      <option>Aadhaar Card</option>
                      <option>Driving License</option>
                      <option>Passport</option>
                    </select></label
                  >
                  <label
                    >ID Proof Number<input
                      [(ngModel)]="quickCheckIn.idProofNumber"
                      placeholder="Enter ID number"
                  /></label>
                  <label
                    >Room Type<select [(ngModel)]="quickCheckIn.roomType">
                      <option *ngFor="let type of roomTypes">{{ type }}</option>
                    </select></label
                  >
                  <label
                    >Room<select [(ngModel)]="quickCheckIn.roomId">
                      <option value="">Select Room</option>
                      <option
                        *ngFor="let room of availableRoomsForQuickCheckIn()"
                        [value]="room.id"
                      >
                        {{ room.number }} - {{ room.type }}
                      </option>
                    </select></label
                  >
                  <label>Check In<input type="date" [(ngModel)]="quickCheckIn.checkIn" /></label>
                  <label>Check Out<input type="date" [(ngModel)]="quickCheckIn.checkOut" /></label>
                  <label
                    >Advance (Rs)<input type="number" [(ngModel)]="quickCheckIn.advance"
                  /></label>
                </div>
                <button class="success-action full" type="button" (click)="submitQuickCheckIn()">
                  <i class="pi pi-user-plus"></i>Check In & Book
                </button>
                <p class="message" *ngIf="message">{{ message }}</p>
              </article>

              <article class="panel span-3">
                <div class="panel-title split">
                  <span><i class="pi pi-history"></i>Recent Bookings</span
                  ><button type="button" (click)="setTab('bookings')">View All</button>
                </div>
                <div class="mini-list">
                  <div *ngFor="let booking of recentBookings()" class="mini-row">
                    <i class="pi pi-id-card"></i>
                    <div>
                      <strong>{{ guestName(booking.guestId) }}</strong
                      ><span>Room {{ roomNumber(booking.roomId) }} · {{ booking.checkIn }}</span>
                    </div>
                    <b [class]="booking.status === 'Checked Out' ? 'badge-green' : 'badge-blue'">{{
                      booking.status
                    }}</b>
                  </div>
                </div>
              </article>
            </div>

            <div class="content-grid lower">
              <article class="panel span-4">
                <div class="panel-title">
                  <i class="pi pi-chart-bar"></i>
                  <h2>Today's Summary</h2>
                </div>
                <div class="summary-strip">
                  <div>
                    <i class="pi pi-users"></i><strong>{{ todayCheckIns }}</strong
                    ><span>New Check Ins</span>
                  </div>
                  <div>
                    <i class="pi pi-sign-out"></i><strong>{{ todayCheckOuts }}</strong
                    ><span>Check Outs</span>
                  </div>
                  <div>
                    <i class="pi pi-wallet"></i><strong>Rs {{ todayRevenue }}</strong
                    ><span>Revenue</span>
                  </div>
                  <div>
                    <i class="pi pi-calendar-clock"></i><strong>{{ upcomingBookings }}</strong
                    ><span>Upcoming</span>
                  </div>
                </div>
              </article>
              <article class="panel span-4">
                <div class="panel-title split">
                  <span><i class="pi pi-briefcase"></i>Housekeeping Tasks</span
                  ><button type="button" (click)="setTab('housekeeping')">View All</button>
                </div>
                <div class="task-row" *ngFor="let task of state.housekeeping.slice(0, 3)">
                  <span>Room {{ roomNumber(task.roomId) }} - {{ task.title }}</span>
                  <b [class]="taskClass(task.status)">{{ task.status }}</b>
                </div>
              </article>
              <article class="panel span-4">
                <div class="panel-title">
                  <i class="pi pi-bolt"></i>
                  <h2>Quick Actions</h2>
                </div>
                <div class="action-grid">
                  <button type="button" (click)="setTab('booking')">
                    <i class="pi pi-calendar-plus"></i>New Booking
                  </button>
                  <button type="button" (click)="setTab('check')">
                    <i class="pi pi-user-plus"></i>Walk-in Guest
                  </button>
                  <button type="button" (click)="setTab('reports')">
                    <i class="pi pi-chart-line"></i>Reports
                  </button>
                  <button type="button" (click)="setTab('expenses')">
                    <i class="pi pi-credit-card"></i>Expenses
                  </button>
                  <button type="button" (click)="setTab('rooms')">
                    <i class="pi pi-building"></i>Manage Rooms
                  </button>
                  <button type="button" (click)="setTab('settings')">
                    <i class="pi pi-cog"></i>Settings
                  </button>
                </div>
              </article>
            </div>
          </section>

          <section *ngSwitchCase="'booking'" class="booking-layout">
            <ng-container [ngSwitch]="bookingStep">
              <article *ngSwitchCase="'search'" class="panel booking-list">
                <div class="panel-title split">
                  <span><i class="pi pi-search"></i>Available Rooms</span
                  ><button type="button" (click)="openBookingSearch()">Modify Search</button>
                </div>
                <div class="booking-search">
                  <label>Check In<input type="date" [(ngModel)]="searchForm.checkIn" /></label>
                  <label>Check Out<input type="date" [(ngModel)]="searchForm.checkOut" /></label>
                  <label
                    >Guests<select [(ngModel)]="searchForm.guests">
                      <option *ngFor="let n of [1, 2, 3, 4, 5, 6]" [ngValue]="n">{{ n }}</option>
                    </select></label
                  >
                  <label
                    >Room Type<select [(ngModel)]="searchForm.type">
                      <option>All</option>
                      <option *ngFor="let type of roomTypes">{{ type }}</option>
                    </select></label
                  >
                </div>
                <div class="room-search-grid">
                  <aside class="filters">
                    <h3>Filter By</h3>
                    <label
                      >Max Price<input
                        type="range"
                        min="800"
                        max="3000"
                        step="100"
                        [(ngModel)]="maxPrice"
                      /><span>Up to Rs {{ maxPrice }}</span></label
                    >
                    <h4>Amenities</h4>
                    <label *ngFor="let amenity of amenities"
                      ><input
                        type="checkbox"
                        [checked]="selectedAmenities.includes(amenity)"
                        (change)="toggleAmenity(amenity)"
                      />
                      {{ amenity }}</label
                    >
                    <button type="button" (click)="selectedAmenities = []; maxPrice = 3000">
                      Reset Filters
                    </button>
                  </aside>
                  <div class="available-list">
                    <div class="list-head">
                      <strong>{{ searchedRooms().length }} Rooms Found</strong
                      ><select [(ngModel)]="sortMode">
                        <option value="low">Price Low to High</option>
                        <option value="high">Price High to Low</option>
                        <option value="capacity">Capacity</option>
                      </select>
                    </div>
                    <article *ngFor="let room of searchedRooms()" class="room-card">
                      <img [src]="room.image" [alt]="room.type" />
                      <div>
                        <strong>{{ room.type }} Room</strong
                        ><span
                          ><i class="pi pi-users"></i>{{ room.capacity }} Guests ·
                          {{ room.bedType }}</span
                        ><small>{{ room.amenities.slice(0, 4).join(' · ') }}</small>
                      </div>
                      <div class="price">
                        <strong>Rs {{ room.price }}</strong
                        ><span>per night</span
                        ><button type="button" (click)="selectRoom(room)">Book Now</button>
                      </div>
                    </article>
                  </div>
                </div>
              </article>

              <article *ngSwitchCase="'details'" class="panel detail-panel">
                <ng-container *ngIf="selectedRoom as room">
                  <button class="plain-link" type="button" (click)="bookingStep = 'search'">
                    <i class="pi pi-angle-left"></i>Back to rooms
                  </button>
                  <img class="detail-image" [src]="room.image" [alt]="room.type" />
                  <div class="thumb-row">
                    <img
                      *ngFor="let galleryRoom of state.rooms.slice(0, 5)"
                      [src]="galleryRoom.image"
                      [alt]="galleryRoom.type"
                    />
                  </div>
                  <div class="detail-head">
                    <div>
                      <h1>{{ room.type }} Room</h1>
                      <span
                        >{{ room.capacity }} Guests · {{ room.bedType }} · Room
                        {{ room.number }}</span
                      >
                    </div>
                    <strong>Rs {{ room.price }} <small>per night</small></strong>
                  </div>
                  <p>{{ room.description }}</p>
                  <div class="amenity-grid">
                    <span *ngFor="let amenity of room.amenities"
                      ><i class="pi pi-check"></i>{{ amenity }}</span
                    >
                  </div>
                  <button class="primary-action full" type="button" (click)="startGuestForm()">
                    Book This Room
                  </button>
                </ng-container>
              </article>

              <article *ngSwitchCase="'guest'" class="panel wizard-panel">
                <div class="stepper"><b>1</b><span></span><em>2</em><span></span><em>3</em></div>
                <div class="panel-title"><h2>Guest Details</h2></div>
                <div class="form-grid two">
                  <label>Full Name<input [(ngModel)]="bookingDraft.guest.name" /></label>
                  <label>Email<input [(ngModel)]="bookingDraft.guest.email" /></label>
                  <label>Mobile Number<input [(ngModel)]="bookingDraft.guest.mobile" /></label>
                  <label
                    >ID Proof Type<select [(ngModel)]="bookingDraft.guest.idProofType">
                      <option>Aadhaar Card</option>
                      <option>Driving License</option>
                      <option>Passport</option>
                      <option>Voter ID</option>
                    </select></label
                  >
                  <label
                    >ID Proof Number<input [(ngModel)]="bookingDraft.guest.idProofNumber"
                  /></label>
                  <label>Address<input [(ngModel)]="bookingDraft.guest.address" /></label>
                  <label>Check In<input type="date" [(ngModel)]="bookingDraft.checkIn" /></label>
                  <label>Check Out<input type="date" [(ngModel)]="bookingDraft.checkOut" /></label>
                  <label
                    >No. of Guests<select [(ngModel)]="bookingDraft.guests">
                      <option *ngFor="let n of [1, 2, 3, 4, 5, 6]" [ngValue]="n">{{ n }}</option>
                    </select></label
                  >
                  <label
                    >No. of Rooms<select [(ngModel)]="bookingDraft.rooms">
                      <option [ngValue]="1">1 Room</option>
                      <option [ngValue]="2">2 Rooms</option>
                    </select></label
                  >
                  <label class="wide"
                    >Special Requests<textarea
                      [(ngModel)]="bookingDraft.specialRequests"
                    ></textarea>
                  </label>
                </div>
                <div class="wizard-actions">
                  <button type="button" (click)="bookingStep = 'details'">Back</button
                  ><button type="button" class="primary-action" (click)="bookingStep = 'review'">
                    Continue to Review
                  </button>
                </div>
              </article>

              <article *ngSwitchCase="'review'" class="panel wizard-panel">
                <div class="stepper"><b>1</b><span></span><b>2</b><span></span><em>3</em></div>
                <div class="panel-title"><h2>Review Your Booking</h2></div>
                <div class="review-card" *ngIf="selectedRoom">
                  <img [src]="selectedRoom.image" [alt]="selectedRoom.type" />
                  <div>
                    <strong>{{ selectedRoom.type }} Room</strong
                    ><span>{{ bookingDraft.guests }} Guests · {{ selectedRoom.bedType }}</span>
                  </div>
                  <b>Rs {{ selectedRoom.price }} / night</b>
                </div>
                <div class="total-box">
                  <div>
                    <span>Room Charges</span><strong>Rs {{ reviewTotals.subtotal }}</strong>
                  </div>
                  <div>
                    <span>Taxes (12%)</span><strong>Rs {{ reviewTotals.taxes }}</strong>
                  </div>
                  <div><span>Discount</span><strong>Rs 0</strong></div>
                  <div><span>Additional Charges</span><strong>Rs 0</strong></div>
                  <div class="grand">
                    <span>Total Amount</span><strong>Rs {{ reviewTotals.total }}</strong>
                  </div>
                </div>
                <div class="wizard-actions">
                  <button type="button" (click)="bookingStep = 'guest'">Back</button
                  ><button type="button" class="primary-action" (click)="bookingStep = 'payment'">
                    Proceed to Payment
                  </button>
                </div>
              </article>

              <article *ngSwitchCase="'payment'" class="panel wizard-panel">
                <div class="stepper"><b>1</b><span></span><b>2</b><span></span><b>3</b></div>
                <div class="panel-title"><h2>Select Payment Method</h2></div>
                <div class="payment-methods">
                  <button
                    *ngFor="let method of paymentMethods"
                    type="button"
                    [class.active]="bookingDraft.paymentMethod === method"
                    (click)="bookingDraft.paymentMethod = method"
                  >
                    <i class="pi pi-wallet"></i>{{ method }}
                  </button>
                </div>
                <label class="pay-input"
                  >Amount Paid<input type="number" [(ngModel)]="bookingDraft.paidAmount"
                /></label>
                <button class="primary-action full" type="button" (click)="confirmBooking()">
                  Pay Rs {{ reviewTotals.total }}
                </button>
                <p class="message" *ngIf="message">{{ message }}</p>
              </article>

              <article *ngSwitchCase="'confirmed'" class="panel confirmation">
                <i class="pi pi-check-circle"></i>
                <h1>Booking Confirmed!</h1>
                <p>Thank you for choosing Sai Lodge.</p>
                <div class="confirm-box" *ngIf="confirmedBooking">
                  <div>
                    <span>Booking ID</span><strong>{{ confirmedBooking.id }}</strong>
                  </div>
                  <div>
                    <span>Guest Name</span
                    ><strong>{{ guestName(confirmedBooking.guestId) }}</strong>
                  </div>
                  <div>
                    <span>Room</span
                    ><strong
                      >{{ roomType(confirmedBooking.roomId) }}
                      {{ roomNumber(confirmedBooking.roomId) }}</strong
                    >
                  </div>
                  <div>
                    <span>Check In</span><strong>{{ confirmedBooking.checkIn }}</strong>
                  </div>
                  <div>
                    <span>Check Out</span><strong>{{ confirmedBooking.checkOut }}</strong>
                  </div>
                  <div>
                    <span>Nights</span><strong>{{ nights(confirmedBooking) }}</strong>
                  </div>
                  <div>
                    <span>Total</span><strong>Rs {{ confirmedBooking.total }}</strong>
                  </div>
                  <div>
                    <span>Payment</span><strong>{{ confirmedBooking.paymentStatus }}</strong>
                  </div>
                </div>
                <div class="wizard-actions">
                  <button type="button" (click)="windowPrint()">
                    <i class="pi pi-print"></i>Print</button
                  ><button type="button" (click)="setTab('bookings')">View Bookings</button
                  ><button class="primary-action" type="button" (click)="setTab('dashboard')">
                    Back to Dashboard
                  </button>
                </div>
              </article>
            </ng-container>
          </section>

          <section *ngSwitchCase="'rooms'" class="table-page">
            <article class="panel">
              <div class="panel-title split">
                <span
                  ><i class="pi pi-building"></i
                  >{{ roomEditor.id ? 'Edit Room' : 'Add New Room' }}</span
                >
                <div class="filter-inline">
                  <button type="button" (click)="resetRoomEditor()">New Room</button>
                  <button class="primary-action" type="button" (click)="saveRoom()">
                    {{ roomEditor.id ? 'Update Room' : 'Add Room' }}
                  </button>
                </div>
              </div>
              <div class="form-grid room-editor">
                <label
                  >Room No. *<input required [(ngModel)]="roomEditor.number" placeholder="101"
                /></label>
                <label
                  >Room Type *<input
                    required
                    [(ngModel)]="roomEditor.type"
                    list="roomTypeOptions"
                    placeholder="Standard"
                /></label>
                <datalist id="roomTypeOptions">
                  <option *ngFor="let type of roomTypes" [value]="type"></option>
                </datalist>
                <label
                  >Floor *<input required [(ngModel)]="roomEditor.floor" placeholder="1"
                /></label>
                <label
                  >Price / Night *<input
                    required
                    type="number"
                    min="1"
                    [(ngModel)]="roomEditor.price"
                /></label>
                <label
                  >Capacity *<input
                    required
                    type="number"
                    min="1"
                    [(ngModel)]="roomEditor.capacity"
                /></label>
                <label
                  >Bed Type *<input
                    required
                    [(ngModel)]="roomEditor.bedType"
                    placeholder="1 Queen Bed"
                /></label>
                <label
                  >Status *<select required [(ngModel)]="roomEditor.status">
                    <option *ngFor="let status of statuses">{{ status }}</option>
                  </select></label
                >
                <label
                  >Image URL *<input
                    required
                    type="url"
                    [(ngModel)]="roomEditor.image"
                    placeholder="https://..."
                /></label>
                <label class="wide"
                  >Room Description *<textarea
                    required
                    [(ngModel)]="roomEditor.description"
                    placeholder="Describe the room, comfort, bathroom, lighting and ideal guests"
                  ></textarea>
                </label>
                <div class="wide amenity-editor">
                  <strong>Amenities *</strong>
                  <label *ngFor="let amenity of amenities"
                    ><input
                      type="checkbox"
                      [checked]="roomEditor.amenities.includes(amenity)"
                      (change)="toggleRoomAmenity(amenity)"
                    />
                    {{ amenity }}</label
                  >
                  <label
                    >Custom Amenity<input
                      [(ngModel)]="customAmenity"
                      placeholder="Breakfast Included"
                  /></label>
                  <button type="button" (click)="addCustomAmenity()">Add Amenity</button>
                </div>
              </div>
              <p class="message" *ngIf="roomFormMessage">{{ roomFormMessage }}</p>
              <div class="card-table">
                <div class="table-row head room-table-row">
                  <span>Room</span><span>Type</span><span>Floor</span><span>Price</span
                  ><span>Capacity</span><span>Status</span><span>Amenities</span
                  ><span>Actions</span>
                </div>
                <div class="table-row room-table-row" *ngFor="let room of searchedAllRooms()">
                  <span>{{ room.number }}</span
                  ><span>{{ room.type }}</span
                  ><span>{{ room.floor }}</span
                  ><span>Rs {{ room.price }}</span
                  ><span>{{ room.capacity }} guests</span
                  ><span
                    ><b [class]="statusClass(room.status)">{{ room.status }}</b></span
                  ><span>{{ room.amenities.join(', ') }}</span
                  ><span
                    ><button type="button" (click)="editRoom(room)">Edit</button
                    ><button type="button" (click)="removeRoom(room)">Delete</button></span
                  >
                </div>
              </div>
            </article>
          </section>

          <section *ngSwitchCase="'check'" class="table-page">
            <article class="panel">
              <div class="panel-title">
                <i class="pi pi-arrow-right-arrow-left"></i>
                <h2>Check-In / Check-Out</h2>
              </div>
              <div class="card-table compact-table">
                <div class="table-row head">
                  <span>Booking</span><span>Guest</span><span>Room</span><span>Dates</span
                  ><span>Status</span><span>Action</span>
                </div>
                <div class="table-row" *ngFor="let booking of filteredBookings()">
                  <span>{{ booking.id }}</span
                  ><span>{{ guestName(booking.guestId) }}</span
                  ><span>{{ roomNumber(booking.roomId) }}</span
                  ><span>{{ booking.checkIn }} to {{ booking.checkOut }}</span
                  ><span>{{ booking.status }}</span
                  ><span
                    ><button
                      type="button"
                      (click)="checkIn(booking)"
                      [disabled]="booking.status !== 'Reserved'"
                    >
                      Check In</button
                    ><button
                      type="button"
                      (click)="checkOut(booking)"
                      [disabled]="booking.status !== 'Checked In'"
                    >
                      Check Out
                    </button></span
                  >
                </div>
              </div>
            </article>
          </section>

          <section *ngSwitchCase="'status'" class="table-page">
            <article class="panel">
              <div class="panel-title split">
                <span><i class="pi pi-sync"></i>Room Status Management</span
                ><small>Available -> Reserved -> Occupied -> Cleaning -> Available</small>
              </div>
              <div class="room-grid large">
                <button
                  *ngFor="let room of searchedAllRooms()"
                  type="button"
                  class="room-tile"
                  [class]="statusClass(room.status)"
                  (click)="cycleRoom(room)"
                >
                  <i class="pi pi-home"></i><strong>{{ room.number }}</strong
                  ><span>{{ room.type }}</span
                  ><b>{{ room.status }}</b
                  ><small>Click to advance status</small>
                </button>
              </div>
            </article>
          </section>

          <section *ngSwitchCase="'guests'" class="table-page">
            <article class="panel">
              <div class="panel-title">
                <i class="pi pi-users"></i>
                <h2>Guests</h2>
              </div>
              <div class="card-table">
                <div class="table-row head">
                  <span>Name</span><span>Mobile</span><span>Email</span><span>ID Proof</span
                  ><span>Address</span>
                </div>
                <div class="table-row" *ngFor="let guest of filteredGuests()">
                  <span>{{ guest.name }}</span
                  ><span>{{ guest.mobile }}</span
                  ><span>{{ guest.email }}</span
                  ><span>{{ guest.idProofType }} · {{ guest.idProofNumber }}</span
                  ><span>{{ guest.address }}</span>
                </div>
              </div>
            </article>
          </section>

          <section *ngSwitchCase="'bookings'" class="table-page">
            <article class="panel">
              <div class="panel-title split">
                <span><i class="pi pi-book"></i>Booking Management</span>
                <div class="filter-inline">
                  <select [(ngModel)]="bookingStatusFilter">
                    <option>All</option>
                    <option>Reserved</option>
                    <option>Checked In</option>
                    <option>Checked Out</option>
                    <option>Cancelled</option></select
                  ><select [(ngModel)]="paymentStatusFilter">
                    <option>All</option>
                    <option>Paid</option>
                    <option>Partial</option>
                    <option>Pending</option>
                    <option>Refunded</option>
                  </select>
                </div>
              </div>
              <div class="card-table booking-table">
                <div class="table-row head">
                  <span>Booking ID</span><span>Guest</span><span>Mobile</span><span>Room</span
                  ><span>Check In</span><span>Check Out</span><span>Amount</span><span>Payment</span
                  ><span>Status</span><span>Actions</span>
                </div>
                <div class="table-row" *ngFor="let booking of filteredBookings()">
                  <span>{{ booking.id }}</span
                  ><span>{{ guestName(booking.guestId) }}</span
                  ><span>{{ guestMobile(booking.guestId) }}</span
                  ><span>{{ roomNumber(booking.roomId) }} · {{ roomType(booking.roomId) }}</span
                  ><span>{{ booking.checkIn }}</span
                  ><span>{{ booking.checkOut }}</span
                  ><span>Rs {{ booking.total }}</span
                  ><span
                    ><b [class]="paymentClass(booking.paymentStatus)">{{
                      booking.paymentStatus
                    }}</b></span
                  ><span>{{ booking.status }}</span
                  ><span
                    ><button type="button" (click)="checkIn(booking)">In</button
                    ><button type="button" (click)="checkOut(booking)">Out</button></span
                  >
                </div>
              </div>
            </article>
          </section>

          <section *ngSwitchCase="'payments'" class="table-page">
            <article class="panel">
              <div class="panel-title">
                <i class="pi pi-wallet"></i>
                <h2>Payments</h2>
              </div>
              <div class="form-grid compact">
                <label
                  >Booking<select [(ngModel)]="paymentForm.bookingId">
                    <option *ngFor="let booking of state.bookings" [value]="booking.id">
                      {{ booking.id }} - {{ guestName(booking.guestId) }}
                    </option>
                  </select></label
                ><label
                  >Method<select [(ngModel)]="paymentForm.method">
                    <option *ngFor="let method of paymentMethods">{{ method }}</option>
                  </select></label
                ><label>Amount<input type="number" [(ngModel)]="paymentForm.amount" /></label
                ><button class="primary-action" type="button" (click)="recordPayment()">
                  Record Payment
                </button>
              </div>
              <div class="card-table">
                <div class="table-row head">
                  <span>Payment ID</span><span>Booking</span><span>Method</span><span>Amount</span
                  ><span>Status</span><span>Date</span>
                </div>
                <div class="table-row" *ngFor="let payment of state.payments">
                  <span>{{ payment.id }}</span
                  ><span>{{ payment.bookingId }}</span
                  ><span>{{ payment.method }}</span
                  ><span>Rs {{ payment.amount }}</span
                  ><span>{{ payment.status }}</span
                  ><span>{{ payment.paidAt | date: 'short' }}</span>
                </div>
              </div>
            </article>
          </section>

          <section *ngSwitchCase="'expenses'" class="table-page">
            <article class="panel">
              <div class="panel-title split">
                <span><i class="pi pi-credit-card"></i>Expenses</span
                ><button class="primary-action" type="button" (click)="addExpense()">
                  Add Expense
                </button>
              </div>
              <div class="form-grid compact">
                <label>Date<input type="date" [(ngModel)]="expenseForm.date" /></label
                ><label>Category<input [(ngModel)]="expenseForm.category" /></label
                ><label>Description<input [(ngModel)]="expenseForm.description" /></label
                ><label>Amount<input type="number" [(ngModel)]="expenseForm.amount" /></label>
              </div>
              <div class="card-table">
                <div class="table-row head">
                  <span>Date</span><span>Category</span><span>Description</span><span>Amount</span>
                </div>
                <div class="table-row" *ngFor="let expense of state.expenses">
                  <span>{{ expense.date }}</span
                  ><span>{{ expense.category }}</span
                  ><span>{{ expense.description }}</span
                  ><span>Rs {{ expense.amount }}</span>
                </div>
              </div>
            </article>
          </section>

          <section *ngSwitchCase="'housekeeping'" class="table-page">
            <article class="panel">
              <div class="panel-title">
                <i class="pi pi-briefcase"></i>
                <h2>Housekeeping</h2>
              </div>
              <div class="card-table">
                <div class="table-row head">
                  <span>Room</span><span>Task</span><span>Staff</span><span>Priority</span
                  ><span>Status</span><span>Action</span>
                </div>
                <div class="table-row" *ngFor="let task of state.housekeeping">
                  <span>{{ roomNumber(task.roomId) }}</span
                  ><span>{{ task.title }}</span
                  ><span>{{ task.staff }}</span
                  ><span>{{ task.priority }}</span
                  ><span
                    ><b [class]="taskClass(task.status)">{{ task.status }}</b></span
                  ><span
                    ><button type="button" (click)="updateTask(task, 'In Progress')">Start</button
                    ><button type="button" (click)="updateTask(task, 'Completed')">
                      Complete
                    </button></span
                  >
                </div>
              </div>
            </article>
          </section>

          <section *ngSwitchCase="'reports'" class="stack">
            <div class="metric-grid report-metrics">
              <article *ngFor="let report of reportCards" class="metric-card">
                <i [class]="report.icon"></i>
                <div>
                  <strong>{{ report.value }}</strong
                  ><span>{{ report.label }}</span>
                </div>
              </article>
            </div>
            <div class="content-grid">
              <article class="panel span-6">
                <div class="panel-title">
                  <i class="pi pi-chart-line"></i>
                  <h2>Monthly Revenue</h2>
                </div>
                <div class="bar-chart">
                  <div *ngFor="let bar of revenueBars" [style.height.%]="bar.height">
                    <span>{{ bar.label }}</span
                    ><b>Rs {{ bar.value }}</b>
                  </div>
                </div>
              </article>
              <article class="panel span-6">
                <div class="panel-title">
                  <i class="pi pi-chart-pie"></i>
                  <h2>Available vs Occupied</h2>
                </div>
                <div class="donut-wrap">
                  <div class="donut" [style.background]="occupancyGradient"></div>
                  <div>
                    <strong>{{ occupancyRate }}%</strong><span>Occupancy Rate</span>
                    <p>
                      Daily revenue, bookings, payments, expenses and profit are calculated from
                      current lodge data.
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section *ngSwitchCase="'settings'" class="table-page">
            <article class="panel">
              <div class="panel-title">
                <i class="pi pi-database"></i>
                <h2>Data Management</h2>
              </div>
              <div class="settings-grid">
                <button class="primary-action" type="button" (click)="exportData()">
                  <i class="pi pi-file-export"></i>Excel Export
                </button>
                <label class="upload-box"
                  ><i class="pi pi-file-import"></i><span>Excel Import</span
                  ><input type="file" accept=".xlsx,.xls" (change)="importData($event)"
                /></label>
                <button type="button" (click)="resetDemoData()">
                  <i class="pi pi-refresh"></i>Reset Demo Data
                </button>
              </div>
              <p class="message" *ngIf="message">{{ message }}</p>
              <p class="muted">
                Supported sheets: rooms, guests, bookings, payments, expenses, housekeeping.
                Imported rows are validated for known sheet names before replacing lodge data.
              </p>
            </article>
          </section>
        </ng-container>

        <footer>Sai Lodge · Simple Stay · Better Tomorrow</footer>
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100vh;
        color: #0f1f3d;
      }
      button,
      input,
      select,
      textarea {
        font: inherit;
      }
      button {
        cursor: pointer;
      }
      .lodge-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 280px 1fr;
        background: #f4f8ff;
        overflow: hidden;
      }
      .lodge-sidebar {
        background: linear-gradient(180deg, #122643, #0d203a);
        color: #e8f1ff;
        padding: 18px 12px;
        display: flex;
        flex-direction: column;
        gap: 18px;
        overflow: hidden;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 56px;
      }
      .brand-mark {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #f59e0b, #60a5fa);
        color: white;
        font-size: 1.35rem;
      }
      .brand-copy {
        display: grid;
        line-height: 1.1;
        flex: 1;
      }
      .brand-copy strong {
        font-size: 1.35rem;
      }
      .brand-copy span,
      .profile small,
      footer,
      .muted {
        color: #6d7e99;
        font-size: 0.82rem;
      }
      .collapse {
        margin-left: auto;
        background: rgba(255, 255, 255, 0.08);
        color: #e8f1ff;
      }
      .nav-collapsed {
        grid-template-columns: 78px 1fr;
      }
      .nav-collapsed .lodge-sidebar {
        align-items: center;
      }
      .nav-collapsed .collapse i {
        transform: rotate(180deg);
      }
      nav {
        display: flex;
        flex-direction: column;
        gap: 6px;
        overflow-y: auto;
      }
      .nav-item {
        min-height: 48px;
        border: 0;
        border-radius: 9px;
        background: transparent;
        color: #dbeafe;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 0 16px;
        text-align: left;
      }
      .nav-item i {
        width: 20px;
        text-align: center;
      }
      .nav-item.active,
      .nav-item:hover {
        background: linear-gradient(135deg, #2378e8, #0f67d8);
        color: white;
      }
      .sidebar-card {
        margin-top: auto;
        border-radius: 8px;
        overflow: hidden;
        min-height: 280px;
        position: relative;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.24);
      }
      .sidebar-card img,
      .hero-card img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .sidebar-card strong,
      .hero-card div {
        position: absolute;
        inset: auto 0 0;
        padding: 22px;
        color: white;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
        font-size: 1.05rem;
        text-align: center;
      }
      .lodge-main {
        height: 100vh;
        overflow-y: auto;
        padding: 16px 18px;
      }
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .search {
        flex: 1;
        max-width: 760px;
        height: 52px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 18px;
        border: 1px solid #d9e4f4;
        border-radius: 8px;
        background: #eef5ff;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }
      .search input {
        border: 0;
        outline: 0;
        background: transparent;
        width: 100%;
        color: #253858;
      }
      .top-actions,
      .profile,
      .panel-title,
      .panel-title span,
      .wizard-actions,
      .date-chip {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .date-chip {
        color: #23415f;
        font-weight: 600;
      }
      .profile span {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: #d9eaff;
        color: #0f67d8;
        font-weight: 800;
      }
      .profile div {
        display: grid;
        line-height: 1.2;
      }
      .icon-btn {
        border: 0;
        width: 42px;
        height: 42px;
        border-radius: 8px;
        background: #eef5ff;
        color: #10213c;
        position: relative;
      }
      .icon-btn b {
        position: absolute;
        top: -5px;
        right: -3px;
        background: #ef4444;
        color: white;
        border-radius: 99px;
        font-size: 0.68rem;
        padding: 1px 6px;
      }
      .stack {
        display: grid;
        gap: 16px;
      }
      .metric-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(130px, 1fr));
        gap: 16px;
      }
      .metric-card,
      .panel {
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid #dbe6f6;
        border-radius: 8px;
        box-shadow: 0 14px 38px rgba(41, 72, 112, 0.08);
      }
      .metric-card {
        min-height: 96px;
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 18px;
      }
      .metric-card i {
        width: 52px;
        height: 52px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        font-size: 1.45rem;
        background: #dceeff;
        color: #0f67d8;
      }
      .metric-card strong {
        display: block;
        font-size: 1.45rem;
      }
      .metric-card span {
        color: #526883;
        font-size: 0.88rem;
      }
      .tone-green i {
        background: #ccf7dd;
        color: #128044;
      }
      .tone-amber i {
        background: #fff0c9;
        color: #d97706;
      }
      .tone-red i {
        background: #ffd6db;
        color: #dc2626;
      }
      .tone-purple i {
        background: #eadcff;
        color: #6d28d9;
      }
      .dashboard-grid,
      .content-grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 16px;
      }
      .find-panel {
        grid-column: span 8;
      }
      .hero-card {
        grid-column: span 4;
        min-height: 178px;
        border-radius: 8px;
        overflow: hidden;
        position: relative;
      }
      .panel {
        padding: 18px;
        min-width: 0;
      }
      .panel-title {
        margin-bottom: 16px;
        color: #0f1f3d;
      }
      .panel-title h2 {
        font-size: 1.08rem;
      }
      .split {
        justify-content: space-between;
      }
      .split button,
      .plain-link,
      .panel-title button {
        border: 0;
        background: transparent;
        color: #0f67d8;
        font-weight: 700;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(120px, 1fr));
        gap: 14px;
      }
      .form-grid.two {
        grid-template-columns: repeat(2, 1fr);
      }
      .form-grid.compact {
        align-items: end;
      }
      label {
        color: #203553;
        font-size: 0.84rem;
        font-weight: 700;
        display: grid;
        gap: 6px;
      }
      input,
      select,
      textarea {
        border: 1px solid #ccdaec;
        border-radius: 7px;
        padding: 10px 12px;
        outline: 0;
        background: #fff;
        color: #12233f;
        min-height: 42px;
      }
      textarea {
        min-height: 90px;
        resize: vertical;
      }
      input:focus,
      select:focus,
      textarea:focus {
        border-color: #0f67d8;
        box-shadow: 0 0 0 3px rgba(15, 103, 216, 0.12);
      }
      .primary-action,
      .success-action {
        border: 0;
        min-height: 46px;
        padding: 0 18px;
        border-radius: 7px;
        color: white;
        font-weight: 800;
        background: linear-gradient(135deg, #0f73df, #0d62c8);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .success-action {
        background: linear-gradient(135deg, #18a45b, #118347);
      }
      .full {
        width: 100%;
        margin-top: 14px;
      }
      .span-3 {
        grid-column: span 3;
      }
      .span-4 {
        grid-column: span 4;
      }
      .span-5 {
        grid-column: span 5;
      }
      .span-6 {
        grid-column: span 6;
      }
      .status-filters {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }
      .status-filters button {
        border: 0;
        border-radius: 10px;
        padding: 8px 15px;
        font-weight: 800;
        color: #233a58;
        background: #edf4ff;
      }
      .status-filters button.active {
        background: #0f2545;
        color: white;
      }
      .room-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(120px, 1fr));
        gap: 12px;
      }
      .room-grid.large {
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      }
      .room-tile {
        min-height: 132px;
        border: 1px solid #cae1fb;
        border-radius: 8px;
        background: #e7f4ff;
        color: #173653;
        padding: 14px;
        display: grid;
        justify-items: start;
        gap: 4px;
        text-align: left;
      }
      .room-tile i {
        color: #1376df;
        font-size: 1.35rem;
      }
      .room-tile strong {
        font-size: 1.05rem;
      }
      .room-tile b {
        border-radius: 7px;
        padding: 4px 10px;
        background: rgba(255, 255, 255, 0.55);
        font-size: 0.78rem;
      }
      .status-available {
        background: #dcfce7 !important;
        color: #087a3d !important;
        border-color: #bbf7d0 !important;
      }
      .status-reserved {
        background: #ffedd5 !important;
        color: #c2410c !important;
        border-color: #fed7aa !important;
      }
      .status-occupied {
        background: #dbeafe !important;
        color: #0753b6 !important;
        border-color: #bfdbfe !important;
      }
      .status-cleaning {
        background: #ede9fe !important;
        color: #6d28d9 !important;
        border-color: #ddd6fe !important;
      }
      .status-maintenance {
        background: #fee2e2 !important;
        color: #dc2626 !important;
        border-color: #fecaca !important;
      }
      .mini-list,
      .card-table {
        display: grid;
        gap: 10px;
      }
      .mini-row,
      .task-row,
      .table-row {
        display: grid;
        align-items: center;
        gap: 10px;
        padding: 10px;
        border-bottom: 1px solid #edf2f7;
      }
      .mini-row {
        grid-template-columns: 28px 1fr auto;
      }
      .mini-row div {
        display: grid;
        line-height: 1.25;
      }
      .mini-row span,
      .room-card small,
      .room-card span {
        color: #5c708b;
        font-size: 0.8rem;
      }
      .badge-blue,
      .badge-green,
      .badge-amber,
      .badge-red,
      .task-pending,
      .task-progress,
      .task-done {
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 0.75rem;
      }
      .badge-blue {
        background: #dbeafe;
        color: #0753b6;
      }
      .badge-green,
      .task-done {
        background: #d1fae5;
        color: #047857;
      }
      .badge-amber,
      .task-progress {
        background: #fef3c7;
        color: #b45309;
      }
      .badge-red,
      .task-pending {
        background: #fee2e2;
        color: #dc2626;
      }
      .summary-strip,
      .action-grid,
      .payment-methods,
      .settings-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
      }
      .summary-strip div,
      .action-grid button,
      .payment-methods button,
      .settings-grid button,
      .upload-box {
        border: 1px solid #d7e5f6;
        border-radius: 8px;
        background: #edf6ff;
        padding: 14px;
        display: grid;
        place-items: center;
        gap: 6px;
        text-align: center;
        color: #0f67d8;
        font-weight: 800;
      }
      .booking-layout,
      .table-page {
        display: grid;
        gap: 16px;
      }
      .booking-search {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }
      .room-search-grid {
        display: grid;
        grid-template-columns: 240px 1fr;
        gap: 16px;
      }
      .filters {
        border-right: 1px solid #e5edf8;
        padding-right: 16px;
        display: grid;
        gap: 12px;
        align-content: start;
      }
      .filters button {
        min-height: 38px;
        border: 1px solid #cbd9eb;
        background: white;
        border-radius: 7px;
      }
      .available-list {
        display: grid;
        gap: 12px;
      }
      .list-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .room-card {
        display: grid;
        grid-template-columns: 132px 1fr auto;
        gap: 14px;
        padding: 12px;
        border: 1px solid #dce8f7;
        border-radius: 8px;
        background: white;
      }
      .room-card img,
      .review-card img {
        width: 132px;
        height: 96px;
        border-radius: 7px;
        object-fit: cover;
      }
      .room-card div {
        display: grid;
        align-content: center;
        gap: 5px;
      }
      .price {
        text-align: right;
      }
      .price strong {
        color: #0f67d8;
        font-size: 1.1rem;
      }
      .price button {
        border: 0;
        background: #0f67d8;
        color: white;
        border-radius: 7px;
        padding: 8px 12px;
      }
      .detail-panel,
      .wizard-panel,
      .confirmation {
        max-width: 860px;
        margin: 0 auto;
      }
      .detail-image {
        width: 100%;
        height: 360px;
        object-fit: cover;
        border-radius: 8px;
      }
      .thumb-row {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        margin: 10px 0;
      }
      .thumb-row img {
        height: 74px;
        object-fit: cover;
        border-radius: 7px;
      }
      .detail-head,
      .review-card,
      .total-box div,
      .confirm-box div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      .detail-head h1 {
        font-size: 1.5rem;
      }
      .amenity-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin: 16px 0;
      }
      .amenity-grid span {
        display: flex;
        gap: 8px;
        align-items: center;
        color: #203553;
      }
      .wide {
        grid-column: 1 / -1;
      }
      .wizard-actions {
        justify-content: flex-end;
        margin-top: 16px;
      }
      .wizard-actions button {
        border: 1px solid #b9cce5;
        background: white;
        border-radius: 7px;
        padding: 10px 18px;
        font-weight: 800;
      }
      .review-card {
        border: 1px solid #dce8f7;
        border-radius: 8px;
        padding: 12px;
      }
      .total-box {
        display: grid;
        gap: 10px;
        margin: 16px 0;
      }
      .total-box .grand {
        border-top: 1px solid #dce8f7;
        padding-top: 12px;
        font-size: 1.1rem;
      }
      .payment-methods button.active {
        border-color: #0f67d8;
        background: #dbeafe;
      }
      .stepper {
        display: grid;
        grid-template-columns: 34px 1fr 34px 1fr 34px;
        align-items: center;
        gap: 8px;
        margin-bottom: 18px;
      }
      .stepper b,
      .stepper em {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        font-style: normal;
        font-weight: 800;
      }
      .stepper b {
        background: #0f67d8;
        color: white;
      }
      .stepper em {
        background: #eef5ff;
        color: #5c708b;
        border: 1px solid #cbd9eb;
      }
      .stepper span {
        height: 2px;
        background: #d7e5f6;
      }
      .pay-input {
        margin-top: 16px;
      }
      .confirmation {
        text-align: center;
      }
      .confirmation > i {
        font-size: 3.5rem;
        color: #16a34a;
      }
      .confirm-box {
        display: grid;
        gap: 0;
        border: 1px solid #dce8f7;
        border-radius: 8px;
        margin: 18px auto;
        max-width: 520px;
        overflow: hidden;
        text-align: left;
      }
      .confirm-box div {
        padding: 10px 14px;
        border-bottom: 1px solid #edf2f7;
      }
      .table-row {
        grid-template-columns: repeat(6, 1fr);
        background: white;
        border-radius: 8px;
        border: 1px solid #e1ebf8;
        border-bottom: 1px solid #e1ebf8;
      }
      .table-row.head {
        background: #edf4ff;
        font-weight: 800;
        color: #203553;
      }
      .room-editor {
        grid-template-columns: repeat(4, minmax(150px, 1fr));
        margin-bottom: 12px;
      }
      .amenity-editor {
        border: 1px solid #dce8f7;
        border-radius: 8px;
        padding: 12px;
        display: grid;
        grid-template-columns: repeat(4, minmax(140px, 1fr));
        gap: 10px;
        background: #f8fbff;
      }
      .amenity-editor strong {
        grid-column: 1 / -1;
        color: #203553;
      }
      .amenity-editor label {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .amenity-editor label:last-of-type {
        display: grid;
        grid-column: span 2;
      }
      .amenity-editor input[type='checkbox'] {
        min-height: auto;
        width: auto;
      }
      .amenity-editor button {
        border: 1px solid #bad0eb;
        background: white;
        border-radius: 7px;
        min-height: 42px;
        align-self: end;
        font-weight: 800;
        color: #0f67d8;
      }
      .room-table-row {
        grid-template-columns: 0.7fr 1fr 0.6fr 0.8fr 0.8fr 0.9fr 1.8fr 1fr;
      }
      .booking-table .table-row {
        grid-template-columns: 1fr 1.2fr 1fr 1.3fr 1fr 1fr 0.8fr 0.8fr 0.9fr 1fr;
      }
      .compact-table .table-row {
        grid-template-columns: 1fr 1.2fr 0.8fr 1.7fr 1fr 1fr;
      }
      .table-row button {
        border: 1px solid #bad0eb;
        background: #fff;
        border-radius: 6px;
        padding: 6px 8px;
        margin-right: 4px;
      }
      .filter-inline {
        display: flex;
        gap: 8px;
      }
      .bar-chart {
        height: 260px;
        display: flex;
        align-items: end;
        gap: 16px;
        padding-top: 20px;
      }
      .bar-chart div {
        flex: 1;
        min-height: 20px;
        border-radius: 8px 8px 0 0;
        background: linear-gradient(180deg, #0f73df, #7c3aed);
        color: white;
        display: flex;
        align-items: end;
        justify-content: center;
        position: relative;
        padding-bottom: 8px;
      }
      .bar-chart b {
        position: absolute;
        top: -24px;
        color: #203553;
        font-size: 0.78rem;
      }
      .donut-wrap {
        display: flex;
        align-items: center;
        gap: 28px;
        min-height: 260px;
      }
      .donut {
        width: 180px;
        height: 180px;
        border-radius: 50%;
        position: relative;
      }
      .donut:after {
        content: '';
        position: absolute;
        inset: 38px;
        border-radius: 50%;
        background: white;
      }
      .settings-grid {
        grid-template-columns: repeat(3, 1fr);
        margin-bottom: 14px;
      }
      .upload-box input {
        display: none;
      }
      .message {
        margin-top: 12px;
        color: #0f67d8;
        font-weight: 800;
      }
      footer {
        padding: 20px 6px 4px;
        text-align: right;
      }
      .mobile-top {
        display: none;
      }

      @media (max-width: 1180px) {
        .metric-grid {
          grid-template-columns: repeat(3, 1fr);
        }
        .find-panel,
        .hero-card,
        .span-3,
        .span-4,
        .span-5,
        .span-6 {
          grid-column: 1 / -1;
        }
        .room-grid {
          grid-template-columns: repeat(3, 1fr);
        }
        .form-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 780px) {
        .lodge-shell,
        .nav-collapsed {
          grid-template-columns: 1fr;
        }
        .lodge-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: 280px;
          transform: translateX(-100%);
          transition: transform 0.25s ease;
          z-index: 20;
        }
        .mobile-open .lodge-sidebar {
          transform: translateX(0);
        }
        .mobile-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(6, 18, 36, 0.5);
          z-index: 19;
        }
        .mobile-top {
          display: flex;
          height: 58px;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          background: white;
          border-bottom: 1px solid #dce8f7;
          position: sticky;
          top: 0;
          z-index: 15;
        }
        .lodge-main {
          height: 100vh;
          padding: 0 12px 12px;
        }
        .topbar {
          margin-top: 12px;
          flex-direction: column;
          align-items: stretch;
        }
        .top-actions {
          justify-content: space-between;
        }
        .metric-grid,
        .summary-strip,
        .action-grid,
        .payment-methods,
        .settings-grid,
        .booking-search,
        .room-search-grid,
        .form-grid.two,
        .form-grid,
        .amenity-grid {
          grid-template-columns: 1fr;
        }
        .filters {
          border-right: 0;
          border-bottom: 1px solid #e5edf8;
          padding: 0 0 14px;
        }
        .room-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        .room-card,
        .review-card {
          grid-template-columns: 1fr;
        }
        .room-card img,
        .review-card img {
          width: 100%;
          height: 170px;
        }
        .price {
          text-align: left;
        }
        .detail-image {
          height: 230px;
        }
        .thumb-row {
          grid-template-columns: repeat(3, 1fr);
        }
        .card-table {
          overflow-x: auto;
        }
        .table-row,
        .booking-table .table-row,
        .compact-table .table-row {
          min-width: 850px;
        }
        footer {
          text-align: center;
        }
      }
      @media (max-width: 460px) {
        .room-grid {
          grid-template-columns: 1fr;
        }
        .profile {
          display: none;
        }
        .panel {
          padding: 14px;
        }
      }
    `,
  ],
})
export class LodgeBookingComponent implements OnInit, OnDestroy {
  private readonly lodge = inject(LodgeBookingService);
  private sub?: Subscription;

  state: LodgeState = this.lodge.snapshot;
  currentTab: LodgeTab = 'dashboard';
  bookingStep: BookingStep = 'search';
  navCollapsed = false;
  mobileMenuOpen = false;
  globalSearch = '';
  statusFilter: RoomStatus | 'All' = 'All';
  bookingStatusFilter = 'All';
  paymentStatusFilter = 'All';
  message = '';
  selectedRoom?: Room;
  confirmedBooking?: Booking;
  maxPrice = 3000;
  sortMode = 'low';
  selectedAmenities: string[] = [];

  readonly navItems: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'pi pi-home' },
    { key: 'booking', label: 'Room Booking', icon: 'pi pi-calendar-plus' },
    { key: 'rooms', label: 'Manage Rooms', icon: 'pi pi-building' },
    { key: 'check', label: 'Check In / Check Out', icon: 'pi pi-arrow-right-arrow-left' },
    { key: 'status', label: 'Room Status', icon: 'pi pi-th-large' },
    { key: 'guests', label: 'Guests', icon: 'pi pi-users' },
    { key: 'bookings', label: 'Bookings', icon: 'pi pi-book' },
    { key: 'payments', label: 'Payments', icon: 'pi pi-wallet' },
    { key: 'expenses', label: 'Expenses', icon: 'pi pi-credit-card' },
    { key: 'housekeeping', label: 'Housekeeping', icon: 'pi pi-briefcase' },
    { key: 'reports', label: 'Reports', icon: 'pi pi-chart-line' },
    { key: 'settings', label: 'Settings', icon: 'pi pi-cog' },
  ];
  readonly statuses: RoomStatus[] = [
    'Available',
    'Reserved',
    'Occupied',
    'Cleaning',
    'Maintenance',
  ];
  readonly paymentMethods = ['Cash', 'Credit / Debit Card', 'UPI', 'Net Banking', 'Wallet'];
  readonly amenities = ['AC', 'Free Wi-Fi', 'TV', 'Room Service', 'Attached Bathroom'];

  searchForm = { checkIn: '2026-09-11', checkOut: '2026-09-12', guests: 2, type: 'All' };
  quickCheckIn = {
    walkIn: true,
    name: 'Walk-in Guest',
    mobile: '',
    idProofType: 'Aadhaar Card',
    idProofNumber: '',
    roomType: 'Standard',
    roomId: '',
    checkIn: '2026-09-11',
    checkOut: '2026-09-12',
    advance: 0,
  };
  bookingDraft: BookingDraft = this.emptyDraft();
  roomEditor: Room = this.emptyRoom();
  roomFormMessage = '';
  customAmenity = '';
  paymentForm = { bookingId: '', method: 'Cash', amount: 0 };
  expenseForm: Omit<Expense, 'id'> = {
    date: '2026-09-11',
    category: 'Utilities',
    description: '',
    amount: 0,
  };

  ngOnInit(): void {
    this.sub = this.lodge.state$.subscribe((state) => {
      this.state = state;
      if (this.selectedRoom) {
        this.selectedRoom = state.rooms.find((room) => room.id === this.selectedRoom?.id);
      }
      this.paymentForm.bookingId ||= state.bookings[0]?.id || '';
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get currentNav(): NavItem | undefined {
    return this.navItems.find((item) => item.key === this.currentTab);
  }

  get todayLabel(): string {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
  }

  get roomTypes(): string[] {
    return [...new Set(this.state.rooms.map((room) => room.type))];
  }

  get metrics() {
    return [
      { label: 'Total Rooms', value: this.state.rooms.length, icon: 'pi pi-building', tone: '' },
      {
        label: 'Occupied',
        value: this.countRooms('Occupied'),
        icon: 'pi pi-lock',
        tone: 'tone-green',
      },
      {
        label: 'Available',
        value: this.countRooms('Available'),
        icon: 'pi pi-check-circle',
        tone: 'tone-amber',
      },
      {
        label: 'Under Maintenance',
        value: this.countRooms('Maintenance'),
        icon: 'pi pi-wrench',
        tone: 'tone-red',
      },
      { label: 'Guests Today', value: this.todayGuests, icon: 'pi pi-users', tone: 'tone-purple' },
      {
        label: "Today's Revenue",
        value: `Rs ${this.todayRevenue}`,
        icon: 'pi pi-indian-rupee',
        tone: 'tone-green',
      },
    ];
  }

  get todayRevenue(): number {
    return this.state.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  get todayGuests(): number {
    return this.state.bookings
      .filter(
        (booking) =>
          booking.checkIn <= this.searchForm.checkIn && booking.checkOut >= this.searchForm.checkIn,
      )
      .reduce((sum, booking) => sum + Number(booking.guests || 0), 0);
  }

  get todayCheckIns(): number {
    return this.state.bookings.filter((booking) => booking.checkIn === this.searchForm.checkIn)
      .length;
  }

  get todayCheckOuts(): number {
    return this.state.bookings.filter((booking) => booking.checkOut === this.searchForm.checkIn)
      .length;
  }

  get upcomingBookings(): number {
    return this.state.bookings.filter((booking) => booking.status === 'Reserved').length;
  }

  get reviewTotals() {
    const room = this.selectedRoom;
    const subtotal = room
      ? this.lodge.nightsBetween(this.bookingDraft.checkIn, this.bookingDraft.checkOut) *
        room.price *
        this.bookingDraft.rooms
      : 0;
    const taxes = Math.round(subtotal * 0.12);
    return { subtotal, taxes, total: subtotal + taxes };
  }

  get reportCards() {
    const expense = this.state.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return [
      { label: 'Daily Revenue', value: `Rs ${this.todayRevenue}`, icon: 'pi pi-wallet' },
      { label: 'Monthly Revenue', value: `Rs ${this.todayRevenue * 18}`, icon: 'pi pi-chart-line' },
      { label: 'Occupancy Rate', value: `${this.occupancyRate}%`, icon: 'pi pi-percentage' },
      { label: 'Expenses', value: `Rs ${expense}`, icon: 'pi pi-credit-card' },
      {
        label: 'Profit Summary',
        value: `Rs ${this.todayRevenue - expense}`,
        icon: 'pi pi-briefcase',
      },
      { label: 'Booking Trends', value: this.state.bookings.length, icon: 'pi pi-calendar' },
    ];
  }

  get occupancyRate(): number {
    return Math.round((this.countRooms('Occupied') / Math.max(1, this.state.rooms.length)) * 100);
  }

  get occupancyGradient(): string {
    return `conic-gradient(#0f73df 0 ${this.occupancyRate}%, #dbeafe ${this.occupancyRate}% 100%)`;
  }

  get revenueBars() {
    const values = [12000, 18500, 16200, 21750, this.todayRevenue || 15000, 23800];
    const max = Math.max(...values);
    return values.map((value, index) => ({
      label: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][index],
      value,
      height: Math.round((value / max) * 100),
    }));
  }

  setTab(tab: LodgeTab): void {
    this.currentTab = tab;
    this.mobileMenuOpen = false;
    if (tab === 'booking') this.openBookingSearch();
  }

  openBookingSearch(): void {
    this.currentTab = 'booking';
    this.bookingStep = 'search';
  }

  countRooms(status: RoomStatus): number {
    return this.state.rooms.filter((room) => room.status === status).length;
  }

  filteredRooms(): Room[] {
    return this.statusFilter === 'All'
      ? this.searchedAllRooms()
      : this.searchedAllRooms().filter((room) => room.status === this.statusFilter);
  }

  searchedAllRooms(): Room[] {
    const term = this.globalSearch.trim().toLowerCase();
    if (!term) return this.state.rooms;
    return this.state.rooms.filter((room) =>
      `${room.number} ${room.type} ${room.status}`.toLowerCase().includes(term),
    );
  }

  searchedRooms(): Room[] {
    const amenities = this.selectedAmenities;
    return this.lodge
      .availableRooms(
        this.searchForm.checkIn,
        this.searchForm.checkOut,
        this.searchForm.type,
        this.searchForm.guests,
      )
      .filter((room) => room.price <= this.maxPrice)
      .filter((room) => amenities.every((amenity) => room.amenities.includes(amenity)))
      .sort((a, b) =>
        this.sortMode === 'high'
          ? b.price - a.price
          : this.sortMode === 'capacity'
            ? b.capacity - a.capacity
            : a.price - b.price,
      );
  }

  availableRoomsForQuickCheckIn(): Room[] {
    return this.lodge.availableRooms(
      this.quickCheckIn.checkIn,
      this.quickCheckIn.checkOut,
      this.quickCheckIn.roomType,
      1,
    );
  }

  toggleAmenity(amenity: string): void {
    this.selectedAmenities = this.selectedAmenities.includes(amenity)
      ? this.selectedAmenities.filter((item) => item !== amenity)
      : [...this.selectedAmenities, amenity];
  }

  selectRoom(room: Room): void {
    this.selectedRoom = room;
    this.bookingStep = 'details';
  }

  startGuestForm(): void {
    if (!this.selectedRoom) return;
    this.bookingDraft = {
      ...this.emptyDraft(),
      roomId: this.selectedRoom.id,
      checkIn: this.searchForm.checkIn,
      checkOut: this.searchForm.checkOut,
      guests: this.searchForm.guests,
    };
    this.bookingStep = 'guest';
  }

  confirmBooking(): void {
    this.bookingDraft.paidAmount ||= this.reviewTotals.total;
    const result = this.lodge.createBooking(this.bookingDraft);
    if (!result.ok) {
      this.message = result.message;
      return;
    }
    this.confirmedBooking = result.booking;
    this.bookingStep = 'confirmed';
    this.message = '';
  }

  submitQuickCheckIn(): void {
    if (!this.quickCheckIn.roomId || !this.quickCheckIn.name || !this.quickCheckIn.mobile) {
      this.message = 'Guest name, mobile and room are required.';
      return;
    }
    const result = this.lodge.createBooking({
      roomId: this.quickCheckIn.roomId,
      guest: {
        name: this.quickCheckIn.name,
        email: '',
        mobile: this.quickCheckIn.mobile,
        idProofType: this.quickCheckIn.idProofType,
        idProofNumber: this.quickCheckIn.idProofNumber,
        address: '',
      },
      checkIn: this.quickCheckIn.checkIn,
      checkOut: this.quickCheckIn.checkOut,
      guests: 1,
      rooms: 1,
      specialRequests: 'Walk-in guest',
      paymentMethod: 'Cash',
      paidAmount: Number(this.quickCheckIn.advance || 0),
      checkInNow: true,
    });
    this.message = result.ok ? `Booking ${result.booking.id} checked in.` : result.message;
  }

  cycleRoom(room: Room): void {
    this.lodge.cycleRoomStatus(room.id);
  }

  checkIn(booking: Booking): void {
    if (booking.status !== 'Checked Out') this.lodge.checkIn(booking.id);
  }

  checkOut(booking: Booking): void {
    if (booking.status === 'Checked In') this.lodge.checkOut(booking.id);
  }

  saveRoom(): void {
    const room = {
      ...this.roomEditor,
      number: this.roomEditor.number.trim(),
      type: this.roomEditor.type.trim(),
      floor: this.roomEditor.floor.trim(),
      bedType: this.roomEditor.bedType.trim(),
      image: this.roomEditor.image.trim(),
      description: this.roomEditor.description.trim(),
      price: Number(this.roomEditor.price),
      capacity: Number(this.roomEditor.capacity),
      amenities: [...new Set(this.roomEditor.amenities.map((item) => item.trim()).filter(Boolean))],
    };
    const validationError = this.validateRoom(room);
    if (validationError) {
      this.roomFormMessage = validationError;
      return;
    }

    const result = this.lodge.addOrUpdateRoom(room);
    if (!result.ok) {
      this.roomFormMessage = result.message;
      return;
    }
    this.roomFormMessage = `Room ${room.number} ${room.id ? 'updated' : 'added'} successfully. It is now available across booking, dashboard, status and check-in screens.`;
    this.roomEditor = this.emptyRoom();
  }

  editRoom(room: Room): void {
    this.roomEditor = { ...room, amenities: [...room.amenities] };
    this.roomFormMessage = `Editing room ${room.number}. Updates keep linked bookings and payments connected.`;
  }

  removeRoom(room: Room): void {
    this.message = this.lodge.deleteRoom(room.id).message;
  }

  resetRoomEditor(): void {
    this.roomEditor = this.emptyRoom();
    this.roomFormMessage = '';
    this.customAmenity = '';
  }

  toggleRoomAmenity(amenity: string): void {
    this.roomEditor = {
      ...this.roomEditor,
      amenities: this.roomEditor.amenities.includes(amenity)
        ? this.roomEditor.amenities.filter((item) => item !== amenity)
        : [...this.roomEditor.amenities, amenity],
    };
  }

  addCustomAmenity(): void {
    const amenity = this.customAmenity.trim();
    if (!amenity) return;
    if (!this.roomEditor.amenities.includes(amenity)) {
      this.roomEditor = { ...this.roomEditor, amenities: [...this.roomEditor.amenities, amenity] };
    }
    this.customAmenity = '';
  }

  filteredGuests(): Guest[] {
    const term = this.globalSearch.trim().toLowerCase();
    if (!term) return this.state.guests;
    return this.state.guests.filter((guest) =>
      `${guest.name} ${guest.mobile} ${guest.email}`.toLowerCase().includes(term),
    );
  }

  filteredBookings(): Booking[] {
    const term = this.globalSearch.trim().toLowerCase();
    return this.state.bookings.filter((booking) => {
      const haystack =
        `${booking.id} ${this.guestName(booking.guestId)} ${this.guestMobile(booking.guestId)} ${this.roomNumber(booking.roomId)} ${booking.status} ${booking.paymentStatus}`.toLowerCase();
      return (
        (!term || haystack.includes(term)) &&
        (this.bookingStatusFilter === 'All' || booking.status === this.bookingStatusFilter) &&
        (this.paymentStatusFilter === 'All' || booking.paymentStatus === this.paymentStatusFilter)
      );
    });
  }

  recentBookings(): Booking[] {
    return this.state.bookings.slice(0, 5);
  }

  recordPayment(): void {
    this.lodge.updatePayment(
      this.paymentForm.bookingId,
      this.paymentForm.method,
      Number(this.paymentForm.amount || 0),
    );
  }

  addExpense(): void {
    this.lodge.addExpense({ ...this.expenseForm, amount: Number(this.expenseForm.amount || 0) });
    this.expenseForm = { date: this.searchForm.checkIn, category: '', description: '', amount: 0 };
  }

  updateTask(task: HousekeepingTask, status: 'In Progress' | 'Completed'): void {
    this.lodge.updateHousekeeping(task.id, status);
  }

  exportData(): void {
    this.lodge.exportWorkbook();
  }

  async importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      this.message = await this.lodge.importWorkbook(file);
    } catch (error) {
      this.message = error instanceof Error ? error.message : 'Import failed.';
    } finally {
      input.value = '';
    }
  }

  resetDemoData(): void {
    this.lodge.resetDemoData();
    this.message = 'Demo lodge data restored.';
  }

  guestName(id: string): string {
    return this.lodge.guestById(id)?.name || 'Unknown Guest';
  }

  guestMobile(id: string): string {
    return this.lodge.guestById(id)?.mobile || '-';
  }

  roomNumber(id: string): string {
    return this.lodge.roomById(id)?.number || '-';
  }

  roomType(id: string): string {
    return this.lodge.roomById(id)?.type || '-';
  }

  nights(booking: Booking): number {
    return this.lodge.nightsBetween(booking.checkIn, booking.checkOut);
  }

  statusClass(status: RoomStatus): string {
    return `status-${status.toLowerCase().replace(' ', '-')}`;
  }

  paymentClass(status: string): string {
    return status === 'Paid' ? 'badge-green' : status === 'Partial' ? 'badge-amber' : 'badge-red';
  }

  taskClass(status: string): string {
    return status === 'Completed'
      ? 'task-done'
      : status === 'In Progress'
        ? 'task-progress'
        : 'task-pending';
  }

  windowPrint(): void {
    window.print();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth > 780) this.mobileMenuOpen = false;
  }

  private emptyDraft(): BookingDraft {
    return {
      roomId: '',
      guest: {
        name: 'Maniraj S',
        email: 'maniraj@email.com',
        mobile: '9876543210',
        idProofType: 'Aadhaar Card',
        idProofNumber: '',
        address: 'Chennai',
      },
      checkIn: this.searchForm.checkIn,
      checkOut: this.searchForm.checkOut,
      guests: this.searchForm.guests,
      rooms: 1,
      specialRequests: '',
      paymentMethod: 'UPI',
      paidAmount: 0,
    };
  }

  private emptyRoom(): Room {
    return {
      id: '',
      number: '',
      type: 'Standard',
      floor: '1',
      price: 1000,
      capacity: 2,
      bedType: '1 Queen Bed',
      amenities: [...this.amenities],
      status: 'Available',
      image:
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=1200&auto=format&fit=crop',
      description: 'Comfortable room with clean linen, attached bathroom, TV, AC, and free Wi-Fi.',
    };
  }

  private validateRoom(room: Room): string {
    if (!room.number) return 'Room number is required.';
    if (!room.type) return 'Room type is required.';
    if (!room.floor) return 'Floor is required.';
    if (!room.bedType) return 'Bed type is required.';
    if (!room.image) return 'Room image URL is required.';
    if (!room.description) return 'Room description is required.';
    if (!Number.isFinite(room.price) || room.price <= 0) return 'Price must be greater than 0.';
    if (!Number.isFinite(room.capacity) || room.capacity <= 0)
      return 'Capacity must be greater than 0.';
    if (!room.amenities.length) return 'Select at least one amenity.';

    const duplicate = this.state.rooms.find(
      (item) =>
        item.id !== room.id && item.number.trim().toLowerCase() === room.number.toLowerCase(),
    );
    if (duplicate) return `Room number ${room.number} already exists.`;
    return '';
  }
}
