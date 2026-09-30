import { describe, it, expect } from 'vitest';
import {
  AUDIENCE_SEGMENTS,
  DEFAULT_SEGMENT_ID,
  getSegmentById,
} from './audienceSegments';

describe('Audience Segments Configuration', () => {
  it('defines default segment as nysc_cds', () => {
    expect(DEFAULT_SEGMENT_ID).toBe('nysc_cds');
  });

  it('contains all 6 expected organization types', () => {
    const ids = AUDIENCE_SEGMENTS.map((s) => s.id);
    expect(ids).toEqual(['nysc_cds', 'church', 'school', 'company', 'event', 'other']);
  });

  it('provides authentic non-generic copy and accent colors for each segment', () => {
    AUDIENCE_SEGMENTS.forEach((segment) => {
      expect(segment.id).toBeTruthy();
      expect(segment.label).toBeTruthy();
      expect(segment.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(segment.headlineProof).toBeTruthy();
      expect(segment.headlineProof.length).toBeGreaterThan(20);
      expect(segment.exampleSteps.length).toBeGreaterThanOrEqual(3);
      segment.exampleSteps.forEach((step) => {
        expect(step.length).toBeGreaterThan(15);
      });
      expect(segment.exampleImageAlt).toBeTruthy();
      expect(segment.pageTitle).toContain('IWasHere for');
      expect(segment.metaDescription).toBeTruthy();
    });
  });

  it('returns default segment when unknown id is passed to getSegmentById', () => {
    const unknown = getSegmentById('nonexistent_id');
    expect(unknown.id).toBe('nysc_cds');
  });

  it('retrieves church and school segments correctly', () => {
    const church = getSegmentById('church');
    expect(church.label).toBe('Churches');
    expect(church.exampleSteps[0]).toContain('Sunday service check-in QR');

    const school = getSegmentById('school');
    expect(school.label).toBe('Schools & Universities');
    expect(school.exampleSteps[1]).toContain('Matric Number');
  });
});
