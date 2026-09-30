import { describe, it, expect } from 'vitest';
import { CATEGORY_PRESETS, CategoryPreset } from './AuthPage';

describe('AuthPage Category Data Pool & Presets', () => {
  it('contains comprehensive category presets in CATEGORY_PRESETS', () => {
    expect(CATEGORY_PRESETS.length).toBeGreaterThanOrEqual(10);
  });

  it('ensures each category preset defines valid nomenclature and theme colors', () => {
    const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

    CATEGORY_PRESETS.forEach((preset: CategoryPreset) => {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.userLabel).toBeTruthy();
      expect(preset.idLabel).toBeTruthy();
      expect(preset.sessionLabel).toBeTruthy();
      expect(preset.defaultColor).toMatch(hexRegex);
      expect(preset.tagline).toBeTruthy();
    });
  });

  it('matches key domain archetypes like NYSC, Security, and Education', () => {
    const nysc = CATEGORY_PRESETS.find((c) => c.id === 'nysc');
    expect(nysc).toBeDefined();
    expect(nysc?.userLabel).toBe('Corper');
    expect(nysc?.idLabel).toBe('State Code');
    expect(nysc?.sessionLabel).toBe('CDS Meeting');

    const security = CATEGORY_PRESETS.find((c) => c.id === 'security');
    expect(security).toBeDefined();
    expect(security?.userLabel).toBe('Guard');
    expect(security?.sessionLabel).toBe('Shift Patrol');

    const edu = CATEGORY_PRESETS.find((c) => c.id === 'education');
    expect(edu).toBeDefined();
    expect(edu?.userLabel).toBe('Student');
    expect(edu?.idLabel).toBe('Matric Number');
  });

  it('filters categories correctly based on query search', () => {
    const query = 'guard';
    const matches = CATEGORY_PRESETS.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.userLabel.toLowerCase().includes(query) ||
        c.sessionLabel.toLowerCase().includes(query)
    );
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((c) => c.id === 'security')).toBe(true);
  });
});
