import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'heavyCalc',
  standalone: true,
  pure: true
})
export class HeavyCalcPipe implements PipeTransform {
  transform(value: any): string {
    if (value === null || value === undefined) return '';
    
    // Perform a CPU-heavy calculation to simulate slow formatting
    const num = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
    let result = 0;
    
    // Heavy loop: 1500 iterations of Math calculations
    for (let i = 0; i < 1500; i++) {
      result += Math.sin(num + i) * Math.cos(num - i);
    }
    
    return result.toFixed(2);
  }
}
