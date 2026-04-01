import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TaxCalculationResult,
  TaxCalculatorInput,
  TaxCalculatorService,
} from './tax-calculator.service';

type NumericFieldKey = {
  [K in keyof TaxCalculatorInput]: TaxCalculatorInput[K] extends number ? K : never;
}[keyof TaxCalculatorInput];

@Component({
  selector: 'app-tax-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tax-calculator.component.html',
  styleUrl: './tax-calculator.component.scss',
})
export class TaxCalculatorComponent {
  private taxService = inject(TaxCalculatorService);

  model: TaxCalculatorInput = this.taxService.createDefaultInput();
  result: TaxCalculationResult = this.taxService.calculate(this.model);
  uploadSummary: string[] = [];
  uploadMatches: Array<{ label: string; value: number }> = [];
  uploadError = '';

  readonly ageOptions = [
    { value: 'below60', label: 'Below 60 years' },
    { value: 'senior', label: 'Senior citizen (60-79)' },
    { value: 'superSenior', label: 'Super senior (80+)' },
  ];

  readonly employmentOptions = [
    { value: 'salaried', label: 'Salaried / pensioner' },
    { value: 'selfEmployed', label: 'Self-employed / professional' },
  ];

  readonly regimeOptions = [
    { value: 'compare', label: 'Compare both regimes' },
    { value: 'old', label: 'Focus on old regime' },
    { value: 'new', label: 'Focus on new regime' },
  ];

  readonly eightyCFields: Array<{ key: NumericFieldKey; label: string }> = [
    { key: 'epfContribution', label: 'EPF / VPF' },
    { key: 'ppfInvestment', label: 'PPF' },
    { key: 'elssInvestment', label: 'ELSS funds' },
    { key: 'lifeInsurancePremium', label: 'Life insurance premium' },
    { key: 'housingPrincipalRepayment', label: 'Home loan principal' },
    { key: 'taxSaverFd', label: 'Tax saver FD' },
    { key: 'nscInvestment', label: 'NSC' },
    { key: 'tuitionFees', label: 'Children tuition fees' },
    { key: 'other80C', label: 'Other eligible 80C items' },
  ];

  readonly trackedDeductions: Array<{ key: NumericFieldKey; label: string; placeholder?: string }> = [
    { key: 'npsAdditional', label: 'Additional NPS u/s 80CCD(1B)' },
    { key: 'employerNpsContribution', label: 'Employer NPS contribution' },
    { key: 'healthInsuranceSelfFamily', label: 'Health insurance: self/family' },
    { key: 'healthInsuranceParents', label: 'Health insurance: parents' },
    { key: 'educationLoanInterest', label: 'Education loan interest' },
    { key: 'rent80GG', label: 'Eligible rent deduction u/s 80GG' },
    { key: 'additionalDeductions', label: 'Other deductions' },
  ];

  onModelChange(): void {
    this.result = this.taxService.calculate(this.model);
  }

  setNumericField(key: NumericFieldKey, value: string | number): void {
    const numericValue = typeof value === 'number' ? value : Number(value || 0);
    this.model[key] = Number.isFinite(numericValue) ? numericValue : 0;
    this.onModelChange();
  }

  getNumericField(key: NumericFieldKey): number {
    return this.model[key];
  }

  async onForm16Upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadError = '';

    try {
      const buffer = await file.arrayBuffer();
      const parsed = this.taxService.parseForm16Workbook(buffer);
      this.model = {
        ...this.model,
        ...parsed.fields,
      };
      this.uploadSummary = parsed.summary;
      this.uploadMatches = parsed.matchedItems.slice(0, 8);
      this.result = this.taxService.calculate(this.model);
    } catch {
      this.uploadError = 'Unable to read this Form 16 workbook. Please verify the file format or fill values manually.';
      this.uploadSummary = [];
      this.uploadMatches = [];
    } finally {
      input.value = '';
    }
  }

  getCurrency(value: number): string {
    return `INR ${this.taxService.formatCurrency(value)}`;
  }

  getVisibleBreakdowns() {
    if (this.model.regimePreference === 'old') {
      return [this.result.oldRegime];
    }

    if (this.model.regimePreference === 'new') {
      return [this.result.newRegime];
    }

    return [this.result.oldRegime, this.result.newRegime];
  }
}
