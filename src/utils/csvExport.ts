import { Attendee, Campaign, Organization } from '../types/attendance';
import { formatWATDate, formatWATTime, getTodayWATDateString, getWATDateString } from './dateUtils';

/**
 * Escapes fields for CSV according to RFC 4180 rules.
 */
function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  // If string contains comma, double-quote, or newline, escape double quotes and wrap in quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Exports current attendee records to a formatted CSV file and triggers browser download.
 */
export function exportAttendeesToCsv({
  attendees,
  campaign,
  organization,
}: {
  attendees: Attendee[];
  campaign: Campaign | null;
  organization: Organization | null;
}): { success: boolean; count: number; filename: string } {
  const allowedRadius = campaign?.allowedRadius || 100;

  // Define comprehensive columns explicitly highlighting West Africa Time (WAT)
  const headers = [
    'S/N',
    'State Code / ID',
    'Full Name',
    'Date (WAT)',
    'Time (WAT - West Africa Time)',
    'Time (UTC)',
    'Geofence Compliant',
    'Distance (Meters)',
    'Allowed Radius (Meters)',
    'Latitude',
    'Longitude',
    'Capture Mode',
    'Verified Biometric',
    'Logged IP',
    'Session Name',
    'Session Code',
    'Organization',
    'Attendee Record ID',
  ];

  const rows = attendees.map((att, index) => {
    const isCompliant = att.distanceMeters <= allowedRadius;
    const dateObj = new Date(att.timestamp);
    const isValidDate = !isNaN(dateObj.getTime());

    const dateWatStr = isValidDate ? getWATDateString(dateObj) : att.timestamp;
    const timeWatStr = isValidDate ? formatWATTime(dateObj, { includeSeconds: true, includeTimezone: true }) : 'N/A';
    const timeUtc = isValidDate
      ? dateObj.toISOString().split('T')[1].replace('Z', '')
      : 'N/A';

    return [
      escapeCsvCell(index + 1),
      escapeCsvCell(att.stateCode),
      escapeCsvCell(att.name),
      escapeCsvCell(dateWatStr),
      escapeCsvCell(timeWatStr),
      escapeCsvCell(timeUtc),
      escapeCsvCell(isCompliant ? 'PASS' : 'FLAGGED'),
      escapeCsvCell(Math.round(att.distanceMeters)),
      escapeCsvCell(allowedRadius),
      escapeCsvCell(att.latitude),
      escapeCsvCell(att.longitude),
      escapeCsvCell(att.isOfflineSync ? 'Offline (.iwh Sync)' : 'Direct Web Verification'),
      escapeCsvCell(att.verified ? 'YES' : 'NO'),
      escapeCsvCell(att.loggedIp),
      escapeCsvCell(campaign?.name || 'Attendance Session'),
      escapeCsvCell(campaign?.shortCode || ''),
      escapeCsvCell(organization?.name || 'Organization'),
      escapeCsvCell(att.id),
    ].join(',');
  });

  // Assemble CSV with UTF-8 BOM for Microsoft Excel compatibility
  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // Generate clean, descriptive filename with WAT today date: e.g. Attendance_Ikeja_med24_2026-09-22.csv
  const sanitizedOrg = (organization?.name || 'Org')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 20);
  const sanitizedCode = campaign?.shortCode || 'session';
  const todayStr = getTodayWATDateString();
  const filename = `Attendance_${sanitizedOrg}_${sanitizedCode}_${todayStr}_WAT.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    success: true,
    count: attendees.length,
    filename,
  };
}
