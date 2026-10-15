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
      // U2Tools
      {
        taskId: 'T-001',
        week: 'W6',
        resourceName: 'Maniraj',
        projectName: 'U2Tools',
        module: 'Work Tracker',
        taskTitle: 'Integrate Live Dashboard Telemetry',
        taskDescription: 'Connect dashboard KPI metrics, roadmap and analytics to live service data',
        taskType: 'Feature',
        status: 'In Progress',
        priority: 'Critical',
        size: 'M',
        hours: 16,
        startDate: '2025-10-06',
        dueDate: '2025-10-12',
        completedDate: '',
        progress: 80,
        tags: 'frontend, dashboard, angular',
        comments: 'Connecting observables and filters',
        isVisible: true,
      },
      {
        taskId: 'T-002',
        week: 'W6',
        resourceName: 'Maniraj',
        projectName: 'U2Tools',
        module: 'UI Framework',
        taskTitle: 'Responsive Sidebar & HUD Polish',
        taskDescription: 'Optimize mobile hamburger drawer and collapsible navigation styles',
        taskType: 'Enhancement',
        status: 'Completed',
        priority: 'High',
        size: 'S',
        hours: 8,
        startDate: '2025-10-06',
        dueDate: '2025-10-09',
        completedDate: '2025-10-09',
        progress: 100,
        tags: 'frontend, ui, responsive',
        comments: 'Tested on mobile and tablet viewport',
        isVisible: true,
      },
      {
        taskId: 'T-003',
        week: 'W5',
        resourceName: 'Maniraj',
        projectName: 'U2Tools',
        module: 'Data Sync',
        taskTitle: 'Firebase Realtime Cloud Sync',
        taskDescription: 'Implement push/pull sync with Firestore security rules',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 24,
        startDate: '2025-09-29',
        dueDate: '2025-10-03',
        completedDate: '2025-10-03',
        progress: 100,
        tags: 'firebase, sync, backend',
        comments: 'Fully functional with auto-retry',
        isVisible: true,
      },
      {
        taskId: 'T-004',
        week: 'W6',
        resourceName: 'Vamsi',
        projectName: 'U2Tools',
        module: 'Architecture',
        taskTitle: 'Micro-Frontend Modular Federation',
        taskDescription: 'Refactor standalone components to share core services',
        taskType: 'Architecture',
        status: 'In Progress',
        priority: 'Critical',
        size: 'L',
        hours: 20,
        startDate: '2025-10-06',
        dueDate: '2025-10-14',
        completedDate: '',
        progress: 70,
        tags: 'architecture, core',
        comments: 'Refactoring state management',
        isVisible: true,
      },
      {
        taskId: 'T-005',
        week: 'W6',
        resourceName: 'Priya',
        projectName: 'U2Tools',
        module: 'Testing',
        taskTitle: 'E2E Testing Suite for Work Tracker',
        taskDescription: 'Automate Playwright tests for task CRUD and Excel import/export',
        taskType: 'Testing',
        status: 'In Progress',
        priority: 'High',
        size: 'M',
        hours: 14,
        startDate: '2025-10-07',
        dueDate: '2025-10-12',
        completedDate: '',
        progress: 75,
        tags: 'testing, e2e, playwright',
        comments: '12 test cases written, 3 in progress',
        isVisible: true,
      },

      // Standup Note
      {
        taskId: 'T-006',
        week: 'W6',
        resourceName: 'Arun',
        projectName: 'Standup Note',
        module: 'AI Engine',
        taskTitle: 'Gemini 2.5 Flash Integration',
        taskDescription: 'Stream executive meeting notes and action items in real-time',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'Critical',
        size: 'M',
        hours: 16,
        startDate: '2025-10-06',
        dueDate: '2025-10-10',
        completedDate: '2025-10-10',
        progress: 100,
        tags: 'ai, gemini, backend',
        comments: 'Streaming tokens working with sub-second latency',
        isVisible: true,
      },
      {
        taskId: 'T-007',
        week: 'W5',
        resourceName: 'Arun',
        projectName: 'Standup Note',
        module: 'Audio Pipeline',
        taskTitle: 'Voice-to-Text Transcription Service',
        taskDescription: 'Web Speech API fallback with backend whisper model',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'High',
        size: 'M',
        hours: 18,
        startDate: '2025-09-29',
        dueDate: '2025-10-04',
        completedDate: '2025-10-04',
        progress: 100,
        tags: 'voice, transcription, backend',
        comments: 'Noise filtering configured',
        isVisible: true,
      },
      {
        taskId: 'T-008',
        week: 'W6',
        resourceName: 'Rohit',
        projectName: 'Standup Note',
        module: 'Editor',
        taskTitle: 'Rich Text Markdown Editor Enhancements',
        taskDescription: 'Add slash commands, syntax highlighting, and PDF export',
        taskType: 'Enhancement',
        status: 'In Progress',
        priority: 'Medium',
        size: 'M',
        hours: 12,
        startDate: '2025-10-07',
        dueDate: '2025-10-13',
        completedDate: '',
        progress: 60,
        tags: 'frontend, editor, ui',
        comments: 'PDF export preview in testing',
        isVisible: true,
      },

      // S2App ECommerce
      {
        taskId: 'T-009',
        week: 'W4',
        resourceName: 'Arun',
        projectName: 'S2App ECommerce',
        module: 'Checkout',
        taskTitle: 'Stripe & PayPal Multi-Gateway Integration',
        taskDescription: 'Complete PCI compliant tokenization and webhooks',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 24,
        startDate: '2025-09-15',
        dueDate: '2025-09-22',
        completedDate: '2025-09-21',
        progress: 100,
        tags: 'payments, billing, backend',
        comments: 'Passed security audit',
        isVisible: true,
      },
      {
        taskId: 'T-010',
        week: 'W4',
        resourceName: 'Maniraj',
        projectName: 'S2App ECommerce',
        module: 'Storefront',
        taskTitle: 'Product Catalog & Advanced Filters',
        taskDescription: 'Faceted search by size, brand, price and instant filter pills',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'High',
        size: 'M',
        hours: 16,
        startDate: '2025-09-15',
        dueDate: '2025-09-20',
        completedDate: '2025-09-19',
        progress: 100,
        tags: 'storefront, search, ui',
        comments: 'Sub-50ms search render time',
        isVisible: true,
      },
      {
        taskId: 'T-011',
        week: 'W5',
        resourceName: 'Bob',
        projectName: 'S2App ECommerce',
        module: 'Testing',
        taskTitle: 'Load & Stress Testing for Black Friday',
        taskDescription: 'Simulate 10,000 concurrent cart updates and checkout requests',
        taskType: 'Testing',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 20,
        startDate: '2025-09-22',
        dueDate: '2025-09-29',
        completedDate: '2025-09-28',
        progress: 100,
        tags: 'performance, testing',
        comments: 'Zero packet loss observed at peak load',
        isVisible: true,
      },

      // MatchGuide
      {
        taskId: 'T-012',
        week: 'W6',
        resourceName: 'Karina',
        projectName: 'MatchGuide',
        module: 'Matching Engine',
        taskTitle: 'Vector Similarity Candidate Matching',
        taskDescription: 'Generate embeddings for resumes and match against job requisitions',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 22,
        startDate: '2025-10-01',
        dueDate: '2025-10-08',
        completedDate: '2025-10-07',
        progress: 100,
        tags: 'ai, vector, python',
        comments: 'Cosine similarity precision 94.2%',
        isVisible: true,
      },
      {
        taskId: 'T-013',
        week: 'W6',
        resourceName: 'Priya',
        projectName: 'MatchGuide',
        module: 'Testing',
        taskTitle: 'Candidate Assessment Flow QA',
        taskDescription: 'Verify end-to-end recruiter interview scheduling and grading rubric',
        taskType: 'Testing',
        status: 'Completed',
        priority: 'High',
        size: 'S',
        hours: 10,
        startDate: '2025-10-07',
        dueDate: '2025-10-11',
        completedDate: '2025-10-10',
        progress: 100,
        tags: 'qa, assessment',
        comments: 'All test matrices verified and passed',
        isVisible: true,
      },
      {
        taskId: 'T-014',
        week: 'W6',
        resourceName: 'Karthik',
        projectName: 'MatchGuide',
        module: 'Product Analytics',
        taskTitle: 'Recruiter Funnel Drop-off Analysis',
        taskDescription: 'Track candidate conversion rate from interview to offer stage',
        taskType: 'Architecture',
        status: 'In Progress',
        priority: 'Medium',
        size: 'M',
        hours: 8,
        startDate: '2025-10-08',
        dueDate: '2025-10-15',
        completedDate: '',
        progress: 30,
        tags: 'analytics, paba',
        comments: 'Gathering feedback from beta recruiters',
        isVisible: true,
      },

      // Dweber
      {
        taskId: 'T-015',
        week: 'W6',
        resourceName: 'Rohit',
        projectName: 'Dweber',
        module: 'Canvas Studio',
        taskTitle: 'Drag-and-Drop Component Canvas',
        taskDescription: 'Implement interactive grid snapping and alignment guides',
        taskType: 'Feature',
        status: 'In Progress',
        priority: 'High',
        size: 'L',
        hours: 14,
        startDate: '2025-10-06',
        dueDate: '2025-10-18',
        completedDate: '',
        progress: 40,
        tags: 'canvas, ui, editor',
        comments: 'Snapping engine operational',
        isVisible: true,
      },
      {
        taskId: 'T-016',
        week: 'W6',
        resourceName: 'Karina',
        projectName: 'Dweber',
        module: 'Export Engine',
        taskTitle: 'Code Export to Clean Angular & Tailwind',
        taskDescription: 'Generate production-ready standalone Angular components from canvas DOM',
        taskType: 'Feature',
        status: 'Blocked',
        priority: 'Critical',
        size: 'L',
        hours: 6,
        startDate: '2025-10-07',
        dueDate: '2025-10-16',
        completedDate: '',
        progress: 25,
        tags: 'compiler, export, backend',
        comments: 'Blocked waiting on AST node spec finalization',
        isVisible: true,
      },

      // Excelendsite
      {
        taskId: 'T-017',
        week: 'W3',
        resourceName: 'Vamsi',
        projectName: 'Excelendsite',
        module: 'Core Parser',
        taskTitle: 'High-Speed Web Worker XLSX Streaming',
        taskDescription: 'Parse 500k row Excel workbooks in background web worker without UI lag',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 24,
        startDate: '2025-08-01',
        dueDate: '2025-08-10',
        completedDate: '2025-08-09',
        progress: 100,
        tags: 'web-worker, performance, excel',
        comments: 'Benchmarks show 4.2x speedup',
        isVisible: true,
      },
      {
        taskId: 'T-018',
        week: 'W3',
        resourceName: 'Erika',
        projectName: 'Excelendsite',
        module: 'Compliance',
        taskTitle: 'Financial Formula Validation (XIRR, NPV)',
        taskDescription: 'Verify calculation exactness against standard Excel specification',
        taskType: 'Enhancement',
        status: 'Completed',
        priority: 'High',
        size: 'M',
        hours: 16,
        startDate: '2025-08-05',
        dueDate: '2025-08-14',
        completedDate: '2025-08-12',
        progress: 100,
        tags: 'paba, finance, compliance',
        comments: 'Sign-off received from financial auditing team',
        isVisible: true,
      },

      // Historical Weeks (W1 to W5)
      {
        taskId: 'T-019',
        week: 'W1',
        resourceName: 'Maniraj',
        projectName: 'U2Tools',
        module: 'Core Layout',
        taskTitle: 'App Shell Design System Tokens',
        taskDescription: 'Setup HSL color palettes, typography and dark/light/JARVIS themes',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'High',
        size: 'M',
        hours: 16,
        startDate: '2025-09-01',
        dueDate: '2025-09-06',
        completedDate: '2025-09-05',
        progress: 100,
        tags: 'tokens, theme, ui',
        comments: 'Design system approved',
        isVisible: true,
      },
      {
        taskId: 'T-020',
        week: 'W1',
        resourceName: 'Arun',
        projectName: 'Standup Note',
        module: 'Database',
        taskTitle: 'Schema Migration & Vector Indexing',
        taskDescription: 'Setup PostgreSQL pgvector table indexing for notes embeddings',
        taskType: 'Architecture',
        status: 'Completed',
        priority: 'Critical',
        size: 'M',
        hours: 20,
        startDate: '2025-09-01',
        dueDate: '2025-09-07',
        completedDate: '2025-09-06',
        progress: 100,
        tags: 'database, sql, vector',
        comments: 'Zero migration downtime',
        isVisible: true,
      },
      {
        taskId: 'T-021',
        week: 'W2',
        resourceName: 'Vamsi',
        projectName: 'S2App ECommerce',
        module: 'DevOps',
        taskTitle: 'Kubernetes Multi-Cluster Deployment',
        taskDescription: 'Helm charts and ArgoCD automated canary deployments',
        taskType: 'Architecture',
        status: 'Completed',
        priority: 'Critical',
        size: 'L',
        hours: 28,
        startDate: '2025-09-08',
        dueDate: '2025-09-14',
        completedDate: '2025-09-13',
        progress: 100,
        tags: 'k8s, devops, cloud',
        comments: 'Clusters deployed in US-East and EU-Central',
        isVisible: true,
      },
      {
        taskId: 'T-022',
        week: 'W2',
        resourceName: 'Priya',
        projectName: 'S2App ECommerce',
        module: 'Testing',
        taskTitle: 'Security Penetration Testing',
        taskDescription: 'OWASP Top 10 vulnerability assessment on payment endpoints',
        taskType: 'Testing',
        status: 'Completed',
        priority: 'Critical',
        size: 'M',
        hours: 16,
        startDate: '2025-09-08',
        dueDate: '2025-09-14',
        completedDate: '2025-09-13',
        progress: 100,
        tags: 'security, audit, qa',
        comments: 'Zero vulnerabilities reported',
        isVisible: true,
      },
      {
        taskId: 'T-023',
        week: 'W3',
        resourceName: 'Karthik',
        projectName: 'U2Tools',
        module: 'Requirements',
        taskTitle: 'Work Tracker Functional Specification',
        taskDescription: 'User stories, acceptance criteria and wireframes for task boards',
        taskType: 'Architecture',
        status: 'Completed',
        priority: 'Medium',
        size: 'M',
        hours: 18,
        startDate: '2025-09-15',
        dueDate: '2025-09-20',
        completedDate: '2025-09-19',
        progress: 100,
        tags: 'paba, specs',
        comments: 'Product sign-off completed',
        isVisible: true,
      },
      {
        taskId: 'T-024',
        week: 'W4',
        resourceName: 'Karina',
        projectName: 'MatchGuide',
        module: 'Auth',
        taskTitle: 'LinkedIn & SSO OAuth Integration',
        taskDescription: 'Recruiter corporate login with enterprise SSO SAML',
        taskType: 'Feature',
        status: 'Completed',
        priority: 'High',
        size: 'M',
        hours: 16,
        startDate: '2025-09-22',
        dueDate: '2025-09-27',
        completedDate: '2025-09-26',
        progress: 100,
        tags: 'auth, sso, backend',
        comments: 'Okta and Azure AD tested',
        isVisible: true,
      },
      {
        taskId: 'T-025',
        week: 'W5',
        resourceName: 'Erika',
        projectName: 'Standup Note',
        module: 'Analytics',
        taskTitle: 'Meeting Sentiment & Keyword Metrics',
        taskDescription: 'Analyze standup duration trends and frequent technical blockers',
        taskType: 'Feature',
        status: 'In Progress',
        priority: 'Medium',
        size: 'S',
        hours: 10,
        startDate: '2025-09-29',
        dueDate: '2025-10-06',
        completedDate: '',
        progress: 30,
        tags: 'analytics, paba',
        comments: 'Model prompt calibration ongoing',
        isVisible: true,
      },
      {
        taskId: 'T-026',
        week: 'W5',
        resourceName: 'Bob',
        projectName: 'MatchGuide',
        module: 'Testing',
        taskTitle: 'Resume Parsing Edge Cases Test Suite',
        taskDescription: 'Test multi-column PDFs, image OCR and LaTeX formatted resumes',
        taskType: 'Testing',
        status: 'Completed',
        priority: 'High',
        size: 'M',
        hours: 18,
        startDate: '2025-09-29',
        dueDate: '2025-10-05',
        completedDate: '2025-10-04',
        progress: 100,
        tags: 'testing, automation',
        comments: '99.1% parsing fidelity on 500 sample resumes',
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
        createdDate: '2025-01-10',
        targetDate: '2025-12-15',
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
        createdDate: '2025-03-01',
        targetDate: '2025-11-20',
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
        createdDate: '2025-01-05',
        targetDate: '2025-09-30',
        completedDate: '2025-09-28',
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
        createdDate: '2025-02-15',
        targetDate: '2025-10-25',
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
        createdDate: '2025-04-01',
        targetDate: '2025-12-30',
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
        createdDate: '2025-05-01',
        targetDate: '2025-08-15',
        completedDate: '2025-08-12',
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
        date: '2025-10-10',
        hour: '09:00',
        taskDescription: 'Daily standup & team task allocation for W6 sprint',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-002',
        date: '2025-10-10',
        hour: '10:00',
        taskDescription: 'Work Tracker dashboard data integration and RxJS stream review',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-003',
        date: '2025-10-10',
        hour: '11:00',
        taskDescription: 'Connecting dynamic KPI metric calculations and project filters',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-004',
        date: '2025-10-10',
        hour: '12:00',
        taskDescription: 'Project status overview table data binding with real progress values',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-005',
        date: '2025-10-10',
        hour: '14:00',
        taskDescription: 'Gantt chart timeline roadmap computation across 12 month span',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-006',
        date: '2025-10-10',
        hour: '15:00',
        taskDescription: 'Team Work Summary aggregation by developer, role and tasks worked',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-007',
        date: '2025-10-10',
        hour: '16:00',
        taskDescription: 'Work analytics 6 sub-charts integration (weekly, project, team hours)',
        status: 'In Progress',
        isVisible: true,
      },
      {
        id: 'HU-008',
        date: '2025-10-10',
        hour: '17:00',
        taskDescription: 'Responsive mobile layout verification and dark/JARVIS mode audit',
        status: 'Pending',
        isVisible: true,
      },
      {
        id: 'HU-009',
        date: '2025-10-09',
        hour: '09:30',
        taskDescription: 'Standup Note voice transcription model latency profiling',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-010',
        date: '2025-10-09',
        hour: '11:30',
        taskDescription: 'Firebase Firestore push/pull synchronization regression tests',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-011',
        date: '2025-10-09',
        hour: '14:30',
        taskDescription: 'E2E automated Playwright tests for Excel import and export',
        status: 'Completed',
        isVisible: true,
      },
      {
        id: 'HU-012',
        date: '2025-10-09',
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
