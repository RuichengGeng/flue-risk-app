import { NotImplementedCapabilityError } from '../shared/not-implemented.ts';
import type { ReportRequest, ReportResult } from './schemas.ts';

export class ReportingService {
  async create(_input: ReportRequest): Promise<ReportResult> {
    throw new NotImplementedCapabilityError('ReportingService.create');
  }
}

export const reportingService = new ReportingService();
