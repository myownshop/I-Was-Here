import { OrganizationType } from '../types/attendance';

export interface AudienceSegment {
  id: OrganizationType;
  label: string;
  accentColor: string;
  headlineProof: string;
  exampleSteps: string[];
  exampleImageAlt: string;
  pageTitle: string;
  metaDescription: string;
}

export const DEFAULT_SEGMENT_ID: OrganizationType = 'nysc_cds';

export const AUDIENCE_SEGMENTS: AudienceSegment[] = [
  {
    id: 'nysc_cds',
    label: 'NYSC CDS',
    accentColor: '#00FF66',
    headlineProof: 'Built for NYSC CDS groups tired of fake sign-in sheets and proxy clearance signatures',
    exampleSteps: [
      'Coordinator displays live QR code with strict 50m secretariat geofence',
      'Corps member scans QR, takes selfie check, and enters State Code (e.g. LA/24A/1234)',
      'Clearance roll call locks automatically and exports directly to CDS records',
    ],
    exampleImageAlt: 'Screenshot showing NYSC CDS roll call verification screen with state code input and geofence radius',
    pageTitle: 'IWasHere for NYSC CDS — Attendance Made Simple',
    metaDescription: 'Location-verified attendance and anti-proxy clearance roll calls for NYSC CDS groups and local government secretariats.',
  },
  {
    id: 'church',
    label: 'Churches',
    accentColor: '#38BDF8',
    headlineProof: 'Built for churches tracking Sunday service attendance and workforce muster across departments',
    exampleSteps: [
      'Usher displays Sunday service check-in QR at sanctuary entrance and foyer',
      'Member scans code on arrival, verifies presence, and selects their fellowship unit or choir department',
      'Pastoral team views real-time attendance dashboard and follow-up rosters before service ends',
    ],
    exampleImageAlt: 'Screenshot showing church Sunday service check-in interface with department selection and presence verification',
    pageTitle: 'IWasHere for Churches — Attendance Made Simple',
    metaDescription: 'Track Sunday service attendance, departmental workforce muster, and first-timer check-ins with verified location tracking.',
  },
  {
    id: 'school',
    label: 'Schools & Universities',
    accentColor: '#A78BFA',
    headlineProof: 'Built for universities and schools ending proxy roll call in crowded lecture halls',
    exampleSteps: [
      'Lecturer projects dynamic classroom QR with geofencing restricted to the lecture theatre',
      'Student scans QR from their seat, inputs Matric Number, and verifies via quick selfie check',
      'Audit log records seat presence timestamp and flags students outside the classroom boundary',
    ],
    exampleImageAlt: 'Screenshot showing university lecture hall attendance check with matriculation number verification',
    pageTitle: 'IWasHere for Schools & Universities — Attendance Made Simple',
    metaDescription: 'Stop lecture proxy attendance in crowded classrooms with geofenced roll call and verified matric number check-ins.',
  },
  {
    id: 'company',
    label: 'Offices & Companies',
    accentColor: '#F59E0B',
    headlineProof: 'Built for businesses needing verified clock-in for office staff, warehouse shifts, and site crews',
    exampleSteps: [
      'Operations manager sets office geofence and daily shift schedule',
      'Employee clocks in on arrival with biometric selfie verification and location confirmation',
      'HR instantly reviews daily muster roll, late arrivals, and timesheet exports',
    ],
    exampleImageAlt: 'Screenshot showing corporate employee clock-in dashboard with geofence audit and shift timestamps',
    pageTitle: 'IWasHere for Companies — Attendance Made Simple',
    metaDescription: 'Reliable staff clock-in and timesheet verification with sub-100m geofencing and anti-buddy punching protection.',
  },
  {
    id: 'event',
    label: 'Conferences & Events',
    accentColor: '#F43F5E',
    headlineProof: 'Built for event organizers ensuring only badge holders inside the venue get accredited',
    exampleSteps: [
      'Accreditation desk shows session QR at the convention hall entrance',
      'Delegate scans badge QR, verifies presence within the hall, and gets instant clearance',
      'Organizers monitor hall capacity, delegate headcount, and workshop attendance live',
    ],
    exampleImageAlt: 'Screenshot showing conference delegate accreditation and hall capacity check-in screen',
    pageTitle: 'IWasHere for Events & Conferences — Attendance Made Simple',
    metaDescription: 'Accredited delegate check-in and session attendance verification for summits, seminars, and expos.',
  },
  {
    id: 'other',
    label: 'Other Organizations',
    accentColor: '#06B6D4',
    headlineProof: 'Built for field teams, security posts, and community groups demanding tamper-proof roll call',
    exampleSteps: [
      'Supervisor deploys roll call QR code at the designated field outpost or checkpoint',
      'Member scans, confirms GPS coordinates, and records verified face check',
      'Encrypted attendance record syncs to supervisor roster even without immediate internet reception',
    ],
    exampleImageAlt: 'Screenshot showing custom organization attendance check with verified GPS coordinates and offline fallback',
    pageTitle: 'IWasHere for Organizations — Attendance Made Simple',
    metaDescription: 'Tamper-proof location verification, offline encrypted sync, and anti-proxy attendance for any organization.',
  },
];

export function getSegmentById(id?: string): AudienceSegment {
  return AUDIENCE_SEGMENTS.find((s) => s.id === id) || AUDIENCE_SEGMENTS[0];
}
