import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import {
  AuditEntry,
  DataType,
  ExcelMapperService,
  MappingRule,
  OperationType,
  ParsedWorkbook,
  ProcessedWorkbook,
  SavedMappingTemplate,
  ValidationType,
} from './excel-mapper.service';

type StepKey = 'upload' | 'mapping' | 'transformations' | 'preview' | 'export';

@Component({
  selector: 'app-excel-mapper',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './excel-mapper.component.html',
  styleUrl: './excel-mapper.component.scss',
})
export class ExcelMapperComponent implements OnInit {
  private readonly mapperService = inject(ExcelMapperService);
  readonly supabaseService = inject(SupabaseService);

  readonly steps: { key: StepKey; label: string }[] = [
    { key: 'upload', label: 'Upload File' },
    { key: 'mapping', label: 'Map Columns' },
    { key: 'transformations', label: 'Apply Transformations' },
    { key: 'preview', label: 'Preview' },
    { key: 'export', label: 'Export' },
  ];

  readonly operationTypes: { value: OperationType; label: string }[] = [
    { value: 'trim', label: 'Trim' },
    { value: 'uppercase', label: 'Uppercase' },
    { value: 'lowercase', label: 'Lowercase' },
    { value: 'concat', label: 'Concat' },
    { value: 'math', label: 'Math' },
    { value: 'dateFormat', label: 'Date Format' },
    { value: 'ifElse', label: 'If / Else' },
    { value: 'customTemplate', label: 'Custom Expression' },
  ];

  readonly validationTypes: { value: ValidationType; label: string }[] = [
    { value: 'regex', label: 'Regex' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
  ];

  readonly dataTypes: DataType[] = ['string', 'number', 'date', 'boolean'];

  currentStep = 0;
  sourceSheet: ParsedWorkbook | null = null;
  templateSheet: ParsedWorkbook | null = null;
  mappingRules: MappingRule[] = [];
  sourceFileIssues: string[] = [];
  templateFileIssues: string[] = [];
  globalWarnings: string[] = [];
  result: ProcessedWorkbook | null = null;
  processing = false;
  processingProgress = 0;
  processingLabel = 'Waiting for files';
  templateName = '';
  newTargetColumn = '';
  savedTemplates: SavedMappingTemplate[] = [];
  auditEntries: AuditEntry[] = [];

  ngOnInit(): void {
    this.savedTemplates = this.mapperService.loadTemplates();
    this.auditEntries = this.mapperService.getAuditEntries();
  }

  get actorName(): string {
    return (
      this.supabaseService.user()?.email ||
      this.supabaseService.user()?.user_metadata?.['full_name'] ||
      'Anonymous User'
    );
  }

  get targetColumns(): string[] {
    return this.mappingRules.map((rule) => rule.targetColumn);
  }

  get canPreview(): boolean {
    return !!this.sourceSheet && this.mappingRules.some((rule) => rule.sourceColumns.length > 0);
  }

  get previewIssues() {
    return this.result?.issues.slice(0, 20) ?? [];
  }

  get previewRows() {
    return this.result?.previewRows ?? [];
  }

  async onSourceSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.sourceFileIssues = this.mapperService.validateExcelFile(file);

    if (!file || this.sourceFileIssues.length > 0) {
      return;
    }

    this.processing = true;
    this.processingLabel = 'Reading source workbook';
    this.processingProgress = 20;

    try {
      this.sourceSheet = await this.mapperService.parseExcelFile(file);
      this.initializeRules();
      this.globalWarnings = [];
      this.result = null;
      this.processingProgress = 100;
      this.auditEntries = this.mapperService.recordAudit(
        this.actorName,
        'Uploaded source workbook',
        `${file.name} with ${this.sourceSheet.rows.length} row(s)`
      );
    } catch {
      this.sourceFileIssues = ['Unable to read the selected source workbook.'];
    } finally {
      this.processing = false;
      this.processingLabel = 'Ready';
      input.value = '';
    }
  }

  async onTemplateSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.templateFileIssues = this.mapperService.validateExcelFile(file);

    if (!file || this.templateFileIssues.length > 0) {
      return;
    }

    this.processing = true;
    this.processingLabel = 'Reading target template';
    this.processingProgress = 25;

    try {
      this.templateSheet = await this.mapperService.parseExcelFile(file);
      this.initializeRules();
      this.result = null;
      this.processingProgress = 100;
      this.auditEntries = this.mapperService.recordAudit(
        this.actorName,
        'Uploaded target template',
        `${file.name} with ${this.templateSheet.columns.length} target column(s)`
      );
    } catch {
      this.templateFileIssues = ['Unable to read the selected target template.'];
    } finally {
      this.processing = false;
      this.processingLabel = 'Ready';
      input.value = '';
    }
  }

  initializeRules(): void {
    if (!this.sourceSheet) {
      this.mappingRules = [];
      return;
    }

    const targetColumns =
      this.templateSheet?.columns.map((column) => column.name) ??
      this.sourceSheet.columns.map((column) => column.name);

    this.mappingRules = this.mapperService.createRules(this.sourceSheet.columns, targetColumns);
  }

  addTargetColumn(): void {
    const columnName = this.newTargetColumn.trim();
    if (!columnName || this.targetColumns.includes(columnName) || !this.sourceSheet) {
      return;
    }

    const rule = this.mapperService.createRules(this.sourceSheet.columns, [columnName])[0];
    rule.required = false;
    this.mappingRules = [...this.mappingRules, rule];
    this.newTargetColumn = '';
    this.touchConfig();
  }

  removeTargetColumn(ruleId: string): void {
    this.mappingRules = this.mappingRules.filter((rule) => rule.id !== ruleId);
    this.touchConfig();
  }

  setPrimarySource(rule: MappingRule, columnName: string): void {
    const selected = columnName ? [columnName] : [];
    const additional = rule.sourceColumns.filter(
      (column) => column !== rule.sourceColumns[0] && column !== columnName
    );
    rule.sourceColumns = [...selected, ...additional];
    this.touchConfig();
  }

  toggleAdditionalSource(rule: MappingRule, columnName: string, checked: boolean): void {
    const current = new Set(rule.sourceColumns);
    const primary = rule.sourceColumns[0] ?? '';

    if (checked) {
      current.add(columnName);
    } else if (columnName !== primary) {
      current.delete(columnName);
    }

    const ordered = Array.from(current);
    if (primary && ordered.includes(primary)) {
      ordered.splice(ordered.indexOf(primary), 1);
      ordered.unshift(primary);
    }

    rule.sourceColumns = ordered;
    this.touchConfig();
  }

  addOperation(rule: MappingRule): void {
    rule.operations = [...rule.operations, this.mapperService.createOperation()];
    this.touchConfig();
  }

  onOperationTypeChange(rule: MappingRule, operationIndex: number, type: OperationType): void {
    rule.operations[operationIndex] = this.mapperService.createOperation(type);
    this.touchConfig();
  }

  removeOperation(rule: MappingRule, operationId: string): void {
    rule.operations = rule.operations.filter((operation) => operation.id !== operationId);
    this.touchConfig();
  }

  addValidation(rule: MappingRule): void {
    rule.validations = [...rule.validations, this.mapperService.createValidation()];
    this.touchConfig();
  }

  onValidationTypeChange(rule: MappingRule, validationIndex: number, type: ValidationType): void {
    rule.validations[validationIndex] = this.mapperService.createValidation(type);
    this.touchConfig();
  }

  removeValidation(rule: MappingRule, validationId: string): void {
    rule.validations = rule.validations.filter((validation) => validation.id !== validationId);
    this.touchConfig();
  }

  async generatePreview(): Promise<void> {
    if (!this.sourceSheet) {
      return;
    }

    this.processing = true;
    this.processingProgress = 5;
    this.processingLabel = 'Applying mappings and transformations';

    this.result = await this.mapperService.processWorkbook(
      this.sourceSheet.rows,
      this.mappingRules,
      this.sourceSheet.columns,
      (progress) => {
        this.processingProgress = progress;
      }
    );

    this.globalWarnings = this.result.warnings;
    this.processing = false;
    this.processingLabel = 'Preview ready';
    this.currentStep = 3;

    this.auditEntries = this.mapperService.recordAudit(
      this.actorName,
      'Previewed mapping result',
      `${this.result.summary.successfulRows}/${this.result.summary.processedRows} row(s) validated`
    );
  }

  exportWorkbook(): void {
    if (!this.result?.rows.length) {
      return;
    }

    this.mapperService.exportWorkbook(this.result.rows, 'excel-mapping-output.xlsx');
    this.auditEntries = this.mapperService.recordAudit(
      this.actorName,
      'Exported mapped workbook',
      `${this.result.rows.length} row(s) exported`
    );
    this.currentStep = 4;
  }

  exportIssues(): void {
    if (!this.result?.issues.length) {
      return;
    }

    this.mapperService.exportIssuesReport(this.result.issues);
    this.auditEntries = this.mapperService.recordAudit(
      this.actorName,
      'Downloaded issues report',
      `${this.result.issues.length} issue(s) exported`
    );
  }

  saveTemplate(): void {
    if (!this.templateName.trim() || !this.sourceSheet) {
      return;
    }

    this.savedTemplates = this.mapperService.saveTemplate(
      this.templateName,
      this.sourceSheet.columns.map((column) => column.name),
      this.targetColumns,
      this.mappingRules
    );

    this.auditEntries = this.mapperService.recordAudit(
      this.actorName,
      'Saved mapping template',
      this.templateName.trim()
    );
    this.templateName = '';
  }

  loadTemplate(template: SavedMappingTemplate): void {
    this.mappingRules = JSON.parse(JSON.stringify(template.rules)) as MappingRule[];
    this.result = null;
    this.globalWarnings = [];
    this.auditEntries = this.mapperService.recordAudit(
      this.actorName,
      'Loaded mapping template',
      template.name
    );
  }

  deleteTemplate(templateId: string): void {
    this.savedTemplates = this.mapperService.deleteTemplate(templateId);
  }

  goToStep(stepIndex: number): void {
    if (stepIndex === 0 || this.sourceSheet) {
      this.currentStep = stepIndex;
    }
  }

  nextStep(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep += 1;
    }
  }

  previousStep(): void {
    if (this.currentStep > 0) {
      this.currentStep -= 1;
    }
  }

  getRulePreview(rule: MappingRule): string {
    return this.mapperService.previewRule(rule, this.sourceSheet?.rows[0] ?? null);
  }

  trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  private touchConfig(): void {
    this.result = null;
    this.globalWarnings = [];
  }
}
