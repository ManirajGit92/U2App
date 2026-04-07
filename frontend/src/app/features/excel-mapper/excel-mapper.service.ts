import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export type DataType = 'string' | 'number' | 'date' | 'boolean';

export interface ParsedColumn {
  name: string;
  detectedType: DataType;
  sampleValues: string[];
}

export interface ParsedWorkbook {
  fileName: string;
  fileSize: number;
  sheetName: string;
  rows: Record<string, unknown>[];
  columns: ParsedColumn[];
}

export type OperationType =
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'concat'
  | 'math'
  | 'dateFormat'
  | 'ifElse'
  | 'customTemplate';

export interface MappingOperation {
  id: string;
  type: OperationType;
  config: Record<string, unknown>;
}

export type ValidationType = 'regex' | 'min' | 'max';

export interface ValidationRule {
  id: string;
  type: ValidationType;
  value: string;
  message: string;
}

export interface MappingRule {
  id: string;
  targetColumn: string;
  sourceColumns: string[];
  required: boolean;
  targetType: DataType;
  operations: MappingOperation[];
  validations: ValidationRule[];
}

export interface RowIssue {
  rowNumber: number;
  column: string;
  severity: 'error' | 'warning';
  message: string;
  rawValue?: string;
}

export interface ProcessSummary {
  processedRows: number;
  successfulRows: number;
  errorCount: number;
  warningCount: number;
}

export interface ProcessedWorkbook {
  rows: Record<string, unknown>[];
  previewRows: Record<string, unknown>[];
  issues: RowIssue[];
  warnings: string[];
  summary: ProcessSummary;
}

export interface SavedMappingTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceColumns: string[];
  targetColumns: string[];
  rules: MappingRule[];
}

export interface AuditEntry {
  id: string;
  user: string;
  action: string;
  details: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class ExcelMapperService {
  private readonly maxFileSizeMb = 10;
  private readonly templateStorageKey = 'u2.excelMapper.templates';
  private readonly auditStorageKey = 'u2.excelMapper.audit';

  validateExcelFile(file: File | null | undefined): string[] {
    if (!file) {
      return ['Please select a file.'];
    }

    const issues: string[] = [];
    const validExtensions = ['.xlsx', '.xls'];
    const lowerName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some((extension) =>
      lowerName.endsWith(extension)
    );

    if (!hasValidExtension) {
      issues.push('Only .xlsx and .xls files are allowed.');
    }

    if (file.size > this.maxFileSizeMb * 1024 * 1024) {
      issues.push(`File size must be under ${this.maxFileSizeMb} MB.`);
    }

    return issues;
  }

  async parseExcelFile(file: File): Promise<ParsedWorkbook> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows =
      XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
        raw: false,
      }) ?? [];

    return {
      fileName: file.name,
      fileSize: file.size,
      sheetName,
      rows,
      columns: this.extractColumns(rows),
    };
  }

  createRules(
    sourceColumns: ParsedColumn[],
    targetColumns: string[]
  ): MappingRule[] {
    return targetColumns.map((targetColumn) => {
      const matchedSource = sourceColumns.find(
        (column) =>
          column.name.trim().toLowerCase() === targetColumn.trim().toLowerCase()
      );

      return {
        id: this.createId(),
        targetColumn,
        sourceColumns: matchedSource ? [matchedSource.name] : [],
        required: true,
        targetType: matchedSource?.detectedType ?? 'string',
        operations: [],
        validations: [],
      };
    });
  }

  async processWorkbook(
    sourceRows: Record<string, unknown>[],
    rules: MappingRule[],
    sourceColumns: ParsedColumn[],
    progress?: (value: number) => void
  ): Promise<ProcessedWorkbook> {
    const warnings = this.collectWarnings(rules, sourceColumns);
    const issues: RowIssue[] = [];
    const resultRows: Record<string, unknown>[] = [];
    const sourceColumnNames = new Set(sourceColumns.map((column) => column.name));
    const chunkSize = 250;

    for (let index = 0; index < sourceRows.length; index += chunkSize) {
      const chunk = sourceRows.slice(index, index + chunkSize);

      chunk.forEach((row, chunkIndex) => {
        const rowNumber = index + chunkIndex + 2;
        const mappedRow: Record<string, unknown> = {};
        let rowHasError = false;

        rules.forEach((rule) => {
          const sourceValues = rule.sourceColumns.map(
            (column) => row[column] ?? ''
          );
          const missingColumns = rule.sourceColumns.filter(
            (column) => !sourceColumnNames.has(column)
          );

          if (missingColumns.length > 0) {
            issues.push({
              rowNumber,
              column: rule.targetColumn,
              severity: 'warning',
              message: `Missing source column(s): ${missingColumns.join(', ')}`,
            });
          }

          const transformed = this.applyRule(rule, row, sourceValues);
          const normalized = this.coerceValue(transformed.value, rule.targetType);

          if (rule.required && this.isEmptyValue(normalized.value)) {
            rowHasError = true;
            issues.push({
              rowNumber,
              column: rule.targetColumn,
              severity: 'error',
              message: 'Required mapping produced an empty value.',
            });
          }

          if (!normalized.valid) {
            rowHasError = true;
            issues.push({
              rowNumber,
              column: rule.targetColumn,
              severity: 'error',
              message: normalized.message,
              rawValue: this.stringifyValue(transformed.value),
            });
          }

          rule.validations.forEach((validation) => {
            const validationMessage = this.runValidation(validation, normalized.value);
            if (validationMessage) {
              rowHasError = true;
              issues.push({
                rowNumber,
                column: rule.targetColumn,
                severity: 'error',
                message: validationMessage,
                rawValue: this.stringifyValue(normalized.value),
              });
            }
          });

          mappedRow[rule.targetColumn] = this.sanitizeForExcel(normalized.value);
        });

        if (!rowHasError) {
          resultRows.push(mappedRow);
        }
      });

      if (progress) {
        progress(Math.round(((index + chunk.length) / Math.max(sourceRows.length, 1)) * 100));
      }

      await new Promise((resolve) => setTimeout(resolve));
    }

    const errorCount = issues.filter((issue) => issue.severity === 'error').length;
    const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

    return {
      rows: resultRows,
      previewRows: resultRows.slice(0, 10),
      issues,
      warnings,
      summary: {
        processedRows: sourceRows.length,
        successfulRows: resultRows.length,
        errorCount,
        warningCount,
      },
    };
  }

  previewRule(
    rule: MappingRule,
    sampleRow: Record<string, unknown> | null
  ): string {
    if (!sampleRow) {
      return '';
    }

    const sourceValues = rule.sourceColumns.map((column) => sampleRow[column] ?? '');
    const result = this.applyRule(rule, sampleRow, sourceValues);
    return this.stringifyValue(result.value);
  }

  exportWorkbook(rows: Record<string, unknown>[], fileName = 'mapped-output.xlsx'): void {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MappedData');
    XLSX.writeFile(workbook, fileName);
  }

  exportIssuesReport(issues: RowIssue[], fileName = 'mapping-errors.xlsx'): void {
    const reportRows = issues.map((issue) => ({
      rowNumber: issue.rowNumber,
      column: issue.column,
      severity: issue.severity,
      message: issue.message,
      rawValue: issue.rawValue ?? '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(reportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Issues');
    XLSX.writeFile(workbook, fileName);
  }

  loadTemplates(): SavedMappingTemplate[] {
    return this.readJson<SavedMappingTemplate[]>(this.templateStorageKey, []);
  }

  saveTemplate(
    name: string,
    sourceColumns: string[],
    targetColumns: string[],
    rules: MappingRule[]
  ): SavedMappingTemplate[] {
    const templates = this.loadTemplates();
    const existing = templates.find(
      (template) => template.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    const now = new Date().toISOString();

    if (existing) {
      existing.updatedAt = now;
      existing.sourceColumns = [...sourceColumns];
      existing.targetColumns = [...targetColumns];
      existing.rules = this.cloneRules(rules);
    } else {
      templates.unshift({
        id: this.createId(),
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
        sourceColumns: [...sourceColumns],
        targetColumns: [...targetColumns],
        rules: this.cloneRules(rules),
      });
    }

    localStorage.setItem(this.templateStorageKey, JSON.stringify(templates));
    return templates;
  }

  deleteTemplate(templateId: string): SavedMappingTemplate[] {
    const templates = this.loadTemplates().filter((template) => template.id !== templateId);
    localStorage.setItem(this.templateStorageKey, JSON.stringify(templates));
    return templates;
  }

  getAuditEntries(): AuditEntry[] {
    return this.readJson<AuditEntry[]>(this.auditStorageKey, []);
  }

  recordAudit(user: string, action: string, details: string): AuditEntry[] {
    const entries = this.getAuditEntries();
    entries.unshift({
      id: this.createId(),
      user: user || 'Anonymous User',
      action,
      details,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(this.auditStorageKey, JSON.stringify(entries.slice(0, 50)));
    return entries.slice(0, 50);
  }

  createOperation(type: OperationType = 'trim'): MappingOperation {
    const defaults: Record<OperationType, Record<string, unknown>> = {
      uppercase: {},
      lowercase: {},
      trim: {},
      concat: {
        separator: ' ',
        prefix: '',
        suffix: '',
      },
      math: {
        operator: 'add',
        operand: '0',
      },
      dateFormat: {
        format: 'YYYY-MM-DD',
      },
      ifElse: {
        compareColumn: '',
        operator: 'equals',
        comparisonValue: '',
        trueValue: '{{value}}',
        falseValue: '',
      },
      customTemplate: {
        template: '{{value}}',
      },
    };

    return {
      id: this.createId(),
      type,
      config: { ...defaults[type] },
    };
  }

  createValidation(type: ValidationType = 'regex'): ValidationRule {
    const defaults: Record<ValidationType, { value: string; message: string }> = {
      regex: {
        value: '.*',
        message: 'Value does not match the expected pattern.',
      },
      min: {
        value: '0',
        message: 'Value is below the allowed minimum.',
      },
      max: {
        value: '0',
        message: 'Value is above the allowed maximum.',
      },
    };

    return {
      id: this.createId(),
      type,
      value: defaults[type].value,
      message: defaults[type].message,
    };
  }

  private extractColumns(rows: Record<string, unknown>[]): ParsedColumn[] {
    if (!rows.length) {
      return [];
    }

    const allKeys = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((key) => allKeys.add(key)));

    return Array.from(allKeys).map((key) => {
      const values = rows
        .map((row) => row[key])
        .filter((value) => !this.isEmptyValue(value))
        .slice(0, 20);

      return {
        name: key,
        detectedType: this.detectDataType(values),
        sampleValues: values.slice(0, 3).map((value) => this.stringifyValue(value)),
      };
    });
  }

  private detectDataType(values: unknown[]): DataType {
    if (!values.length) {
      return 'string';
    }

    const stringValues = values.map((value) => this.stringifyValue(value).trim());

    const isBoolean = stringValues.every(
      (value) => ['true', 'false', 'yes', 'no', '1', '0'].includes(value.toLowerCase())
    );
    if (isBoolean) {
      return 'boolean';
    }

    const isNumber = stringValues.every(
      (value) => value !== '' && !Number.isNaN(Number(value.replace(/,/g, '')))
    );
    if (isNumber) {
      return 'number';
    }

    const isDate = stringValues.every((value) => {
      const parsed = Date.parse(value);
      return value !== '' && !Number.isNaN(parsed);
    });
    if (isDate) {
      return 'date';
    }

    return 'string';
  }

  private collectWarnings(
    rules: MappingRule[],
    sourceColumns: ParsedColumn[]
  ): string[] {
    const warnings: string[] = [];
    const sourceColumnMap = new Map(
      sourceColumns.map((column) => [column.name, column.detectedType] as const)
    );

    rules.forEach((rule) => {
      if (!rule.sourceColumns.length) {
        warnings.push(`Target column "${rule.targetColumn}" is not mapped.`);
      }

      rule.sourceColumns.forEach((sourceColumn) => {
        if (!sourceColumnMap.has(sourceColumn)) {
          warnings.push(
            `Target column "${rule.targetColumn}" references missing source column "${sourceColumn}".`
          );
          return;
        }

        const sourceType = sourceColumnMap.get(sourceColumn);
        if (sourceType && sourceType !== rule.targetType && rule.sourceColumns.length === 1) {
          warnings.push(
            `Possible type mismatch: "${sourceColumn}" (${sourceType}) -> "${rule.targetColumn}" (${rule.targetType}).`
          );
        }
      });
    });

    return [...new Set(warnings)];
  }

  private applyRule(
    rule: MappingRule,
    row: Record<string, unknown>,
    sourceValues: unknown[]
  ): { value: unknown } {
    let value: unknown =
      sourceValues.length <= 1
        ? sourceValues[0] ?? ''
        : sourceValues.map((item) => this.stringifyValue(item)).join(' ');

    rule.operations.forEach((operation) => {
      value = this.applyOperation(operation, value, row, sourceValues);
    });

    return { value };
  }

  private applyOperation(
    operation: MappingOperation,
    currentValue: unknown,
    row: Record<string, unknown>,
    sourceValues: unknown[]
  ): unknown {
    switch (operation.type) {
      case 'uppercase':
        return this.stringifyValue(currentValue).toUpperCase();
      case 'lowercase':
        return this.stringifyValue(currentValue).toLowerCase();
      case 'trim':
        return this.stringifyValue(currentValue).trim();
      case 'concat': {
        const separator = this.stringifyValue(operation.config['separator'] ?? ' ');
        const prefix = this.stringifyValue(operation.config['prefix'] ?? '');
        const suffix = this.stringifyValue(operation.config['suffix'] ?? '');
        const base =
          sourceValues.length > 1
            ? sourceValues.map((item) => this.stringifyValue(item)).join(separator)
            : this.stringifyValue(currentValue);
        return `${prefix}${base}${suffix}`;
      }
      case 'math': {
        const numeric = Number(this.stringifyValue(currentValue).replace(/,/g, ''));
        const operand = Number(operation.config['operand'] ?? 0);
        const operator = this.stringifyValue(operation.config['operator'] ?? 'add');

        if (Number.isNaN(numeric) || Number.isNaN(operand)) {
          return currentValue;
        }

        switch (operator) {
          case 'subtract':
            return numeric - operand;
          case 'multiply':
            return numeric * operand;
          case 'divide':
            return operand === 0 ? currentValue : numeric / operand;
          default:
            return numeric + operand;
        }
      }
      case 'dateFormat': {
        const format = this.stringifyValue(operation.config['format'] ?? 'YYYY-MM-DD');
        return this.formatDate(currentValue, format);
      }
      case 'ifElse': {
        const compareColumn = this.stringifyValue(operation.config['compareColumn'] ?? '');
        const operator = this.stringifyValue(operation.config['operator'] ?? 'equals');
        const comparisonValue = this.stringifyValue(operation.config['comparisonValue'] ?? '');
        const trueValue = this.stringifyValue(operation.config['trueValue'] ?? '{{value}}');
        const falseValue = this.stringifyValue(operation.config['falseValue'] ?? '');
        const left = compareColumn ? row[compareColumn] ?? '' : currentValue;
        const matched = this.evaluateCondition(left, comparisonValue, operator);

        return this.resolveTemplate(matched ? trueValue : falseValue, row, currentValue);
      }
      case 'customTemplate': {
        const template = this.stringifyValue(operation.config['template'] ?? '{{value}}');
        return this.resolveTemplate(template, row, currentValue);
      }
      default:
        return currentValue;
    }
  }

  private coerceValue(
    value: unknown,
    targetType: DataType
  ): { value: unknown; valid: boolean; message: string } {
    if (this.isEmptyValue(value)) {
      return { value: '', valid: true, message: '' };
    }

    switch (targetType) {
      case 'number': {
        const numeric = Number(this.stringifyValue(value).replace(/,/g, ''));
        return Number.isNaN(numeric)
          ? {
              value,
              valid: false,
              message: 'Result is not a valid number.',
            }
          : { value: numeric, valid: true, message: '' };
      }
      case 'boolean': {
        const normalized = this.stringifyValue(value).trim().toLowerCase();
        if (['true', 'yes', '1'].includes(normalized)) {
          return { value: true, valid: true, message: '' };
        }
        if (['false', 'no', '0'].includes(normalized)) {
          return { value: false, valid: true, message: '' };
        }
        return {
          value,
          valid: false,
          message: 'Result is not a valid boolean.',
        };
      }
      case 'date': {
        const date = new Date(this.stringifyValue(value));
        return Number.isNaN(date.getTime())
          ? {
              value,
              valid: false,
              message: 'Result is not a valid date.',
            }
          : {
              value: date.toISOString().slice(0, 10),
              valid: true,
              message: '',
            };
      }
      default:
        return { value: this.stringifyValue(value), valid: true, message: '' };
    }
  }

  private runValidation(validation: ValidationRule, value: unknown): string {
    if (this.isEmptyValue(value)) {
      return '';
    }

    if (validation.type === 'regex') {
      try {
        const regex = new RegExp(validation.value);
        return regex.test(this.stringifyValue(value)) ? '' : validation.message;
      } catch {
        return 'Validation regex is invalid.';
      }
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return 'Validation expected a numeric value.';
    }

    if (validation.type === 'min' && numeric < Number(validation.value)) {
      return validation.message;
    }

    if (validation.type === 'max' && numeric > Number(validation.value)) {
      return validation.message;
    }

    return '';
  }

  private evaluateCondition(left: unknown, right: string, operator: string): boolean {
    const leftValue = this.stringifyValue(left);
    switch (operator) {
      case 'contains':
        return leftValue.toLowerCase().includes(right.toLowerCase());
      case 'notEquals':
        return leftValue !== right;
      case 'greaterThan':
        return Number(leftValue) > Number(right);
      case 'lessThan':
        return Number(leftValue) < Number(right);
      case 'isEmpty':
        return this.isEmptyValue(leftValue);
      default:
        return leftValue === right;
    }
  }

  private resolveTemplate(
    template: string,
    row: Record<string, unknown>,
    currentValue: unknown
  ): string {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, token: string) => {
      const normalizedToken = token.trim();
      if (normalizedToken === 'value') {
        return this.stringifyValue(currentValue);
      }

      return this.stringifyValue(row[normalizedToken] ?? '');
    });
  }

  private formatDate(value: unknown, format: string): string {
    const date = new Date(this.stringifyValue(value));
    if (Number.isNaN(date.getTime())) {
      return this.stringifyValue(value);
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const monthShort = date.toLocaleString('en-US', { month: 'short' });

    switch (format) {
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD-MMM-YYYY':
        return `${day}-${monthShort}-${year}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  private sanitizeForExcel(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (/^[=+\-@]/.test(trimmed)) {
      return `'${trimmed}`;
    }

    return trimmed;
  }

  private cloneRules(rules: MappingRule[]): MappingRule[] {
    return JSON.parse(JSON.stringify(rules)) as MappingRule[];
  }

  private readJson<T>(key: string, fallback: T): T {
    try {
      const value = localStorage.getItem(key);
      return value ? (JSON.parse(value) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private stringifyValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  }

  private isEmptyValue(value: unknown): boolean {
    return value === null || value === undefined || this.stringifyValue(value).trim() === '';
  }

  private createId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
