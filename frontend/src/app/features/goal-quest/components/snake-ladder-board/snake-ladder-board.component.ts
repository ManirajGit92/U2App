import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Checkpoint, GoalDetail, GoalQuestProfile } from '../../models/goal-quest.models';
import { AvatarRendererComponent } from '../avatar-renderer/avatar-renderer.component';

interface BoardCell {
  dayNumber: number;
  dateLabel: string;
  isoDate: string;
  isStart: boolean;
  isGoal: boolean;
  isToday: boolean;
  isPast: boolean;
  checkpoints: Checkpoint[];
  rowIndex: number;
  colIndex: number;
  hasHero: boolean;
  ladderTo?: number;
  snakeTo?: number;
}

interface BoardLink {
  type: 'ladder' | 'snake';
  fromDay: number;
  toDay: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}

@Component({
  selector: 'app-gq-snake-ladder-board',
  standalone: true,
  imports: [CommonModule, AvatarRendererComponent],
  template: `
    <section
      class="sl-stage"
      [class.has-custom-bg]="!!backgroundImageUrl()"
      [style.backgroundImage]="backgroundImageUrl() ? 'linear-gradient(rgba(8, 13, 34, 0.56), rgba(8, 13, 34, 0.72)), url(' + backgroundImageUrl() + ')' : null"
    >
      <!-- Top Stats Header Bar -->
      <div class="sl-header">
        <div class="sl-title-group">
          <div class="sl-dice-badge">🎲</div>
          <div>
            <h3>Snake &amp; Ladder Mode</h3>
            <p>Complete daily steps, hit checkpoints, and reach your goal!</p>
          </div>
        </div>

        <div class="sl-stats-strip">
          <div class="sl-stat">
            <span class="k">Total Days</span>
            <span class="v">{{ stats().totalDays }}</span>
          </div>
          <div class="sl-stat">
            <span class="k">Completed</span>
            <span class="v emerald">{{ stats().completedDays }} Days</span>
          </div>
          <div class="sl-stat">
            <span class="k">Today</span>
            <span class="v gold">Day {{ stats().todayDayNumber }}</span>
          </div>
          <div class="sl-stat">
            <span class="k">Remaining</span>
            <span class="v">{{ stats().remainingDays }} Days</span>
          </div>
          <div class="sl-stat">
            <span class="k">Checkpoints</span>
            <span class="v purple">{{ stats().completedCheckpoints }}/{{ stats().totalCheckpoints }}</span>
          </div>
        </div>
      </div>

      <!-- Board Container -->
      <div class="sl-board-scroll">
        <div class="sl-board-canvas" [style.--sl-cols]="columnsPerRow()">
          <!-- Serpentine Rows (Top row = Goal, Bottom row = Start) -->
          @for (row of boardRows(); track $index) {
            <div class="sl-row">
              @for (cell of row; track cell.dayNumber) {
                <div
                  class="sl-tile"
                  [class.is-start]="cell.isStart"
                  [class.is-goal]="cell.isGoal"
                  [class.is-today]="cell.isToday"
                  [class.is-past]="cell.isPast && !cell.isStart && !cell.isGoal && !cell.isToday"
                  [class.has-checkpoint]="cell.checkpoints.length > 0"
                  [class.is-selected]="isCellSelected(cell)"
                  [class.has-hero]="cell.hasHero"
                  (click)="onTileClick(cell)"
                >
                  <div class="tile-top">
                    <span class="day-num">{{ formatDay(cell.dayNumber) }}</span>
                    <span class="day-date">{{ cell.dateLabel }}</span>
                  </div>

                  @if (cell.isStart) {
                    <div class="tile-badge start-badge">🏁 Start</div>
                  }

                  @if (cell.isGoal) {
                    <div class="tile-badge goal-badge">
                      <span>🏆 Goal</span>
                      <small>{{ goal().title }}</small>
                    </div>
                  }

                  @if (cell.checkpoints.length > 0) {
                    <div class="tile-cp-stack">
                      @for (cp of cell.checkpoints; track cp.id) {
                        <button
                          type="button"
                          class="tile-cp-pill"
                          [class.done]="cp.status === 'Completed'"
                          [class.active]="cp.status === 'InProgress'"
                          [class.locked]="cp.status === 'Locked'"
                          (click)="selectCheckpoint.emit(cp); $event.stopPropagation()"
                          [title]="'CP' + cp.sequenceOrder + ': ' + cp.title"
                        >
                          <span>
                            {{ cp.status === 'Completed' ? '✓' : cp.status === 'InProgress' ? '⭐' : '🔒' }}
                            CP{{ cp.sequenceOrder }}
                          </span>
                          <small>{{ cp.title }}</small>
                        </button>
                      }
                    </div>
                  }

                  @if (cell.isToday) {
                    <div class="today-pill">Today</div>
                  }

                  <!-- Hero Avatar Token on Current Position -->
                  @if (cell.hasHero) {
                    <div class="hero-token" title="Your Hero Position">
                      <div class="hero-mini-wrap">
                        <app-gq-avatar-renderer
                          [characterCode]="profile()?.selectedCharacterCode ?? 'CHAR-HERO'"
                          [costumeCode]="profile()?.equippedCostumeCode ?? 'COST-CYBER-JACKET'"
                          [accessoryCode]="profile()?.equippedAccessoryCode ?? 'ACC-NEON-HEADSET'"
                          [hairstyleCode]="profile()?.equippedHairstyleCode ?? 'HAIR-SPIKY-AZURE'"
                          [effectCode]="profile()?.equippedEffectCode ?? 'EFF-STARLIGHT'"
                          [badgeCode]="profile()?.equippedBadgeCode ?? 'BADGE-EXPLORER'"
                          [compact]="true"
                        />
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Selected Checkpoint Action Bar -->
      @if (selectedCheckpoint(); as cp) {
        <div class="sl-cp-action-bar">
          <div class="sl-cp-info">
            <span class="sl-cp-tag">CP{{ cp.sequenceOrder }}</span>
            <div>
              <strong>{{ cp.title }}</strong>
              <span class="sl-cp-meta">
                Due {{ cp.dueDateUtc | date: 'dd MMM yyyy' }} · {{ cp.questionCount }} Questions · Pass {{ cp.passingPercentage }}% ·
                <span class="gold">+{{ cp.rewardCash }} G</span>
              </span>
            </div>
          </div>
          <div class="sl-cp-buttons">
            <button type="button" class="mini-btn" (click)="editCheckpoint.emit(cp)">✏️ Edit</button>
            <button type="button" class="mini-btn" (click)="openQuestions.emit()">⚙️ Questions</button>
            <button
              type="button"
              class="btn-start-sm"
              [disabled]="cp.status === 'Locked'"
              (click)="launchAssessment.emit(cp)"
            >
              {{ cp.status === 'Locked' ? '🔒 Locked' : '▶ Start Assessment' }}
            </button>
          </div>
        </div>
      }

      <!-- Path Legend Footer -->
      <div class="sl-legend">
        <span class="legend-title">Path Legend:</span>
        <span class="leg-item"><i class="swatch start"></i> Start</span>
        <span class="leg-item"><i class="swatch goal"></i> Goal</span>
        <span class="leg-item"><i class="swatch cp"></i> Checkpoints</span>
        <span class="leg-item"><i class="swatch normal"></i> Normal Day</span>
        <span class="leg-item"><i class="swatch today"></i> Today (Current)</span>
      </div>
    </section>
  `,
  styles: [
    `
      .sl-stage {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        background: linear-gradient(160deg, rgba(16, 25, 62, 0.92) 0%, rgba(10, 17, 42, 0.94) 100%);
        border: 1px solid rgba(139, 92, 246, 0.45);
        border-radius: 18px;
        padding: 0.85rem 1rem;
        box-shadow: inset 0 0 36px rgba(37, 99, 235, 0.16);

        &.has-custom-bg {
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }
      }

      .sl-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .sl-title-group {
        display: flex;
        align-items: center;
        gap: 0.65rem;

        h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 800;
        }
        p {
          margin: 0.1rem 0 0;
          font-size: 0.76rem;
          color: #93c5fd;
        }
      }

      .sl-dice-badge {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        background: linear-gradient(135deg, #6366f1, #a855f7);
        display: grid;
        place-items: center;
        font-size: 1.25rem;
        box-shadow: 0 0 14px rgba(139, 92, 246, 0.55);
      }

      .sl-stats-strip {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .sl-stat {
        background: rgba(15, 23, 42, 0.78);
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 10px;
        padding: 0.3rem 0.65rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 72px;

        .k {
          font-size: 0.64rem;
          color: #94a3b8;
          text-transform: uppercase;
        }
        .v {
          font-size: 0.84rem;
          font-weight: 800;
          color: #f8fafc;
        }
        .emerald {
          color: #4ade80;
        }
        .gold {
          color: #fbbf24;
        }
        .purple {
          color: #c4b5fd;
        }
      }

      .sl-toggle-btn {
        background: rgba(30, 41, 59, 0.85);
        border: 1px solid rgba(148, 163, 184, 0.32);
        color: #cbd5e1;
        padding: 0.4rem 0.7rem;
        border-radius: 10px;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;

        &.active {
          background: rgba(245, 158, 11, 0.22);
          border-color: rgba(251, 191, 36, 0.6);
          color: #fef08a;
        }
      }

      .sl-board-scroll {
        overflow-x: auto;
        overflow-y: auto;
        max-height: 450px;
        padding: 2.2rem 0.25rem 0.5rem;
      }

      .sl-board-canvas {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        min-width: 780px;
      }

      .sl-links-overlay {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 6;
      }

      .sl-row {
        display: grid;
        grid-template-columns: repeat(var(--sl-cols, 10), minmax(72px, 1fr));
        gap: 0.5rem;
        position: relative;
        z-index: 2;
      }

      .sl-tile {
        position: relative;
        min-height: 86px;
        border-radius: 14px;
        padding: 0.42rem 0.45rem;
        background: linear-gradient(160deg, rgba(56, 189, 248, 0.28), rgba(37, 99, 235, 0.34));
        border: 1.5px solid rgba(125, 211, 252, 0.4);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 0.2rem;
        cursor: pointer;
        transition: transform 0.16s ease, box-shadow 0.16s ease;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 18px rgba(56, 189, 248, 0.28);
        }

        &.is-past {
          background: linear-gradient(160deg, rgba(52, 211, 153, 0.22), rgba(16, 185, 129, 0.18));
          border-color: rgba(52, 211, 153, 0.42);
        }

        &.is-start {
          background: linear-gradient(145deg, #059669, #10b981);
          border: 2px solid #86efac;
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.55);
        }

        &.is-goal {
          background: linear-gradient(145deg, #b45309, #f59e0b);
          border: 2px solid #fef08a;
          box-shadow: 0 0 22px rgba(251, 191, 36, 0.65);
        }

        &.has-checkpoint {
          background: linear-gradient(145deg, rgba(109, 40, 217, 0.78), rgba(79, 70, 229, 0.72));
          border: 2px solid #c4b5fd;
          box-shadow: 0 0 18px rgba(139, 92, 246, 0.55);
        }

        &.is-today {
          background: linear-gradient(145deg, rgba(217, 119, 6, 0.85), rgba(245, 158, 11, 0.72));
          border: 2px solid #fef08a;
          box-shadow: 0 0 24px rgba(251, 191, 36, 0.85);
        }

        &.is-selected {
          outline: 2.5px solid #38bdf8;
          outline-offset: 2px;
        }
      }

      .tile-top {
        display: flex;
        flex-direction: column;
        align-items: center;
        line-height: 1.1;
      }

      .day-num {
        font-size: 1rem;
        font-weight: 900;
        color: #ffffff;
      }

      .day-date {
        font-size: 0.65rem;
        color: #e2e8f0;
        opacity: 0.92;
      }

      .tile-badge {
        text-align: center;
        font-size: 0.68rem;
        font-weight: 800;
        border-radius: 7px;
        padding: 0.12rem 0.25rem;
        background: rgba(15, 23, 42, 0.45);
        color: #fff;

        small {
          display: block;
          font-size: 0.58rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .tile-cp-stack {
        display: flex;
        flex-direction: column;
        gap: 0.16rem;
      }

      .tile-cp-pill {
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.28);
        border-radius: 6px;
        padding: 0.12rem 0.24rem;
        background: rgba(15, 23, 42, 0.62);
        color: #f8fafc;
        font-size: 0.63rem;
        font-weight: 700;
        text-align: left;
        cursor: pointer;

        small {
          display: block;
          font-size: 0.57rem;
          font-weight: 500;
          color: #cbd5e1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        &.done {
          border-color: #4ade80;
          background: rgba(6, 78, 59, 0.78);
        }
        &.active {
          border-color: #fbbf24;
          background: rgba(120, 53, 15, 0.78);
        }
      }

      .today-pill {
        align-self: center;
        background: #1e1b4b;
        color: #fef08a;
        font-size: 0.62rem;
        font-weight: 900;
        padding: 0.08rem 0.42rem;
        border-radius: 999px;
      }

      .link-chip {
        position: absolute;
        top: 3px;
        right: 3px;
        font-size: 0.56rem;
        font-weight: 800;
        padding: 0.06rem 0.25rem;
        border-radius: 6px;
        background: rgba(15, 23, 42, 0.8);

        &.ladder {
          color: #fde68a;
          border: 1px solid rgba(251, 191, 36, 0.6);
        }
        &.snake {
          color: #fecaca;
          border: 1px solid rgba(248, 113, 113, 0.6);
        }
      }

      .hero-token {
        position: absolute;
        top: -46px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9;
        pointer-events: none;
        filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.7));
      }

      .hero-mini-wrap {
        width: 82px;
        height: 108px;
        overflow: visible;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: scale(0.62);
        transform-origin: center top;
      }

      .sl-cp-action-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.65rem;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(139, 92, 246, 0.45);
        border-radius: 12px;
        padding: 0.55rem 0.85rem;
      }

      .sl-cp-info {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .sl-cp-tag {
        background: #7c3aed;
        color: #fff;
        font-weight: 800;
        font-size: 0.74rem;
        padding: 0.22rem 0.55rem;
        border-radius: 8px;
      }

      .sl-cp-meta {
        display: block;
        font-size: 0.76rem;
        color: #cbd5e1;
        .gold {
          color: #fbbf24;
          font-weight: 700;
        }
      }

      .sl-cp-buttons {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }

      .mini-btn {
        background: rgba(30, 41, 59, 0.88);
        border: 1px solid rgba(148, 163, 184, 0.32);
        color: #e2e8f0;
        padding: 0.34rem 0.65rem;
        border-radius: 8px;
        font-size: 0.76rem;
        cursor: pointer;
      }

      .btn-start-sm {
        background: linear-gradient(135deg, #f59e0b, #fbbf24);
        border: none;
        color: #1e1b4b;
        font-weight: 900;
        font-size: 0.78rem;
        padding: 0.4rem 0.85rem;
        border-radius: 9px;
        cursor: pointer;

        &:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      }

      .sl-legend {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding-top: 0.35rem;
        border-top: 1px solid rgba(148, 163, 184, 0.16);
        font-size: 0.74rem;
        color: #cbd5e1;
      }

      .legend-title {
        font-weight: 800;
        color: #f8fafc;
      }

      .leg-item {
        display: inline-flex;
        align-items: center;
        gap: 0.32rem;
      }

      .swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 3px;
        &.start {
          background: #10b981;
        }
        &.goal {
          background: #f59e0b;
        }
        &.cp {
          background: #7c3aed;
        }
        &.normal {
          background: #38bdf8;
        }
        &.today {
          background: #fbbf24;
          box-shadow: 0 0 8px #fbbf24;
        }
      }
    `,
  ],
})
export class SnakeLadderBoardComponent {
  readonly goal = input.required<GoalDetail>();
  readonly selectedCheckpoint = input<Checkpoint | null>(null);
  readonly profile = input<GoalQuestProfile | null>(null);
  readonly backgroundImageUrl = input<string | null>(null);

  readonly selectCheckpoint = output<Checkpoint>();
  readonly launchAssessment = output<Checkpoint>();
  readonly editCheckpoint = output<Checkpoint>();
  readonly openQuestions = output<void>();

  readonly showSnakesAndLadders = signal(true);
  readonly columnsPerRow = signal(10);

  private toDayStartMs(iso: string): number {
    const d = new Date(iso);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  private todayStartMs(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }

  readonly boardData = computed(() => {
    const g = this.goal();
    const startMs = this.toDayStartMs(g.createdAtUtc);
    const targetMs = Math.max(startMs, this.toDayStartMs(g.targetDateUtc));
    const dayMs = 86400000;
    const rawDays = Math.floor((targetMs - startMs) / dayMs) + 1;
    // Clamp board to [5..120] visible days so huge multi-year ranges remain fast and legible
    const totalDays = Math.min(120, Math.max(5, rawDays));
    const stepDays = rawDays > 120 ? rawDays / totalDays : 1;

    const todayMs = this.todayStartMs();
    const todayRawIdx = Math.floor((todayMs - startMs) / dayMs) + 1;
    const todayDayNumber = Math.min(totalDays, Math.max(1, Math.round(todayRawIdx / stepDays)));

    // Map checkpoints to day numbers based on dueDateUtc
    const cpByDay = new Map<number, Checkpoint[]>();
    for (const cp of g.checkpoints) {
      const cpMs = this.toDayStartMs(cp.dueDateUtc);
      const cpRawIdx = Math.floor((cpMs - startMs) / dayMs) + 1;
      const dayNum = Math.min(totalDays, Math.max(1, Math.round(cpRawIdx / stepDays)));
      const list = cpByDay.get(dayNum) ?? [];
      list.push(cp);
      cpByDay.set(dayNum, list);
    }

    // Hero position blends current date + completed checkpoint progress
    const completedCps = g.checkpoints.filter((c) => c.status === 'Completed');
    let heroDay = todayDayNumber;
    if (completedCps.length > 0 && g.checkpoints.length > 0) {
      const progressDay = Math.max(
        1,
        Math.round((completedCps.length / g.checkpoints.length) * totalDays),
      );
      heroDay = Math.min(totalDays, Math.max(todayDayNumber, progressDay));
    }

    // Generate deterministic snakes & ladders proportional to totalDays
    const ladderMap = new Map<number, number>();
    const snakeMap = new Map<number, number>();
    if (totalDays >= 15) {
      const l1Start = Math.max(2, Math.round(totalDays * 0.1));
      const l1End = Math.min(totalDays - 1, l1Start + Math.max(5, Math.round(totalDays * 0.25)));
      ladderMap.set(l1Start, l1End);

      const l2Start = Math.max(4, Math.round(totalDays * 0.42));
      const l2End = Math.min(totalDays - 1, l2Start + Math.max(6, Math.round(totalDays * 0.26)));
      if (!ladderMap.has(l2Start)) ladderMap.set(l2Start, l2End);

      const s1Start = Math.min(totalDays - 1, Math.round(totalDays * 0.56));
      const s1End = Math.max(2, s1Start - Math.max(5, Math.round(totalDays * 0.22)));
      snakeMap.set(s1Start, s1End);

      const s2Start = Math.min(totalDays - 1, Math.round(totalDays * 0.85));
      const s2End = Math.max(2, s2Start - Math.max(6, Math.round(totalDays * 0.28)));
      if (!snakeMap.has(s2Start) && !ladderMap.has(s2Start)) snakeMap.set(s2Start, s2End);
    }

    const cols = this.columnsPerRow();
    const totalRows = Math.ceil(totalDays / cols);
    const cells: BoardCell[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let d = 1; d <= totalDays; d++) {
      const cellMs = startMs + Math.round((d - 1) * stepDays) * dayMs;
      const dt = new Date(cellMs);
      const dateLabel = `${monthNames[dt.getUTCMonth()]} ${String(dt.getUTCDate()).padStart(2, '0')}`;
      const rowFromBottom = Math.floor((d - 1) / cols);
      const posInRow = (d - 1) % cols;
      // Serpentine: even rows from bottom go right-to-left (01 at bottom-right!), odd rows go left-to-right
      const colIndex = rowFromBottom % 2 === 0 ? cols - 1 - posInRow : posInRow;
      const rowIndex = totalRows - 1 - rowFromBottom;

      cells.push({
        dayNumber: d,
        dateLabel,
        isoDate: dt.toISOString().slice(0, 10),
        isStart: d === 1,
        isGoal: d === totalDays,
        isToday: d === todayDayNumber,
        isPast: d < todayDayNumber,
        checkpoints: cpByDay.get(d) ?? [],
        rowIndex,
        colIndex,
        hasHero: d === heroDay,
        ladderTo: ladderMap.get(d),
        snakeTo: snakeMap.get(d),
      });
    }

    // Arrange into display rows (top to bottom)
    const rows: BoardCell[][] = Array.from({ length: totalRows }, () => []);
    for (const c of cells) {
      rows[c.rowIndex].push(c);
    }
    for (const r of rows) {
      r.sort((a, b) => a.colIndex - b.colIndex);
    }

    // Build SVG links between cell centers
    const byDay = new Map(cells.map((c) => [c.dayNumber, c]));
    const rowH = 95;
    const links: BoardLink[] = [];

    const addLink = (type: 'ladder' | 'snake', fromDay: number, toDay: number) => {
      const a = byDay.get(fromDay);
      const b = byDay.get(toDay);
      if (!a || !b) return;
      links.push({
        type,
        fromDay,
        toDay,
        x1: ((a.colIndex + 0.5) / cols) * 1000,
        y1: a.rowIndex * rowH + rowH * 0.5,
        x2: ((b.colIndex + 0.5) / cols) * 1000,
        y2: b.rowIndex * rowH + rowH * 0.5,
        label: type === 'ladder' ? `Boost Day ${fromDay} → ${toDay}` : `Delay Day ${fromDay} → ${toDay}`,
      });
    };

    ladderMap.forEach((to, from) => addLink('ladder', from, to));
    snakeMap.forEach((to, from) => addLink('snake', from, to));

    return {
      rows,
      links,
      totalRows,
      totalDays: rawDays,
      completedDays: Math.min(rawDays, Math.max(0, todayRawIdx - 1)),
      remainingDays: Math.max(0, rawDays - Math.max(0, todayRawIdx)),
      todayDayNumber: Math.min(rawDays, Math.max(1, todayRawIdx)),
      completedCheckpoints: completedCps.length,
      totalCheckpoints: g.checkpoints.length,
    };
  });

  readonly boardRows = computed(() => this.boardData().rows);
  readonly boardLinks = computed(() => this.boardData().links);
  readonly svgHeight = computed(() => Math.max(200, this.boardData().totalRows * 95));
  readonly stats = computed(() => {
    const d = this.boardData();
    return {
      totalDays: d.totalDays,
      completedDays: d.completedDays,
      remainingDays: d.remainingDays,
      todayDayNumber: d.todayDayNumber,
      completedCheckpoints: d.completedCheckpoints,
      totalCheckpoints: d.totalCheckpoints,
    };
  });

  formatDay(n: number): string {
    return String(n).padStart(2, '0');
  }

  isCellSelected(cell: BoardCell): boolean {
    const sel = this.selectedCheckpoint();
    return !!sel && cell.checkpoints.some((c) => c.id === sel.id);
  }

  onTileClick(cell: BoardCell): void {
    if (cell.checkpoints.length > 0) {
      this.selectCheckpoint.emit(cell.checkpoints[0]);
    }
  }

  buildSnakePath(link: BoardLink): string {
    const midX = (link.x1 + link.x2) / 2;
    const midY = (link.y1 + link.y2) / 2;
    const curve1X = midX + 38;
    const curve2X = midX - 38;
    return `M ${link.x1} ${link.y1} C ${curve1X} ${(link.y1 + midY) / 2}, ${curve2X} ${(midY + link.y2) / 2}, ${link.x2} ${link.y2}`;
  }
}
