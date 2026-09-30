import { describe, it, expect } from 'vitest';
import { parseCampaignDoc } from './firebase';
import { toDateTimeLocalInputString, parseCampaignDate } from '../utils/dateUtils';
import { Campaign } from '../types/attendance';

describe('Campaign Automated Scheduling & Timer Engine', () => {
  it('should parse raw Firestore document with Timestamp object into ISO string', () => {
    // Firestore Timestamp mock: seconds 1790500000 = 2026-09-27T09:06:40.000Z
    const mockData = {
      name: 'Batch B CDS Meeting',
      orgId: 'org_123',
      date: '2026-09-27',
      targetLatitude: 6.5244,
      targetLongitude: 3.3792,
      allowedRadius: 100,
      shortCode: 'abc12',
      startTime: { seconds: 1790500000, nanoseconds: 0 },
      endTime: { seconds: 1790514400, nanoseconds: 0 },
      createdAt: '2026-09-27T07:00:00.000Z',
      status: 'active',
      isClosed: false,
    };

    const campaign = parseCampaignDoc('camp_test_1', mockData);
    expect(campaign.id).toBe('camp_test_1');
    expect(campaign.startTime).toBeDefined();
    expect(campaign.endTime).toBeDefined();
    expect(typeof campaign.startTime).toBe('string');
    expect(typeof campaign.endTime).toBe('string');

    // Should convert to valid datetime-local input string without throwing
    const localInputStart = toDateTimeLocalInputString(campaign.startTime);
    expect(localInputStart).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('should preserve and parse ISO string timestamps from local cache', () => {
    const mockData = {
      name: 'Editorial CDS Plenary',
      orgId: 'org_editorial',
      date: '2026-09-27',
      startTime: '2026-09-27T08:30:00.000Z',
      endTime: '2026-09-27T11:30:00.000Z',
    };

    const campaign = parseCampaignDoc('camp_test_2', mockData);
    expect(campaign.startTime).toBe('2026-09-27T08:30:00.000Z');
    expect(campaign.endTime).toBe('2026-09-27T11:30:00.000Z');
  });

  it('should gracefully handle campaigns with no schedule window set', () => {
    const mockData = {
      name: 'Unscheduled Session',
      orgId: 'org_123',
      date: '2026-09-27',
    };

    const campaign = parseCampaignDoc('camp_test_3', mockData);
    expect(campaign.startTime).toBeUndefined();
    expect(campaign.endTime).toBeUndefined();
    expect(toDateTimeLocalInputString(campaign.startTime)).toBe('');
  });

  it('should format datetime-local strings preserving local time', () => {
    const rawLocalString = '2026-09-27T08:30';
    const result = toDateTimeLocalInputString(rawLocalString);
    expect(result).toBe('2026-09-27T08:30');
  });
});
