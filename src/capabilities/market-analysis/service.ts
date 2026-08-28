import { NotImplementedCapabilityError } from '../shared/not-implemented.ts';
import type { MarketAnalysisInput, MarketAnalysisResult } from './schemas.ts';

export class MarketAnalysisService {
  async analyze(_input: MarketAnalysisInput): Promise<MarketAnalysisResult> {
    throw new NotImplementedCapabilityError('MarketAnalysisService.analyze');
  }
}

export const marketAnalysisService = new MarketAnalysisService();
