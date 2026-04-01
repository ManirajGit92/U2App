import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export type AgeCategory = 'below60' | 'senior' | 'superSenior';
export type EmploymentType = 'salaried' | 'selfEmployed';
export type RegimePreference = 'compare' | 'old' | 'new';
export type DonationEligibility = '50' | '100';
export type DisabilityType = 'none' | 'disability' | 'severe';

export interface TaxCalculatorInput {
  assessmentLabel: string;
  residencyStatus: 'resident' | 'nonResident';
  ageCategory: AgeCategory;
  employmentType: EmploymentType;
  regimePreference: RegimePreference;
  grossSalary: number;
  bonusIncome: number;
  perquisites: number;
  hraExemption: number;
  ltaExemption: number;
  otherExemptions: number;
  professionalTax: number;
  netHousePropertyIncome: number;
  selfOccupiedHomeLoanInterest: number;
  businessIncome: number;
  capitalGains: number;
  interestIncome: number;
  savingsInterest: number;
  dividendIncome: number;
  familyPension: number;
  otherIncome: number;
  epfContribution: number;
  ppfInvestment: number;
  elssInvestment: number;
  lifeInsurancePremium: number;
  housingPrincipalRepayment: number;
  taxSaverFd: number;
  nscInvestment: number;
  tuitionFees: number;
  other80C: number;
  npsAdditional: number;
  employerNpsContribution: number;
  healthInsuranceSelfFamily: number;
  healthInsuranceParents: number;
  parentsAreSenior: boolean;
  educationLoanInterest: number;
  rent80GG: number;
  donationAmount: number;
  donationEligibility: DonationEligibility;
  additionalDeductions: number;
  disabilityType: DisabilityType;
  tdsDeducted: number;
  advanceTaxPaid: number;
}

type NumericFieldKey = {
  [K in keyof TaxCalculatorInput]: TaxCalculatorInput[K] extends number ? K : never;
}[keyof TaxCalculatorInput];

export interface RegimeBreakdown {
  regime: 'old' | 'new';
  label: string;
  salaryIncome: number;
  housePropertyIncome: number;
  businessAndOtherIncome: number;
  grossTotalIncome: number;
  standardDeduction: number;
  exemptionTotal: number;
  chapterViaDeductions: number;
  employerNpsDeduction: number;
  taxableIncome: number;
  taxBeforeRebate: number;
  rebate: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  taxesAlreadyPaid: number;
  netPayable: number;
  refundDue: number;
  deductionBreakdown: Array<{ label: string; amount: number }>;
  notes: string[];
}

export interface TaxCalculationResult {
  oldRegime: RegimeBreakdown;
  newRegime: RegimeBreakdown;
  recommendedRegime: 'old' | 'new';
  taxSaving: number;
  suggestions: string[];
}

export interface Form16ImportResult {
  fields: Partial<TaxCalculatorInput>;
  matchedItems: Array<{ label: string; value: number }>;
  summary: string[];
}

@Injectable({ providedIn: 'root' })
export class TaxCalculatorService {
  createDefaultInput(): TaxCalculatorInput {
    return {
      assessmentLabel: 'FY 2025-26 / AY 2026-27',
      residencyStatus: 'resident',
      ageCategory: 'below60',
      employmentType: 'salaried',
      regimePreference: 'compare',
      grossSalary: 1200000,
      bonusIncome: 0,
      perquisites: 0,
      hraExemption: 0,
      ltaExemption: 0,
      otherExemptions: 0,
      professionalTax: 0,
      netHousePropertyIncome: 0,
      selfOccupiedHomeLoanInterest: 0,
      businessIncome: 0,
      capitalGains: 0,
      interestIncome: 0,
      savingsInterest: 0,
      dividendIncome: 0,
      familyPension: 0,
      otherIncome: 0,
      epfContribution: 0,
      ppfInvestment: 0,
      elssInvestment: 0,
      lifeInsurancePremium: 0,
      housingPrincipalRepayment: 0,
      taxSaverFd: 0,
      nscInvestment: 0,
      tuitionFees: 0,
      other80C: 0,
      npsAdditional: 0,
      employerNpsContribution: 0,
      healthInsuranceSelfFamily: 0,
      healthInsuranceParents: 0,
      parentsAreSenior: false,
      educationLoanInterest: 0,
      rent80GG: 0,
      donationAmount: 0,
      donationEligibility: '50',
      additionalDeductions: 0,
      disabilityType: 'none',
      tdsDeducted: 0,
      advanceTaxPaid: 0,
    };
  }

  calculate(input: TaxCalculatorInput): TaxCalculationResult {
    const oldRegime = this.calculateRegime(input, 'old');
    const newRegime = this.calculateRegime(input, 'new');
    const recommendedRegime = oldRegime.totalTax <= newRegime.totalTax ? 'old' : 'new';
    const taxSaving = Math.abs(oldRegime.totalTax - newRegime.totalTax);

    return {
      oldRegime,
      newRegime,
      recommendedRegime,
      taxSaving,
      suggestions: this.buildSuggestions(input, oldRegime, newRegime, recommendedRegime),
    };
  }

  parseForm16Workbook(buffer: ArrayBuffer): Form16ImportResult {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const candidates = new Map<string, number>();
    const matchedItems: Array<{ label: string; value: number }> = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
        header: 1,
        raw: false,
        defval: '',
      });

      for (const row of rows) {
        const cells = row.map((cell) => String(cell ?? '').trim()).filter(Boolean);
        if (!cells.length) continue;

        const labelText = cells.join(' ').toLowerCase();
        const numericValues = cells
          .map((cell) => this.parseAmount(cell))
          .filter((value): value is number => value !== null);

        if (!numericValues.length) continue;

        const amount = numericValues[numericValues.length - 1];
        this.captureIfMatch(candidates, matchedItems, labelText, amount);
      }
    }

    const fields: Partial<TaxCalculatorInput> = {};
    this.assignIfPresent(fields, 'grossSalary', candidates, ['grossSalary', 'salary17_1']);
    this.assignIfPresent(fields, 'perquisites', candidates, ['perquisites']);
    this.assignIfPresent(fields, 'otherExemptions', candidates, ['allowanceExempt']);
    this.assignIfPresent(fields, 'professionalTax', candidates, ['professionalTax']);
    this.assignIfPresent(fields, 'tdsDeducted', candidates, ['tds']);
    this.assignIfPresent(fields, 'epfContribution', candidates, ['providentFund80c']);
    this.assignIfPresent(fields, 'lifeInsurancePremium', candidates, ['lifeInsurance80c']);
    this.assignIfPresent(fields, 'npsAdditional', candidates, ['nps80ccd1b']);
    this.assignIfPresent(fields, 'healthInsuranceSelfFamily', candidates, ['healthInsurance80d']);
    this.assignIfPresent(fields, 'interestIncome', candidates, ['otherSources']);
    this.assignIfPresent(fields, 'otherIncome', candidates, ['grossTotalIncomeOther']);

    const summary = [
      fields.grossSalary ? `Salary detected: INR ${this.formatCurrency(fields.grossSalary)}` : '',
      fields.tdsDeducted ? `TDS detected: INR ${this.formatCurrency(fields.tdsDeducted)}` : '',
      matchedItems.length ? `${matchedItems.length} Form 16 line items matched` : 'No recognizable Form 16 values found',
    ].filter(Boolean);

    return { fields, matchedItems, summary };
  }

  private calculateRegime(input: TaxCalculatorInput, regime: 'old' | 'new'): RegimeBreakdown {
    const salaryBase = this.clean(input.grossSalary) + this.clean(input.bonusIncome) + this.clean(input.perquisites);
    const exemptionTotal = regime === 'old'
      ? this.clean(input.hraExemption) + this.clean(input.ltaExemption) + this.clean(input.otherExemptions)
      : 0;
    const standardDeduction = this.getStandardDeduction(input, regime);
    const professionalTax = regime === 'old' ? this.clean(input.professionalTax) : 0;
    const salaryIncome = Math.max(0, salaryBase - exemptionTotal - standardDeduction - professionalTax);

    const familyPension = this.getFamilyPensionTaxable(input, regime);
    const housePropertyIncome = regime === 'old'
      ? this.clean(input.netHousePropertyIncome) - Math.min(this.clean(input.selfOccupiedHomeLoanInterest), 200000)
      : this.clean(input.netHousePropertyIncome);
    const businessAndOtherIncome =
      this.clean(input.businessIncome) +
      this.clean(input.capitalGains) +
      this.clean(input.interestIncome) +
      this.clean(input.dividendIncome) +
      this.clean(input.otherIncome) +
      familyPension;

    const grossTotalIncome = salaryIncome + housePropertyIncome + businessAndOtherIncome;
    const chapterViaDeductions = regime === 'old' ? this.getOldRegimeDeductions(input) : 0;
    const employerNpsDeduction = this.getEmployerNpsDeduction(input, regime);
    const taxableIncome = Math.max(0, grossTotalIncome - chapterViaDeductions - employerNpsDeduction);
    const taxBeforeRebate = this.getTaxFromSlabs(taxableIncome, input, regime);
    const rebate = this.getRebate(taxableIncome, taxBeforeRebate, input, regime);
    const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate);
    const surcharge = this.getSurcharge(taxAfterRebate, taxableIncome, regime);
    const cess = (taxAfterRebate + surcharge) * 0.04;
    const totalTax = taxAfterRebate + surcharge + cess;
    const taxesAlreadyPaid = this.clean(input.tdsDeducted) + this.clean(input.advanceTaxPaid);
    const netBalance = totalTax - taxesAlreadyPaid;

    return {
      regime,
      label: regime === 'old' ? 'Old Regime' : 'New Regime',
      salaryIncome: this.round2(salaryIncome),
      housePropertyIncome: this.round2(housePropertyIncome),
      businessAndOtherIncome: this.round2(businessAndOtherIncome),
      grossTotalIncome: this.round2(grossTotalIncome),
      standardDeduction: this.round2(standardDeduction),
      exemptionTotal: this.round2(exemptionTotal),
      chapterViaDeductions: this.round2(chapterViaDeductions),
      employerNpsDeduction: this.round2(employerNpsDeduction),
      taxableIncome: this.round2(taxableIncome),
      taxBeforeRebate: this.round2(taxBeforeRebate),
      rebate: this.round2(rebate),
      surcharge: this.round2(surcharge),
      cess: this.round2(cess),
      totalTax: this.round2(totalTax),
      taxesAlreadyPaid: this.round2(taxesAlreadyPaid),
      netPayable: netBalance > 0 ? this.round2(netBalance) : 0,
      refundDue: netBalance < 0 ? this.round2(Math.abs(netBalance)) : 0,
      deductionBreakdown: this.getDeductionBreakdown(input, regime),
      notes: this.getRegimeNotes(input, regime),
    };
  }

  private getStandardDeduction(input: TaxCalculatorInput, regime: 'old' | 'new'): number {
    if (input.employmentType !== 'salaried') return 0;
    return regime === 'old' ? 50000 : 75000;
  }

  private getFamilyPensionTaxable(input: TaxCalculatorInput, regime: 'old' | 'new'): number {
    const pension = this.clean(input.familyPension);
    if (!pension) return 0;
    const cap = regime === 'old' ? 15000 : 25000;
    const deduction = Math.min(pension / 3, cap);
    return Math.max(0, pension - deduction);
  }

  private getOldRegimeDeductions(input: TaxCalculatorInput): number {
    return this.getDeductionBreakdown(input, 'old').reduce((sum, item) => sum + item.amount, 0);
  }

  private getDeductionBreakdown(input: TaxCalculatorInput, regime: 'old' | 'new'): Array<{ label: string; amount: number }> {
    if (regime === 'new') {
      return [
        { label: 'Employer NPS u/s 80CCD(2)', amount: this.getEmployerNpsDeduction(input, 'new') },
      ].filter((item) => item.amount > 0);
    }

    const investment80C = Math.min(
      this.clean(input.epfContribution) +
      this.clean(input.ppfInvestment) +
      this.clean(input.elssInvestment) +
      this.clean(input.lifeInsurancePremium) +
      this.clean(input.housingPrincipalRepayment) +
      this.clean(input.taxSaverFd) +
      this.clean(input.nscInvestment) +
      this.clean(input.tuitionFees) +
      this.clean(input.other80C),
      150000
    );
    const selfInsuranceCap = input.ageCategory === 'below60' ? 25000 : 50000;
    const parentInsuranceCap = input.parentsAreSenior ? 50000 : 25000;
    const healthInsurance = Math.min(this.clean(input.healthInsuranceSelfFamily), selfInsuranceCap) +
      Math.min(this.clean(input.healthInsuranceParents), parentInsuranceCap);
    const savingsDeduction = input.ageCategory === 'below60'
      ? Math.min(this.clean(input.savingsInterest), 10000)
      : Math.min(this.clean(input.savingsInterest), 50000);
    const donationDeduction = this.clean(input.donationAmount) * (input.donationEligibility === '100' ? 1 : 0.5);

    return [
      { label: 'Section 80C investments', amount: investment80C },
      { label: 'Additional NPS u/s 80CCD(1B)', amount: Math.min(this.clean(input.npsAdditional), 50000) },
      { label: 'Employer NPS u/s 80CCD(2)', amount: this.getEmployerNpsDeduction(input, 'old') },
      { label: 'Health insurance u/s 80D', amount: healthInsurance },
      { label: 'Education loan interest u/s 80E', amount: this.clean(input.educationLoanInterest) },
      { label: 'Rent deduction u/s 80GG', amount: this.clean(input.rent80GG) },
      { label: 'Savings interest deduction', amount: savingsDeduction },
      { label: 'Donations u/s 80G', amount: donationDeduction },
      { label: 'Disability deduction', amount: this.getDisabilityDeduction(input.disabilityType) },
      { label: 'Other deductions', amount: this.clean(input.additionalDeductions) },
    ].filter((item) => item.amount > 0);
  }

  private getEmployerNpsDeduction(input: TaxCalculatorInput, regime: 'old' | 'new'): number {
    const salary = this.clean(input.grossSalary);
    const contribution = this.clean(input.employerNpsContribution);
    const capRate = regime === 'old' ? 0.1 : 0.14;
    return Math.min(contribution, salary * capRate);
  }

  private getTaxFromSlabs(taxableIncome: number, input: TaxCalculatorInput, regime: 'old' | 'new'): number {
    const slabs = regime === 'old' ? this.getOldRegimeSlabs(input.ageCategory) : this.getNewRegimeSlabs();
    let tax = 0;

    for (const slab of slabs) {
      if (taxableIncome <= slab.from) continue;
      const taxableAtThisRate = Math.min(taxableIncome, slab.to) - slab.from;
      tax += taxableAtThisRate * slab.rate;
      if (taxableIncome <= slab.to) break;
    }

    return tax;
  }

  private getOldRegimeSlabs(ageCategory: AgeCategory): Array<{ from: number; to: number; rate: number }> {
    if (ageCategory === 'superSenior') {
      return [
        { from: 0, to: 500000, rate: 0 },
        { from: 500000, to: 1000000, rate: 0.2 },
        { from: 1000000, to: Number.POSITIVE_INFINITY, rate: 0.3 },
      ];
    }

    if (ageCategory === 'senior') {
      return [
        { from: 0, to: 300000, rate: 0 },
        { from: 300000, to: 500000, rate: 0.05 },
        { from: 500000, to: 1000000, rate: 0.2 },
        { from: 1000000, to: Number.POSITIVE_INFINITY, rate: 0.3 },
      ];
    }

    return [
      { from: 0, to: 250000, rate: 0 },
      { from: 250000, to: 500000, rate: 0.05 },
      { from: 500000, to: 1000000, rate: 0.2 },
      { from: 1000000, to: Number.POSITIVE_INFINITY, rate: 0.3 },
    ];
  }

  private getNewRegimeSlabs(): Array<{ from: number; to: number; rate: number }> {
    return [
      { from: 0, to: 400000, rate: 0 },
      { from: 400000, to: 800000, rate: 0.05 },
      { from: 800000, to: 1200000, rate: 0.1 },
      { from: 1200000, to: 1600000, rate: 0.15 },
      { from: 1600000, to: 2000000, rate: 0.2 },
      { from: 2000000, to: 2400000, rate: 0.25 },
      { from: 2400000, to: Number.POSITIVE_INFINITY, rate: 0.3 },
    ];
  }

  private getRebate(taxableIncome: number, taxBeforeRebate: number, input: TaxCalculatorInput, regime: 'old' | 'new'): number {
    if (input.residencyStatus !== 'resident') return 0;

    if (regime === 'old' && taxableIncome <= 500000) {
      return Math.min(taxBeforeRebate, 12500);
    }

    if (regime === 'new' && taxableIncome <= 1200000) {
      return Math.min(taxBeforeRebate, 60000);
    }

    return 0;
  }

  private getSurcharge(taxAfterRebate: number, taxableIncome: number, regime: 'old' | 'new'): number {
    const rate = regime === 'old'
      ? taxableIncome > 50000000 ? 0.37
        : taxableIncome > 20000000 ? 0.25
        : taxableIncome > 10000000 ? 0.15
        : taxableIncome > 5000000 ? 0.1
        : 0
      : taxableIncome > 20000000 ? 0.25
        : taxableIncome > 10000000 ? 0.15
        : taxableIncome > 5000000 ? 0.1
        : 0;

    return taxAfterRebate * rate;
  }

  private getDisabilityDeduction(type: DisabilityType): number {
    if (type === 'disability') return 75000;
    if (type === 'severe') return 125000;
    return 0;
  }

  private buildSuggestions(
    input: TaxCalculatorInput,
    oldRegime: RegimeBreakdown,
    newRegime: RegimeBreakdown,
    recommendedRegime: 'old' | 'new'
  ): string[] {
    const suggestions: string[] = [];
    const eightyCUsed = Math.min(
      this.clean(input.epfContribution) +
      this.clean(input.ppfInvestment) +
      this.clean(input.elssInvestment) +
      this.clean(input.lifeInsurancePremium) +
      this.clean(input.housingPrincipalRepayment) +
      this.clean(input.taxSaverFd) +
      this.clean(input.nscInvestment) +
      this.clean(input.tuitionFees) +
      this.clean(input.other80C),
      150000
    );
    const eightyCGap = Math.max(0, 150000 - eightyCUsed);
    const npsGap = Math.max(0, 50000 - this.clean(input.npsAdditional));
    const selfInsuranceCap = input.ageCategory === 'below60' ? 25000 : 50000;
    const selfInsuranceGap = Math.max(0, selfInsuranceCap - this.clean(input.healthInsuranceSelfFamily));

    if (recommendedRegime === 'old' && oldRegime.totalTax < newRegime.totalTax) {
      suggestions.push(`Old regime currently saves about INR ${this.formatCurrency(newRegime.totalTax - oldRegime.totalTax)} based on your deductions and exemptions.`);
    }

    if (recommendedRegime === 'new' && newRegime.totalTax < oldRegime.totalTax) {
      suggestions.push(`New regime looks more efficient right now and saves about INR ${this.formatCurrency(oldRegime.totalTax - newRegime.totalTax)} versus old regime.`);
    }

    if (eightyCGap > 0) {
      suggestions.push(`You still have INR ${this.formatCurrency(eightyCGap)} available under Section 80C. PPF, ELSS, life insurance premium, housing principal, tax saver FD, or tuition fees may help if eligible.`);
    }

    if (npsGap > 0) {
      suggestions.push(`An additional NPS contribution up to INR ${this.formatCurrency(npsGap)} may be claimable under Section 80CCD(1B) in the old regime.`);
    }

    if (selfInsuranceGap > 0 && input.residencyStatus === 'resident') {
      suggestions.push(`Health insurance for self and family can still unlock up to INR ${this.formatCurrency(selfInsuranceGap)} more under Section 80D if applicable.`);
    }

    if (input.employmentType === 'salaried' && !this.clean(input.hraExemption) && !this.clean(input.otherExemptions)) {
      suggestions.push('If you receive HRA or other exempt allowances, add the eligible exemption values to improve the old regime calculation.');
    }

    if (this.clean(input.employerNpsContribution) > 0) {
      suggestions.push('Employer NPS contribution is tax-efficient in both regimes. Double-check the actual contribution from payroll or Form 16 so the deduction is fully captured.');
    }

    if (oldRegime.refundDue > 0 || newRegime.refundDue > 0) {
      const refund = Math.max(oldRegime.refundDue, newRegime.refundDue);
      suggestions.push(`Based on taxes already paid, you may be due a refund of about INR ${this.formatCurrency(refund)} under the more favorable regime.`);
    }

    if (!suggestions.length) {
      suggestions.push('Your current inputs are fairly optimized. Review exemptions, employer NPS, and any missed Chapter VI-A deductions before filing.');
    }

    return suggestions;
  }

  private getRegimeNotes(input: TaxCalculatorInput, regime: 'old' | 'new'): string[] {
    const notes = [
      regime === 'new'
        ? 'New regime calculation uses the FY 2025-26 slab structure announced in Union Budget 2025, including standard deduction of INR 75,000 for salaried taxpayers.'
        : 'Old regime calculation keeps the classic slab structure and allows exemptions plus Chapter VI-A deductions.',
      'Self-occupied home loan interest is modeled under old regime only; let-out property adjustments should be captured in net house property income.',
      'Special-rate capital gains, AMT, marginal relief, and complex 80G qualifying-limit cases are not modeled separately in this version.',
    ];

    if (input.residencyStatus !== 'resident') {
      notes.push('Resident-only rebates under Section 87A are not applied for non-resident status.');
    }

    return notes;
  }

  private captureIfMatch(
    candidates: Map<string, number>,
    matchedItems: Array<{ label: string; value: number }>,
    labelText: string,
    amount: number
  ): void {
    const patterns: Array<{ key: string; test: RegExp }> = [
      { key: 'grossSalary', test: /gross salary/ },
      { key: 'salary17_1', test: /section 17\(1\)|17\(1\).*salary|salary as per provisions/ },
      { key: 'perquisites', test: /perquisites|17\(2\)/ },
      { key: 'allowanceExempt', test: /allowances?.*exempt|section 10/ },
      { key: 'professionalTax', test: /professional tax|tax on employment/ },
      { key: 'tds', test: /tax deducted|tds/ },
      { key: 'providentFund80c', test: /provident fund|80c/ },
      { key: 'lifeInsurance80c', test: /life insurance/ },
      { key: 'nps80ccd1b', test: /80ccd\(1b\)|nps/ },
      { key: 'healthInsurance80d', test: /80d|health insurance|medical insurance/ },
      { key: 'otherSources', test: /income from other sources|other sources/ },
      { key: 'grossTotalIncomeOther', test: /gross total income/ },
    ];

    for (const pattern of patterns) {
      if (pattern.test.test(labelText)) {
        candidates.set(pattern.key, amount);
        matchedItems.push({ label: pattern.key, value: amount });
      }
    }
  }

  private assignIfPresent(
    target: Partial<TaxCalculatorInput>,
    field: NumericFieldKey,
    source: Map<string, number>,
    candidateKeys: string[]
  ): void {
    for (const key of candidateKeys) {
      const value = source.get(key);
      if (value !== undefined) {
        target[field] = value as TaxCalculatorInput[typeof field];
        return;
      }
    }
  }

  private parseAmount(value: string): number | null {
    const normalized = value.replace(/,/g, '').replace(/inr/gi, '').trim();
    if (!normalized) return null;
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
    return Number(normalized);
  }

  private clean(value: number): number {
    return Number.isFinite(value) ? Math.max(value, -999999999) : 0;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(value));
  }
}
