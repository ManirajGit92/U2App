import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-gq-avatar-renderer',
  standalone: true,
  template: `
    <div class="avatar-stage" [class.compact]="compact()">
      <svg viewBox="0 0 200 260" class="avatar-svg" aria-label="RPG Character Avatar">
        <defs>
          <radialGradient [attr.id]="gradId() + '-aura'" cx="50%" cy="50%" r="50%">
            <stop offset="0%" [attr.stop-color]="effectColor()" stop-opacity="0.55" />
            <stop offset="100%" [attr.stop-color]="effectColor()" stop-opacity="0" />
          </radialGradient>
          <linearGradient [attr.id]="gradId() + '-jacket'" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" [attr.stop-color]="costumeColors().primary" />
            <stop offset="100%" [attr.stop-color]="costumeColors().secondary" />
          </linearGradient>
          <linearGradient [attr.id]="gradId() + '-pedestal'" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="50%" stop-color="#8b5cf6" />
            <stop offset="100%" stop-color="#38bdf8" />
          </linearGradient>
        </defs>

        <!-- Effect Aura -->
        <ellipse cx="100" cy="130" rx="78" ry="88" [attr.fill]="'url(#' + gradId() + '-aura)'" />

        <!-- Phoenix Wings Effect -->
        @if (effectCode() === 'EFF-PHOENIX-WINGS') {
          <g class="wings-glow">
            <path d="M68 125 C22 92, 12 135, 36 160 C25 145, 42 138, 65 145 Z" fill="#f43f5e" opacity="0.88" />
            <path d="M66 132 C34 114, 28 148, 48 168 Z" fill="#fbbf24" opacity="0.9" />
            <path d="M132 125 C178 92, 188 135, 164 160 C175 145, 158 138, 135 145 Z" fill="#f43f5e" opacity="0.88" />
            <path d="M134 132 C166 114, 172 148, 152 168 Z" fill="#fbbf24" opacity="0.9" />
          </g>
        }

        <!-- Lightning Aura Rings -->
        @if (effectCode() === 'EFF-LIGHTNING-AURA') {
          <ellipse cx="100" cy="145" rx="64" ry="22" fill="none" stroke="#c084fc" stroke-width="2.5" stroke-dasharray="10 6" opacity="0.85" />
          <ellipse cx="100" cy="115" rx="54" ry="18" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 8" opacity="0.75" />
        }

        <!-- Glowing Pedestal -->
        <ellipse cx="100" cy="236" rx="66" ry="15" fill="#1e1b4b" stroke="#60a5fa" stroke-width="2.5" />
        <ellipse cx="100" cy="232" rx="54" ry="10" [attr.fill]="'url(#' + gradId() + '-pedestal)'" opacity="0.65" />

        <!-- Boots & Legs -->
        <rect x="76" y="172" width="18" height="46" rx="7" fill="#1e293b" />
        <rect x="106" y="172" width="18" height="46" rx="7" fill="#1e293b" />
        <rect x="72" y="212" width="24" height="14" rx="6" [attr.fill]="costumeColors().primary" />
        <rect x="104" y="212" width="24" height="14" rx="6" [attr.fill]="costumeColors().primary" />

        <!-- Torso / Costume -->
        <path d="M68 112 Q100 100 132 112 L138 176 Q100 184 62 176 Z" [attr.fill]="'url(#' + gradId() + '-jacket)'" stroke="#e2e8f0" stroke-opacity="0.25" stroke-width="1.5" />
        <!-- Inner Shirt & Crest -->
        <path d="M88 112 L112 112 L108 174 L92 174 Z" fill="#0f172a" opacity="0.85" />
        <polygon points="100,126 108,136 100,148 92,136" [attr.fill]="costumeColors().accent" />

        <!-- Arms -->
        <rect x="50" y="116" width="18" height="52" rx="9" [attr.fill]="costumeColors().primary" />
        <rect x="132" y="116" width="18" height="52" rx="9" [attr.fill]="costumeColors().primary" />
        <circle cx="59" cy="170" r="8" fill="#f3c6a5" />
        <circle cx="141" cy="170" r="8" fill="#f3c6a5" />

        <!-- Neck & Head -->
        <rect x="92" y="92" width="16" height="18" rx="6" fill="#eab38c" />
        <circle cx="100" cy="70" r="30" fill="#f6cfb2" />

        <!-- Eyes & Smile -->
        <circle cx="89" cy="70" r="4" fill="#0f172a" />
        <circle cx="111" cy="70" r="4" fill="#0f172a" />
        <circle cx="90.5" cy="68.5" r="1.4" fill="#ffffff" />
        <circle cx="112.5" cy="68.5" r="1.4" fill="#ffffff" />
        <path d="M92 82 Q100 89 108 82" fill="none" stroke="#7c2d12" stroke-width="2.2" stroke-linecap="round" />

        <!-- Hairstyle -->
        @if (hairstyleCode() === 'HAIR-NEBULA-WAVE') {
          <path d="M66 68 Q70 28 100 28 Q132 28 134 68 Q124 48 100 50 Q76 48 66 68 Z" fill="#7c3aed" />
          <path d="M66 64 Q60 88 72 96" fill="none" stroke="#a855f7" stroke-width="8" stroke-linecap="round" />
          <path d="M134 64 Q140 88 128 96" fill="none" stroke="#a855f7" stroke-width="8" stroke-linecap="round" />
        } @else if (hairstyleCode() === 'HAIR-SILVER-BLADE') {
          <path d="M68 62 L78 28 L96 42 L112 24 L124 44 L134 62 Q100 44 68 62 Z" fill="#cbd5e1" />
        } @else {
          <path d="M68 62 L76 30 L92 42 L104 24 L118 42 L132 34 L133 62 Q100 45 68 62 Z" [attr.fill]="hairColor()" />
        }

        <!-- Accessories -->
        @if (accessoryCode() === 'ACC-NEON-HEADSET') {
          <path d="M67 66 A33 33 0 0 1 133 66" fill="none" stroke="#38bdf8" stroke-width="4" />
          <rect x="61" y="60" width="10" height="20" rx="5" fill="#0284c7" stroke="#7dd3fc" stroke-width="1.5" />
          <rect x="129" y="60" width="10" height="20" rx="5" fill="#0284c7" stroke="#7dd3fc" stroke-width="1.5" />
        } @else if (accessoryCode() === 'ACC-GOLD-CROWN') {
          <polygon points="78,42 84,22 95,34 100,18 105,34 116,22 122,42" fill="#fbbf24" stroke="#fef08a" stroke-width="1.5" />
        } @else if (accessoryCode() === 'ACC-CYBER-VISOR') {
          <rect x="76" y="62" width="48" height="14" rx="6" fill="#a855f7" fill-opacity="0.72" stroke="#e879f9" stroke-width="1.8" />
        }

        <!-- Equipped Badge Emblem -->
        <circle cx="132" cy="132" r="10" fill="#0f172a" stroke="#fbbf24" stroke-width="1.8" />
        <text x="132" y="136" text-anchor="middle" font-size="11">{{ badgeIcon() }}</text>
      </svg>
    </div>
  `,
  styles: [
    `
      .avatar-stage {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
      }
      .avatar-svg {
        width: 170px;
        height: 220px;
        filter: drop-shadow(0 12px 24px rgba(56, 189, 248, 0.25));
        transition: transform 0.3s ease;
      }
      .avatar-stage.compact .avatar-svg {
        width: 130px;
        height: 170px;
      }
      .avatar-svg:hover {
        transform: translateY(-4px) scale(1.02);
      }
    `,
  ],
})
export class AvatarRendererComponent {
  readonly characterCode = input<string>('CHAR-HERO');
  readonly costumeCode = input<string>('COST-CYBER-JACKET');
  readonly accessoryCode = input<string>('ACC-NEON-HEADSET');
  readonly hairstyleCode = input<string>('HAIR-SPIKY-AZURE');
  readonly effectCode = input<string>('EFF-STARLIGHT');
  readonly badgeCode = input<string>('BADGE-EXPLORER');
  readonly compact = input<boolean>(false);

  readonly gradId = computed(() => `gq-${this.characterCode()}-${this.costumeCode()}`);

  readonly costumeColors = computed(() => {
    switch (this.costumeCode()) {
      case 'COST-ARCANE-ROBE':
        return { primary: '#7c3aed', secondary: '#4c1d95', accent: '#f472b6' };
      case 'COST-PALADIN-ARMOR':
        return { primary: '#f59e0b', secondary: '#b45309', accent: '#fef08a' };
      case 'COST-SHADOW-CLOAK':
        return { primary: '#10b981', secondary: '#064e3b', accent: '#34d399' };
      default:
        return { primary: '#2563eb', secondary: '#1e3a8a', accent: '#38bdf8' };
    }
  });

  readonly hairColor = computed(() => {
    switch (this.characterCode()) {
      case 'CHAR-MAGE':
        return '#8b5cf6';
      case 'CHAR-KNIGHT':
        return '#d97706';
      case 'CHAR-NINJA':
        return '#334155';
      default:
        return '#3b2416';
    }
  });

  readonly effectColor = computed(() => {
    switch (this.effectCode()) {
      case 'EFF-PHOENIX-WINGS':
        return '#f43f5e';
      case 'EFF-LIGHTNING-AURA':
        return '#a855f7';
      default:
        return '#38bdf8';
    }
  });

  readonly badgeIcon = computed(() => {
    switch (this.badgeCode()) {
      case 'BADGE-GRANDMASTER':
        return '🏅';
      default:
        return '🧭';
    }
  });
}
