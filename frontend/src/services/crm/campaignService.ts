import { z } from 'zod';
import api from '@/services/api';
const BASE = '/crm/campaigns';
export const launchCampaignSchema = z.object({ segment: z.enum(['VIP', 'LOYAL', 'AT_RISK', 'DORMANT', 'CHURNED', 'NEW', 'REGULAR']), channel: z.enum(['WHATSAPP', 'EMAIL', 'SMS']), message: z.string().min(5, 'Mensaje mínimo 5 caracteres').max(2000), limit: z.number().int().min(1).max(500).default(200) });
export type LaunchCampaignInput = z.infer<typeof launchCampaignSchema>;
export interface CampaignResult { success: boolean; sent: number; failed: number; skipped: number; }
export const campaignService = {
  async launch(input: LaunchCampaignInput): Promise<CampaignResult> { const parsed = launchCampaignSchema.parse(input); const { data } = await api.post<CampaignResult>(BASE, parsed); return data; },
};
