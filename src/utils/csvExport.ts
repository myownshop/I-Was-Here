import { Attendee, Campaign, Organization } from '../types/attendance';

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

  // Define comprehensive columns
  const headers = [
    'S/N',
    'State Code / ID',
    'Full Name',
    'Date',
    'Time (UTC)',
    'Local Time',
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
    const dateStr = !isNaN(dateObj.getTime())
      ? dateObj.toISOString().split('T')[0]
      : att.timestamp;
    const timeUtc = !isNaN(dateObj.getTime())
      ? dateObj.toISOString().split('T')[1].replace('Z', '')
      : 'N/A';
    const localTimeStr = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'N/A';

    return [
      escapeCsvCell(index + 1),
      escapeCsvCell(att.stateCode),
      escapeCsvCell(att.name),
      escapeCsvCell(dateStr),
      escapeCsvCell(timeUtc),
      escapeCsvCell(localTimeStr),
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

  // Generate clean, descriptive filename: e.g. Attendance_Ikeja_med24_2026-09-22.csv
  const sanitizedOrg = (organization?.name || 'Org')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 20);
  const sanitizedCode = campaign?.shortCode || 'session';
  const todayStr = new Date().toISOString().split('T')[0];
  const filename = `Attendance_${sanitizedOrg}_${sanitizedCode}_${todayStr}.csv`;

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
