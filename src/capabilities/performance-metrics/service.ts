import { NotImplementedCapabilityError } from '../shared/not-implemented.ts';
import type { PerformanceMetricsInput, PerformanceMetricsResult } from './schemas.ts';

export class PerformanceMetricsService {
  async calculate(_input: PerformanceMetricsInput): Promise<PerformanceMetricsResult> {
    throw new NotImplementedCapabilityError('PerformanceMetricsService.calculate');
  }
}

export const performanceMetricsService = new PerformanceMetricsService();
