import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import * as XLSX from 'xlsx';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../core/services/firebase-sync.service';

const APP_NAME = 'work-tracker';

export interface DeveloperTask {
  taskId: string;
  week: string;
  resourceName: string;
  projectName: string;
  module: string;
  taskTitle: string;
  taskDescription: string;
  taskType: string;
  status: string;
  priority: string;
  size: string;
  hours?: number;
  startDate: string;
  dueDate: string;
  completedDate: string;
  progress: number;
  tags: string;
  comments: string;
  isVisible?: boolean;
}

export interface ReleaseTrack {
  id: string;
  title: string;
  category: string;
  module: string;
  type: string;
  priority: string;
  status: string;
  prdStatus: string;
  environment?: string;
  assignedTo: string;
  createdDate: string;
  targetDate: string;
  completedDate: string;
  progress: number;
  remarks: string;
  sourceSheet: string;
  dependency: string;
  tags: string;
  isVisible?: boolean;
}

export type HourlyUpdateStatus = 'Completed' | 'In Progress' | 'Pending';

export interface HourlyWorkUpdate {
  id: string;
  date: string;
  hour: string;
  taskDescription: string;
  status: HourlyUpdateStatus;
  isVisible?: boolean;
}

export interface WorkTrackerData {
  developerTasks: DeveloperTask[];
  releaseTracks: ReleaseTrack[];
  hourlyUpdates: HourlyWorkUpdate[];
  storageMode: 'local' | 'google-sheets';
}

@Injectable({
  providedIn: 'root',
})
export class WorkTrackerService {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);

  private expandAllSubject = new Subject<void>();
  private collapseAllSubject = new Subject<void>();

  expandAll$ = this.expandAllSubject.asObservable();
  collapseAll$ = this.collapseAllSubject.asObservable();

  expandAllSections(): void {
    this.expandAllSubject.next();
  }

  collapseAllSections(): void {
    this.collapseAllSubject.next();
  }
  private initialState: WorkTrackerData = {
    developerTasks: [
      // ═════════════════════════════════════════════════════════════════════
      // WEEK 1: One Week Before (Oct 05, 2026 – Oct 11, 2026) - Historical / Completed
      // ═════════════════════════════════════════════════════════════════════
      {
        taskId: 'T-001',
        week: 'W1',
        resourceName: 'Maniraj',
        projectName: 'U2Tools',
        module: 'Work Tracker',
        taskTitle: 'Design System Token Architecture',
        taskDescription: 'Establish HSL CSS design tokens, typography, and HUD dark/light/JARVIS theme engines',
        taskType: 'Architecture',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 20,
        startDate: '2026-10-05',
        dueDate: '2026-10-09',
        completedDate: '2026-10-09',
        progress: 100,
        tags: 'theme, tokens, ui, architecture',
        comments: 'Completed ahead of schedule, verified across all modern browsers',
        isVisible: true,
      },
      {
        taskId: 'T-002',
        week: 'W1',
        resourceName: 'Maniraj',
        projectName: 'U2Tools',
        module: 'UI Framework',
        taskTitle: 'Responsive App Shell & Drawer Navigation',
        taskDescription: 'Implement collapsible sidebar, mobile hamburger drawer, and fluid grid layout',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'High',
        size: 'M',
        hours: 16,
        startDate: '2026-10-05',
        dueDate: '2026-10-08',
        completedDate: '2026-10-08',
        progress: 100,
        tags: 'frontend, layout, mobile, responsive',
        comments: 'Fully verified on mobile and tablet viewports',
        isVisible: true,
      },
      {
        taskId: 'T-003',
        week: 'W1',
        resourceName: 'Vamsi',
        projectName: 'U2Tools',
        module: 'Architecture',
        taskTitle: 'Micro-Frontend Modular Federation Setup',
        taskDescription: 'Configure standalone component sharing and shared service dependency tree',
        taskType: 'Architecture',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 24,
        startDate: '2026-10-05',
        dueDate: '2026-10-09',
        completedDate: '2026-10-09',
        progress: 100,
        tags: 'architecture, core, angular, federation',
        comments: 'Modular federation builds passing cleanly with zero bundle duplication',
        isVisible: true,
      },
      {
        taskId: 'T-004',
        week: 'W1',
        resourceName: 'Arun',
        projectName: 'Standup Note',
        module: 'AI Engine',
        taskTitle: 'Gemini 2.5 Streaming Gateway',
        taskDescription: 'Setup real-time streaming endpoint for executive meeting summaries and action items',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'Critical',
        size: 'M',
        hours: 18,
        startDate: '2026-10-05',
        dueDate: '2026-10-09',
        completedDate: '2026-10-09',
        progress: 100,
        tags: 'ai, gemini, backend, streaming',
        comments: 'Streaming responses operating under 400ms time-to-first-token',
        isVisible: true,
      },
      {
        taskId: 'T-005',
        week: 'W1',
        resourceName: 'Rohit',
        projectName: 'Standup Note',
        module: 'Audio Pipeline',
        taskTitle: 'Audio Stream Buffer & VAD Module',
        taskDescription: 'Integrate voice activity detection (VAD) and Web Speech API fallback buffering',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'High',
        size: 'M',
        hours: 16,
        startDate: '2026-10-05',
        dueDate: '2026-10-08',
        completedDate: '2026-10-08',
        progress: 100,
        tags: 'audio, vad, voice, speech',
        comments: 'Background noise rejection tuned for open office environments',
        isVisible: true,
      },
      {
        taskId: 'T-006',
        week: 'W1',
        resourceName: 'Karina',
        projectName: 'MatchGuide',
        module: 'Matching Engine',
        taskTitle: 'Candidate Vector Embeddings Pipeline',
        taskDescription: 'Generate vector embeddings from PDF resumes using high-dimensional text models',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 22,
        startDate: '2026-10-05',
        dueDate: '2026-10-09',
        completedDate: '2026-10-09',
        progress: 100,
        tags: 'ai, vector, embeddings, python',
        comments: 'Benchmarked on 1,000 test resumes with cosine similarity caching',
        isVisible: true,
      },
      {
        taskId: 'T-007',
        week: 'W1',
        resourceName: 'Priya',
        projectName: 'MatchGuide',
        module: 'Testing',
        taskTitle: 'Resume Parser Benchmark & QA Suite',
        taskDescription: 'Validate multi-column PDF extraction accuracy and edge cases across formats',
        taskType: 'Testing',
        status: 'Completed',
        priority: 'High',
        size: 'M',
        hours: 14,
        startDate: '2026-10-06',
        dueDate: '2026-10-09',
        completedDate: '2026-10-09',
        progress: 100,
        tags: 'qa, parsing, testing, resumes',
        comments: '98.5% field extraction accuracy achieved across complex layouts',
        isVisible: true,
      },
      {
        taskId: 'T-008',
        week: 'W1',
        resourceName: 'Vamsi',
        projectName: 'S2App ECommerce',
        module: 'DevOps',
        taskTitle: 'Multi-Region Kubernetes Ingress Setup',
        taskDescription: 'Configure cloud load balancer, SSL cert renewals, and ArgoCD automated canary deployments',
        taskType: 'Architecture',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 20,
        startDate: '2026-10-05',
        dueDate: '2026-10-09',
        completedDate: '2026-10-09',
        progress: 100,
        tags: 'k8s, devops, ingress, argocd',
        comments: 'Canary deployment pipeline online with automated rollback triggers',
        isVisible: true,
      },
      {
        taskId: 'T-009',
        week: 'W1',
        resourceName: 'Karthik',
        projectName: 'S2App ECommerce',
        module: 'Checkout',
        taskTitle: 'Payment Gateway Webhook Handlers',
        taskDescription: 'Implement idempotency keys and secure HMAC webhook verification for Stripe & PayPal',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'High',
        size: 'M',
        hours: 16,
        startDate: '2026-10-05',
        dueDate: '2026-10-09',
        completedDate: '2026-10-09',
        progress: 100,
        tags: 'payments, stripe, backend, webhooks',
        comments: 'Audited and PCI-DSS compliant tokenization verified',
        isVisible: true,
      },
      {
        taskId: 'T-010',
        week: 'W1',
        resourceName: 'Erika',
        projectName: 'Excelendsite',
        module: 'Parser',
        taskTitle: 'Streaming XLSX Workbook Parser',
        taskDescription: 'Parse large spreadsheets with background web workers to maintain smooth 60fps UI',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 24,
        startDate: '2026-10-05',
        dueDate: '2026-10-09',
        completedDate: '2026-10-09',
        progress: 100,
        tags: 'excel, parser, worker, streaming',
        comments: '500,000 rows parsed in under 3.2 seconds without UI freeze',
        isVisible: true,
      },

      // ═════════════════════════════════════════════════════════════════════
      // WEEK 2: Current Week (Oct 12, 2026 – Oct 18, 2026) - Active Sprints
      // ═════════════════════════════════════════════════════════════════════
      {
        taskId: 'T-011',
        week: 'W2',
        resourceName: 'Maniraj',
        projectName: 'U2Tools',
        module: 'Work Tracker',
        taskTitle: 'Live Dashboard KPI & Telemetry Sync',
        taskDescription: 'Connect real-time observables, period granularity filters, and trend analytics',
        taskType: 'Feature',
        status: 'In Progress',
        priority: 'Critical',
        size: 'M',
        hours: 16,
        startDate: '2026-10-12',
        dueDate: '2026-10-16',
        completedDate: '',
        progress: 80,
        tags: 'frontend, dashboard, telemetry, angular',
        comments: 'Connecting observables and week-by-week period filter syncing',
        isVisible: true,
      },
      {
        taskId: 'T-012',
        week: 'W2',
        resourceName: 'Maniraj',
        projectName: 'U2Tools',
        module: 'Day Work',
        taskTitle: 'Day Work Track Multi-Mode Scheduler',
        taskDescription: 'Implement hourly, day-wise (8h), and actual hours allocation with overdue popups',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 20,
        startDate: '2026-10-12',
        dueDate: '2026-10-15',
        completedDate: '2026-10-15',
        progress: 100,
        tags: 'scheduler, modes, overdue, timesheet',
        comments: 'All 3 tracking modes tested and working with reminder frequencies',
        isVisible: true,
      },
      {
        taskId: 'T-013',
        week: 'W2',
        resourceName: 'Vamsi',
        projectName: 'U2Tools',
        module: 'Data Layer',
        taskTitle: 'Firestore Push/Pull Sync & Offline Cache',
        taskDescription: 'Implement auto-retry with exponential backoff and indexedDB offline caching',
        taskType: 'Architecture',
        status: 'In Progress',
        priority: 'Critical',
        size: 'L',
        hours: 22,
        startDate: '2026-10-12',
        dueDate: '2026-10-16',
        completedDate: '',
        progress: 75,
        tags: 'firebase, sync, cache, offline',
        comments: 'Offline persistence layer configured with automatic cloud reconciliation',
        isVisible: true,
      },
      {
        taskId: 'T-014',
        week: 'W2',
        resourceName: 'Priya',
        projectName: 'U2Tools',
        module: 'Testing',
        taskTitle: 'Playwright E2E Test Suite for Work Tracker',
        taskDescription: 'Automate full test coverage for task CRUD, status updates, and Excel export/import',
        taskType: 'Testing',
        status: 'In Progress',
        priority: 'High',
        size: 'M',
        hours: 16,
        startDate: '2026-10-13',
        dueDate: '2026-10-16',
        completedDate: '',
        progress: 70,
        tags: 'playwright, e2e, testing, automation',
        comments: '18 test scenarios green, working on modal validation edge cases',
        isVisible: true,
      },
      {
        taskId: 'T-015',
        week: 'W2',
        resourceName: 'Arun',
        projectName: 'Standup Note',
        module: 'AI Engine',
        taskTitle: 'Executive Summary & Action Item Extraction',
        taskDescription: 'Fine-tune Gemini prompts to extract structured bullet action items with owners and deadlines',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'Critical',
        size: 'M',
        hours: 16,
        startDate: '2026-10-12',
        dueDate: '2026-10-14',
        completedDate: '2026-10-14',
        progress: 100,
        tags: 'ai, prompt, standup, gemini',
        comments: 'Sign-off received from executive stakeholders',
        isVisible: true,
      },
      {
        taskId: 'T-016',
        week: 'W2',
        resourceName: 'Rohit',
        projectName: 'Standup Note',
        module: 'Editor',
        taskTitle: 'Rich Markdown Editor Slash Commands',
        taskDescription: 'Add quick slash command menu for tasks, tables, headings, and code snippets',
        taskType: 'Enhancement',
        status: 'In Progress',
        priority: 'Medium',
        size: 'M',
        hours: 14,
        startDate: '2026-10-13',
        dueDate: '2026-10-16',
        completedDate: '',
        progress: 60,
        tags: 'editor, markdown, ui, shortcuts',
        comments: 'Command dropdown rendered, tuning keyboard navigation handlers',
        isVisible: true,
      },
      {
        taskId: 'T-017',
        week: 'W2',
        resourceName: 'Arun',
        projectName: 'S2App ECommerce',
        module: 'Storefront',
        taskTitle: 'Instant Search & Multi-Facet Filtering',
        taskDescription: 'Real-time category filtering by price, brand, rating with debounced query execution',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'High',
        size: 'M',
        hours: 16,
        startDate: '2026-10-12',
        dueDate: '2026-10-15',
        completedDate: '2026-10-15',
        progress: 100,
        tags: 'storefront, search, ui, instant',
        comments: 'Sub-40ms render time achieved across 5,000 SKU catalog',
        isVisible: true,
      },
      {
        taskId: 'T-018',
        week: 'W2',
        resourceName: 'Bob',
        projectName: 'S2App ECommerce',
        module: 'Testing',
        taskTitle: 'Checkout Flow Stress & Security Testing',
        taskDescription: 'Load test concurrent checkouts and run automated vulnerability scanner against payment endpoints',
        taskType: 'Testing',
        status: 'In Progress',
        priority: 'High',
        size: 'M',
        hours: 12,
        startDate: '2026-10-13',
        dueDate: '2026-10-16',
        completedDate: '',
        progress: 65,
        tags: 'loadtest, security, checkout, owasp',
        comments: 'Stress test to 5,000 concurrent carts passing with zero dropped transactions',
        isVisible: true,
      },
      {
        taskId: 'T-019',
        week: 'W2',
        resourceName: 'Karina',
        projectName: 'MatchGuide',
        module: 'Matching Engine',
        taskTitle: 'Cosine Similarity Ranking & Score Badging',
        taskDescription: 'Rank applicants by requisition match score and display fit breakdown badges',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 20,
        startDate: '2026-10-12',
        dueDate: '2026-10-15',
        completedDate: '2026-10-15',
        progress: 100,
        tags: 'ranking, vector, matching, ai',
        comments: '94.2% precision verified against recruitment gold standard dataset',
        isVisible: true,
      },
      {
        taskId: 'T-020',
        week: 'W2',
        resourceName: 'Karthik',
        projectName: 'MatchGuide',
        module: 'Analytics',
        taskTitle: 'Recruitment Funnel Conversion Analytics',
        taskDescription: 'Track candidate flow through screen, tech interview, culture fit, and offer stages',
        taskType: 'Architecture',
        status: 'In Progress',
        priority: 'Medium',
        size: 'S',
        hours: 8,
        startDate: '2026-10-14',
        dueDate: '2026-10-16',
        completedDate: '',
        progress: 40,
        tags: 'analytics, funnel, metrics, hr',
        comments: 'Dashboard funnel visualization prototype ready for recruiter review',
        isVisible: true,
      },
      {
        taskId: 'T-021',
        week: 'W2',
        resourceName: 'Rohit',
        projectName: 'Dweber',
        module: 'Canvas Studio',
        taskTitle: 'Interactive Grid Snapping & Alignment Guides',
        taskDescription: 'Add magnetic snap guides, multi-element selection, and smart margin indicators',
        taskType: 'Feature',
        status: 'In Progress',
        priority: 'High',
        size: 'M',
        hours: 14,
        startDate: '2026-10-12',
        dueDate: '2026-10-16',
        completedDate: '',
        progress: 55,
        tags: 'canvas, editor, snapping, grid',
        comments: 'Horizontal and vertical guide snapping functioning smoothly',
        isVisible: true,
      },
      {
        taskId: 'T-022',
        week: 'W2',
        resourceName: 'Karina',
        projectName: 'Dweber',
        module: 'Export Engine',
        taskTitle: 'Angular Standalone Component Generator',
        taskDescription: 'Serialize canvas layout into clean, semantic Angular standalone components',
        taskType: 'Feature',
        status: 'Blocked',
        priority: 'Critical',
        size: 'L',
        hours: 10,
        startDate: '2026-10-13',
        dueDate: '2026-10-16',
        completedDate: '',
        progress: 30,
        tags: 'compiler, generator, angular, ast',
        comments: 'Waiting on final AST node specification sign-off from architecture team',
        isVisible: true,
      },
      {
        taskId: 'T-023',
        week: 'W2',
        resourceName: 'Erika',
        projectName: 'Excelendsite',
        module: 'Compliance',
        taskTitle: 'Financial Formula Accuracy Verification',
        taskDescription: 'Verify calculation accuracy of XIRR, MIRR, and NPV against Excel standard',
        taskType: 'Enhancement',
        status: 'Completed',
        priority: 'High',
        size: 'M',
        hours: 16,
        startDate: '2026-10-12',
        dueDate: '2026-10-15',
        completedDate: '2026-10-15',
        progress: 100,
        tags: 'finance, xirr, compliance, audit',
        comments: 'All 150 test formulas matched to 8 decimal places with formal sign-off',
        isVisible: true,
      },

      // ═════════════════════════════════════════════════════════════════════
      // WEEK 3: One Week After (Oct 19, 2026 – Oct 25, 2026) - Upcoming / Planned
      // ═════════════════════════════════════════════════════════════════════
      {
        taskId: 'T-024',
        week: 'W3',
        resourceName: 'Maniraj',
        projectName: 'U2Tools',
        module: 'Analytics',
        taskTitle: 'Interactive SVG Sparklines & Predictive Trends',
        taskDescription: 'Implement cubic spline curves and predictive sprint velocity extrapolations',
        taskType: 'Feature',
        status: 'Pending',
        priority: 'High',
        size: 'M',
        hours: 16,
        startDate: '2026-10-19',
        dueDate: '2026-10-23',
        completedDate: '',
        progress: 0,
        tags: 'svg, sparklines, analytics, velocity',
        comments: 'Planned for Sprint 43 kickoff; wireframes completed',
        isVisible: true,
      },
      {
        taskId: 'T-025',
        week: 'W3',
        resourceName: 'Vamsi',
        projectName: 'U2Tools',
        module: 'DevOps',
        taskTitle: 'Production Automated Rollout & Canary Verification',
        taskDescription: 'Automate blue-green cutover scripts with automatic health rollback hooks',
        taskType: 'Architecture',
        status: 'Pending',
        priority: 'Critical',
        size: 'L',
        hours: 20,
        startDate: '2026-10-19',
        dueDate: '2026-10-23',
        completedDate: '',
        progress: 0,
        tags: 'k8s, canary, automation, rollout',
        comments: 'Scheduled pending final staging sign-off from QA',
        isVisible: true,
      },
      {
        taskId: 'T-026',
        week: 'W3',
        resourceName: 'Priya',
        projectName: 'U2Tools',
        module: 'Testing',
        taskTitle: 'Regression Test Automation & CI Pipeline',
        taskDescription: 'Integrate full end-to-end test suite into GitHub Actions automated PR checks',
        taskType: 'Testing',
        status: 'Pending',
        priority: 'High',
        size: 'M',
        hours: 14,
        startDate: '2026-10-20',
        dueDate: '2026-10-23',
        completedDate: '',
        progress: 0,
        tags: 'ci, github-actions, qa, regression',
        comments: 'Workflow YAML drafts prepared and validated locally',
        isVisible: true,
      },
      {
        taskId: 'T-027',
        week: 'W3',
        resourceName: 'Arun',
        projectName: 'Standup Note',
        module: 'AI Engine',
        taskTitle: 'Multi-Language Audio Transcription & Translation',
        taskDescription: 'Support multilingual standup meetings with automatic language detection and translation',
        taskType: 'Feature',
        status: 'Pending',
        priority: 'High',
        size: 'L',
        hours: 22,
        startDate: '2026-10-19',
        dueDate: '2026-10-23',
        completedDate: '',
        progress: 0,
        tags: 'multilingual, whisper, ai, translation',
        comments: 'Model evaluation underway using Whisper large-v3',
        isVisible: true,
      },
      {
        taskId: 'T-028',
        week: 'W3',
        resourceName: 'Rohit',
        projectName: 'Standup Note',
        module: 'Export Engine',
        taskTitle: 'Automated PDF & Slack Export Integration',
        taskDescription: 'One-click publish meeting notes directly to Slack channels and formatted PDF reports',
        taskType: 'Feature',
        status: 'Pending',
        priority: 'Medium',
        size: 'M',
        hours: 12,
        startDate: '2026-10-19',
        dueDate: '2026-10-22',
        completedDate: '',
        progress: 0,
        tags: 'slack, pdf, export, integrations',
        comments: 'Slack bot OAuth credentials configured and tested',
        isVisible: true,
      },
      {
        taskId: 'T-029',
        week: 'W3',
        resourceName: 'Karina',
        projectName: 'MatchGuide',
        module: 'Integration',
        taskTitle: 'Greenhouse & Lever ATS Integration',
        taskDescription: 'Sync candidate applications and interview feedback with enterprise ATS systems',
        taskType: 'Feature',
        status: 'Pending',
        priority: 'Critical',
        size: 'L',
        hours: 24,
        startDate: '2026-10-19',
        dueDate: '2026-10-23',
        completedDate: '',
        progress: 0,
        tags: 'ats, greenhouse, lever, integration',
        comments: 'Partner sandbox access granted; schema mappings drafted',
        isVisible: true,
      },
      {
        taskId: 'T-030',
        week: 'W3',
        resourceName: 'Karthik',
        projectName: 'S2App ECommerce',
        module: 'Analytics',
        taskTitle: 'Real-Time Inventory & Cart Abandonment Telemetry',
        taskDescription: 'Kafka event stream to track abandoned checkout items and trigger re-engagement workflows',
        taskType: 'Feature',
        status: 'Pending',
        priority: 'High',
        size: 'M',
        hours: 18,
        startDate: '2026-10-19',
        dueDate: '2026-10-23',
        completedDate: '',
        progress: 0,
        tags: 'kafka, telemetry, inventory, abandoned-cart',
        comments: 'Topic partition and schema registry design completed',
        isVisible: true,
      },
      {
        taskId: 'T-031',
        week: 'W3',
        resourceName: 'Bob',
        projectName: 'Excelendsite',
        module: 'Performance',
        taskTitle: 'WebAssembly Acceleration for Formula Calculations',
        taskDescription: 'Compile calculation engine to WASM for 10x faster execution on 1M+ cell financial models',
        taskType: 'Architecture',
        status: 'Pending',
        priority: 'Critical',
        size: 'L',
        hours: 24,
        startDate: '2026-10-19',
        dueDate: '2026-10-23',
        completedDate: '',
        progress: 0,
        tags: 'wasm, rust, performance, formula',
        comments: 'Proof of concept benchmark shows 8.4x speedup over JS engine',
        isVisible: true,
      },
    ],
    releaseTracks: [
      {
        id: 'R-101',
        title: 'U2Tools v2.0 - Suite Release',
        category: 'Core Platform',
        module: 'Work Tracker',
        type: 'Feature',
        priority: 'Critical',
        status: 'Testing',
        prdStatus: 'Approved',
        environment: 'Beta',
        assignedTo: 'Maniraj',
        createdDate: '2026-01-10',
        targetDate: '2026-12-15',
        completedDate: '',
        progress: 75,
        remarks: 'UAT in progress, completing final dashboard integration',
        sourceSheet: 'Projects',
        dependency: 'Auth Engine',
        tags: 'u2tools, dashboard, live',
        isVisible: true,
      },
      {
        id: 'R-102',
        title: 'Standup Note - AI Engine v1.5',
        category: 'AI Assistant',
        module: 'Notes Intelligence',
        type: 'Enhancement',
        priority: 'High',
        status: 'Development',
        prdStatus: 'In Review',
        environment: 'Dev',
        assignedTo: 'Arun',
        createdDate: '2026-03-01',
        targetDate: '2026-11-20',
        completedDate: '',
        progress: 60,
        remarks: 'Gemini streaming operational, refining prompt accuracy',
        sourceSheet: 'Projects',
        dependency: 'Voice Pipeline',
        tags: 'ai, notes, standup',
        isVisible: true,
      },
      {
        id: 'R-103',
        title: 'S2App ECommerce - Production Rollout',
        category: 'E-Commerce',
        module: 'Storefront & Checkout',
        type: 'Feature',
        priority: 'Critical',
        status: 'Released',
        prdStatus: 'Approved',
        environment: 'Production',
        assignedTo: 'Vamsi',
        createdDate: '2026-01-05',
        targetDate: '2026-09-30',
        completedDate: '2026-09-28',
        progress: 100,
        remarks: 'Production live globally with zero downtime',
        sourceSheet: 'Projects',
        dependency: 'Stripe Gateway',
        tags: 'ecommerce, production, live',
        isVisible: true,
      },
      {
        id: 'R-104',
        title: 'MatchGuide - Candidate Engine v1.0',
        category: 'HR Tech',
        module: 'Matching Algorithm',
        type: 'Feature',
        priority: 'High',
        status: 'Staging',
        prdStatus: 'Approved',
        environment: 'Alpha',
        assignedTo: 'Karina',
        createdDate: '2026-02-15',
        targetDate: '2026-10-25',
        completedDate: '',
        progress: 85,
        remarks: 'Testing complete, deploying staging release',
        sourceSheet: 'Projects',
        dependency: 'Vector DB',
        tags: 'matching, hr, staging',
        isVisible: true,
      },
      {
        id: 'R-105',
        title: 'Dweber - Core Studio Beta',
        category: 'Web Studio',
        module: 'Canvas Studio',
        type: 'Enhancement',
        priority: 'Medium',
        status: 'Development',
        prdStatus: 'Draft',
        environment: 'Dev',
        assignedTo: 'Rohit',
        createdDate: '2026-04-01',
        targetDate: '2026-12-30',
        completedDate: '',
        progress: 40,
        remarks: 'Drag-and-drop snapping finished, working on code generator',
        sourceSheet: 'Projects',
        dependency: 'AST Compiler',
        tags: 'studio, canvas, beta',
        isVisible: true,
      },
      {
        id: 'R-106',
        title: 'Excelendsite - Data Analytics Suite',
        category: 'Data Analytics',
        module: 'Excel Parser',
        type: 'Feature',
        priority: 'Critical',
        status: 'Released',
        prdStatus: 'Approved',
        environment: 'Production',
        assignedTo: 'Vamsi',
        createdDate: '2026-05-01',
        targetDate: '2026-08-15',
        completedDate: '2026-08-12',
        progress: 100,
        remarks: 'Production live, handling large-scale Excel streaming',
        sourceSheet: 'Projects',
        dependency: 'Web Worker Pool',
        tags: 'excel, analytics, live',
        isVisible: true,
      },
    ],
    hourlyUpdates: [
      {
        id: 'HU-001',
        date: '2026-10-15',
        hour: '09:00',
        taskDescription: 'Daily standup & team task allocation for W2 sprint',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-002',
        date: '2026-10-15',
        hour: '10:00',
        taskDescription: 'Work Tracker dashboard data integration and RxJS stream review',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-003',
        date: '2026-10-15',
        hour: '11:00',
        taskDescription: 'Connecting dynamic KPI metric calculations and project filters',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-004',
        date: '2026-10-15',
        hour: '12:00',
        taskDescription: 'Project status overview table data binding with real progress values',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-005',
        date: '2026-10-15',
        hour: '14:00',
        taskDescription: 'Gantt chart timeline roadmap computation across 12 month span',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-006',
        date: '2026-10-15',
        hour: '15:00',
        taskDescription: 'Team Work Summary aggregation by developer, role and tasks worked',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-007',
        date: '2026-10-15',
        hour: '16:00',
        taskDescription: 'Work analytics 6 sub-charts integration (weekly, project, team hours)',
        status: 'In Progress',
        isVisible: true,
      },
      {
        id: 'HU-008',
        date: '2026-10-15',
        hour: '17:00',
        taskDescription: 'Responsive mobile layout verification and dark/JARVIS mode audit',
        status: 'Pending',
        isVisible: true,
      },
      {
        id: 'HU-009',
        date: '2026-10-14',
        hour: '09:30',
        taskDescription: 'Standup Note voice transcription model latency profiling',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-010',
        date: '2026-10-14',
        hour: '11:30',
        taskDescription: 'Firebase Firestore push/pull synchronization regression tests',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-011',
        date: '2026-10-14',
        hour: '14:30',
        taskDescription: 'E2E automated Playwright tests for Excel import and export',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-012',
        date: '2026-10-14',
        hour: '16:30',
        taskDescription: 'Candidate matching algorithm accuracy benchmarks and vector search',
        status: 'Completed',
        isVisible: true,
      },
    ],
    storageMode: 'local',
  };

  private dataSubject = new BehaviorSubject<WorkTrackerData>(this.initialState);
  public data$: Observable<WorkTrackerData> = this.dataSubject.asObservable();

  constructor() {
    // Auto-load from Firestore when signed in
    this.syncService.onAuthChange((uid) => {
      if (uid) {
        this.loadFromFirestore();
      } else {
        this.resetState();
      }
    });
  }

  private resetState() {
    this.dataSubject.next(this.initialState);
  }

  updateData(newData: Partial<WorkTrackerData>) {
    this.dataSubject.next({ ...this.dataSubject.value, ...newData });
    this.syncToFirestore();
  }

  addDeveloperTask(task: Omit<DeveloperTask, 'taskId'> & { taskId?: string }) {
    const developerTasks = [
      ...this.dataSubject.value.developerTasks,
      {
        ...task,
        taskId:
          task.taskId?.trim() ||
          this.createId('T', this.dataSubject.value.developerTasks.length + 1),
        isVisible: task.isVisible ?? true,
      },
    ];
    this.updateData({ developerTasks });
  }

  updateDeveloperTask(taskId: string, changes: Partial<DeveloperTask>) {
    const developerTasks = this.dataSubject.value.developerTasks.map((task) =>
      task.taskId === taskId ? { ...task, ...changes, taskId } : task,
    );
    this.updateData({ developerTasks });
  }

  deleteDeveloperTask(taskId: string) {
    const developerTasks = this.dataSubject.value.developerTasks.filter(
      (task) => task.taskId !== taskId,
    );
    this.updateData({ developerTasks });
  }

  toggleDeveloperTaskVisibility(taskId: string) {
    const developerTasks = this.dataSubject.value.developerTasks.map((task) =>
      task.taskId === taskId ? { ...task, isVisible: !(task.isVisible ?? true) } : task,
    );
    this.updateData({ developerTasks });
  }

  addReleaseTrack(track: Omit<ReleaseTrack, 'id'> & { id?: string }) {
    const releaseTracks = [
      ...this.dataSubject.value.releaseTracks,
      {
        ...track,
        id:
          track.id?.trim() || this.createId('R', this.dataSubject.value.releaseTracks.length + 100),
        isVisible: track.isVisible ?? true,
      },
    ];
    this.updateData({ releaseTracks });
  }

  updateReleaseTrack(id: string, changes: Partial<ReleaseTrack>) {
    const releaseTracks = this.dataSubject.value.releaseTracks.map((track) =>
      track.id === id ? { ...track, ...changes, id } : track,
    );
    this.updateData({ releaseTracks });
  }

  deleteReleaseTrack(id: string) {
    const releaseTracks = this.dataSubject.value.releaseTracks.filter((track) => track.id !== id);
    this.updateData({ releaseTracks });
  }

  toggleReleaseTrackVisibility(id: string) {
    const releaseTracks = this.dataSubject.value.releaseTracks.map((track) =>
      track.id === id ? { ...track, isVisible: !(track.isVisible ?? true) } : track,
    );
    this.updateData({ releaseTracks });
  }

  addHourlyUpdate(update: Omit<HourlyWorkUpdate, 'id'> & { id?: string }) {
    const hourlyUpdates = [
      ...this.dataSubject.value.hourlyUpdates,
      {
        ...update,
        id:
          update.id?.trim() || this.createId('HU', this.dataSubject.value.hourlyUpdates.length + 1),
        isVisible: update.isVisible ?? true,
      },
    ];
    this.updateData({ hourlyUpdates });
  }

  updateHourlyUpdate(id: string, changes: Partial<HourlyWorkUpdate>) {
    const hourlyUpdates = this.dataSubject.value.hourlyUpdates.map((update) =>
      update.id === id ? { ...update, ...changes, id } : update,
    );
    this.updateData({ hourlyUpdates });
  }

  deleteHourlyUpdate(id: string) {
    const hourlyUpdates = this.dataSubject.value.hourlyUpdates.filter((update) => update.id !== id);
    this.updateData({ hourlyUpdates });
  }

  toggleHourlyUpdateVisibility(id: string) {
    const hourlyUpdates = this.dataSubject.value.hourlyUpdates.map((update) =>
      update.id === id ? { ...update, isVisible: !(update.isVisible ?? true) } : update,
    );
    this.updateData({ hourlyUpdates });
  }

  setStorageMode(mode: 'local' | 'google-sheets') {
    this.updateData({ storageMode: mode });
  }

  processLocalUpload(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          // Parse Developer Tasks
          const devSheetName = workbook.SheetNames[0];
          const devWorksheet = workbook.Sheets[devSheetName];
          const devData: any[] = XLSX.utils.sheet_to_json(devWorksheet);

          const developerTasks: DeveloperTask[] = devData.map((row) => ({
            taskId: row['Task_ID'] || '',
            week: row['Week'] || '',
            resourceName: row['Resource_Name'] || '',
            projectName: row['Project_Name'] || '',
            module: row['Module'] || '',
            taskTitle: row['Task_Title'] || '',
            taskDescription: row['Task_Description'] || '',
            taskType: row['Task_Type'] || '',
            status: row['Status'] || 'Unknown',
            priority: row['Priority'] || '',
            size: row['Size'] || '',
            hours: Number(row['Hours']) || (row['Size'] === 'L' ? 12 : row['Size'] === 'S' ? 4 : 8),
            startDate: row['Start_Date'] || '',
            dueDate: row['Due_Date'] || '',
            completedDate: row['Completed_Date'] || '',
            progress: Number(row['Progress_%']) || 0,
            tags: row['Tags'] || '',
            comments: row['Comments'] || '',
            isVisible:
              row['Visible'] === undefined
                ? true
                : String(row['Visible']).toLowerCase() !== 'false',
          }));

          // Parse Release Track
          let releaseTracks = this.dataSubject.value.releaseTracks;
          if (workbook.SheetNames.length > 1) {
            const releaseSheetName = workbook.SheetNames[1];
            const releaseWorksheet = workbook.Sheets[releaseSheetName];
            const releaseData: any[] = XLSX.utils.sheet_to_json(releaseWorksheet);

            releaseTracks = releaseData.map((row) => ({
              id: row['ID'] || '',
              title: row['Title'] || '',
              category: row['Category'] || '',
              module: row['Module'] || '',
              type: row['Type'] || '',
              priority: row['Priority'] || '',
              status: row['Status'] || 'Development',
              prdStatus: row['PRD Status'] || '',
              environment: row['Environment'] || row['Current Environment'] || 'Dev',
              assignedTo: row['Assigned To'] || '',
              createdDate: row['Created Date'] || '',
              targetDate: row['Target Date'] || '',
              completedDate: row['Completed Date'] || '',
              progress: Number(row['Progress %']) || 0,
              remarks: row['Remarks'] || '',
              sourceSheet: row['Source Sheet'] || '',
              dependency: row['Dependency'] || '',
              tags: row['Tags'] || '',
              isVisible:
                row['Visible'] === undefined
                  ? true
                  : String(row['Visible']).toLowerCase() !== 'false',
            }));
          }

          let hourlyUpdates = this.dataSubject.value.hourlyUpdates;
          if (workbook.SheetNames.length > 2) {
            const hourlySheetName = workbook.SheetNames[2];
            const hourlyWorksheet = workbook.Sheets[hourlySheetName];
            const hourlyData: any[] = XLSX.utils.sheet_to_json(hourlyWorksheet);

            hourlyUpdates = hourlyData.map((row, index) => ({
              id: row['ID'] || this.createId('HU', index + 1),
              date: row['Date'] || '',
              hour: row['Hour'] || '',
              taskDescription: row['Task Description'] || '',
              status: row['Status'] || 'Pending',
              isVisible:
                row['Visible'] === undefined
                  ? true
                  : String(row['Visible']).toLowerCase() !== 'false',
            }));
          }

          this.updateData({ developerTasks, releaseTracks, hourlyUpdates });
          // Sync to Firestore after Excel import
          this.syncToFirestore();
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  downloadTemplate(): void {
    const currentData = this.dataSubject.value;

    // Create Developer Tasks Sheet
    const devSheetData = currentData.developerTasks.map((task) => ({
      Task_ID: task.taskId,
      Week: task.week,
      Resource_Name: task.resourceName,
      Project_Name: task.projectName,
      Module: task.module,
      Task_Title: task.taskTitle,
      Task_Description: task.taskDescription,
      Task_Type: task.taskType,
      Status: task.status,
      Priority: task.priority,
      Size: task.size,
      Hours: task.hours ?? (task.size === 'L' ? 12 : task.size === 'S' ? 4 : 8),
      Start_Date: task.startDate,
      Due_Date: task.dueDate,
      Completed_Date: task.completedDate,
      'Progress_%': task.progress,
      Tags: task.tags,
      Comments: task.comments,
      Visible: task.isVisible ?? true,
    }));
    const devWs = XLSX.utils.json_to_sheet(devSheetData);

    // Create Release Sheet
    const releaseSheetData = currentData.releaseTracks.map((track) => ({
      ID: track.id,
      Title: track.title,
      Category: track.category,
      Module: track.module,
      Type: track.type,
      Priority: track.priority,
      Status: track.status,
      'PRD Status': track.prdStatus,
      Environment: track.environment || 'Dev',
      'Assigned To': track.assignedTo,
      'Created Date': track.createdDate,
      'Target Date': track.targetDate,
      'Completed Date': track.completedDate,
      'Progress %': track.progress,
      Remarks: track.remarks,
      'Source Sheet': track.sourceSheet,
      Dependency: track.dependency,
      Tags: track.tags,
      Visible: track.isVisible ?? true,
    }));
    const releaseWs = XLSX.utils.json_to_sheet(releaseSheetData);

    const hourlySheetData = currentData.hourlyUpdates.map((update) => ({
      ID: update.id,
      Date: update.date,
      Hour: update.hour,
      'Task Description': update.taskDescription,
      Status: update.status,
      Visible: update.isVisible ?? true,
    }));
    const hourlyWs = XLSX.utils.json_to_sheet(hourlySheetData);

    // Build Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, devWs, 'Developer Tasks');
    XLSX.utils.book_append_sheet(wb, releaseWs, 'Releases');
    XLSX.utils.book_append_sheet(wb, hourlyWs, 'Hourly Updates');

    // Save
    XLSX.writeFile(wb, 'WorkTracker_Template.xlsx');
  }

  exportExcel(): void {
    this.downloadTemplate();
  }

  async importExcel(file: File): Promise<void> {
    return this.processLocalUpload(file);
  }

  private createId(prefix: string, seed: number): string {
    const existingIds = new Set([
      ...this.dataSubject.value.developerTasks.map((task) => task.taskId),
      ...this.dataSubject.value.releaseTracks.map((track) => track.id),
      ...this.dataSubject.value.hourlyUpdates.map((update) => update.id),
    ]);
    let next = seed;
    let candidate = `${prefix}-${String(next).padStart(3, '0')}`;
    while (existingIds.has(candidate)) {
      next++;
      candidate = `${prefix}-${String(next).padStart(3, '0')}`;
    }
    return candidate;
  }

  // --- Firestore Sync ---
  private async syncToFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    const data = this.dataSubject.value;
    await Promise.all([
      this.syncService.pushToFirestore(
        APP_NAME,
        'developerTasks',
        data.developerTasks as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'releaseTracks',
        data.releaseTracks as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'hourlyUpdates',
        data.hourlyUpdates as unknown as Record<string, unknown>[],
      ),
    ]);
  }

  async loadFromFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    try {
      const developerTasks = await this.syncService.pullFromFirestore<DeveloperTask>(
        APP_NAME,
        'developerTasks',
      );
      const releaseTracks = await this.syncService.pullFromFirestore<ReleaseTrack>(
        APP_NAME,
        'releaseTracks',
      );
      const hourlyUpdates = await this.syncService.pullFromFirestore<HourlyWorkUpdate>(
        APP_NAME,
        'hourlyUpdates',
      );

      if (developerTasks.length > 0 || releaseTracks.length > 0 || hourlyUpdates.length > 0) {
        this.dataSubject.next({
          ...this.dataSubject.value,
          developerTasks:
            developerTasks.length > 0 ? developerTasks : this.dataSubject.value.developerTasks,
          releaseTracks:
            releaseTracks.length > 0 ? releaseTracks : this.dataSubject.value.releaseTracks,
          hourlyUpdates:
            hourlyUpdates.length > 0 ? hourlyUpdates : this.dataSubject.value.hourlyUpdates,
        });
      }
    } catch (e) {
      console.error('WorkTrackerService: failed to load from Firestore', e);
    }
  }

  async syncAllToFirestore(): Promise<void> {
    await this.syncToFirestore();
  }
}
