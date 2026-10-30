import { PrescriptionItem, SafetyCheckRecord, DrugInteractionAlert } from '../types';
import { API_BASE_URL } from '../config/api';

export interface MedicationScheduleItem {
  id: string;
  checkId: string;
  patientName: string;
  patientMrn: string;
  drugName: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  scheduledTime: string;
  foodInstruction: string;
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'bedtime' | 'as_needed';
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isExpired: boolean;
  timestamp: string;
}

export interface UnifiedQueueItem {
  id: string;
  checkId: string;
  patientName: string;
  mrn: string;
  type: 'safety_hazard' | 'intake_schedule' | 'course_expiry';
  title: string;
  subtitle: string;
  severity: 'contraindicated' | 'major' | 'moderate' | 'info';
  timestamp: string;
  scheduledTime?: string;
  foodInstruction?: string;
  drugName?: string;
  interactingDrugs?: string[];
  daysRemaining?: number;
  isExpired?: boolean;
  alert?: DrugInteractionAlert;
  medication?: MedicationScheduleItem;
}

/**
 * Parses exact timing and food instructions from clinical prescription strings.
 */
export function parseMedicationTiming(freqStr: string = '', drugName: string = ''): {
  scheduledTime: string;
  foodInstruction: string;
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'bedtime' | 'as_needed';
} {
  const f = freqStr.toUpperCase();
  const nameLower = drugName.toLowerCase();

  // Check explicit hour markers
  if (f.includes('7 AM') || f.includes('7:00 AM') || f.includes('07:00')) {
    return {
      scheduledTime: '07:00 AM',
      foodInstruction: 'Before Food (AC - Empty Stomach)',
      timeSlot: 'morning',
    };
  }
  if (f.includes('6 PM') || f.includes('6:00 PM') || f.includes('18:00')) {
    return {
      scheduledTime: '06:00 PM',
      foodInstruction: 'Before Evening Dinner (AC)',
      timeSlot: 'evening',
    };
  }
  if (f.includes('HS') || f.includes('BEDTIME') || nameLower.includes('petril') || nameLower.includes('clonazepam')) {
    return {
      scheduledTime: '10:00 PM',
      foodInstruction: 'At Bedtime (Before Sleep)',
      timeSlot: 'bedtime',
    };
  }
  if (f.includes('BD') || f.includes('TWICE') || f.includes('BID')) {
    return {
      scheduledTime: '09:00 AM & 09:00 PM',
      foodInstruction: 'Twice Daily After Meals (PC)',
      timeSlot: 'morning',
    };
  }
  if (f.includes('TID') || f.includes('THRICE') || f.includes('TDS')) {
    return {
      scheduledTime: '08:00 AM, 02:00 PM, 08:00 PM',
      foodInstruction: 'With Meals (Morning, Afternoon, Night)',
      timeSlot: 'afternoon',
    };
  }
  if (f.includes('QID')) {
    return {
      scheduledTime: 'Every 6 Hours',
      foodInstruction: 'Evenly spaced throughout the day',
      timeSlot: 'morning',
    };
  }
  if (f.includes('PRN') || f.includes('SOS') || f.includes('AS NEEDED')) {
    return {
      scheduledTime: 'As Needed (PRN)',
      foodInstruction: 'Take only when experiencing acute symptoms',
      timeSlot: 'as_needed',
    };
  }
  if (f.includes('AC') || f.includes('BEFORE FOOD')) {
    return {
      scheduledTime: '07:30 AM',
      foodInstruction: 'Before Breakfast (AC - Empty Stomach)',
      timeSlot: 'morning',
    };
  }

  // Default morning maintenance
  return {
    scheduledTime: '08:30 AM',
    foodInstruction: 'After Breakfast (PC)',
    timeSlot: 'morning',
  };
}

/**
 * Parses duration in days from strings like '1 Month', '30 Days', '5 Days'.
 */
export function parseDurationDays(durationStr: string = '1 Month'): number {
  const d = durationStr.toLowerCase().trim();
  if (d.includes('month')) {
    const num = parseInt(d.match(/\d+/)?.[0] || '1', 10);
    return num * 30;
  }
  if (d.includes('week')) {
    const num = parseInt(d.match(/\d+/)?.[0] || '1', 10);
    return num * 7;
  }
  if (d.includes('day')) {
    return parseInt(d.match(/\d+/)?.[0] || '30', 10);
  }
  return 30; // standard default
}

/**
 * Calculates start date, end date, and days remaining for a regimen.
 */
export function computeCourseDates(durationStr: string = '1 Month', createdIso?: string) {
  const days = parseDurationDays(durationStr);
  const start = createdIso ? new Date(createdIso) : new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

  const now = Date.now();
  const diffDays = Math.ceil((end.getTime() - now) / (1000 * 60 * 60 * 24));
  const isExpired = diffDays <= 0;

  return {
    startDate: start.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
    endDate: end.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
    daysRemaining: Math.max(0, diffDays),
    isExpired,
  };
}

/**
 * Aggregates all checks into a rich Unified Queue containing:
 * - Safety hazard contraindications & major interactions
 * - Medication intake schedule timing alerts
 * - Regimen course expiration notices
 */
export function buildUnifiedAlertQueue(checks: SafetyCheckRecord[]): UnifiedQueueItem[] {
  const queue: UnifiedQueueItem[] = [];

  (checks || []).forEach((c) => {
    const patientName = c.patientName || 'Unknown Patient';
    const mrn = c.mrn || 'N/A';
    const checkId = c.id;
    const checkTimestamp = c.timestamp || 'Recent';

    // 1. Safety Alerts (Contraindications & Major Warnings)
    (c.alerts || []).forEach((al) => {
      const interacting = Array.isArray(al.interactingDrugs) ? al.interactingDrugs : [];
      queue.push({
        id: al.id || `al-${checkId}-${Math.random().toString(36).substring(2, 7)}`,
        checkId,
        patientName,
        mrn,
        type: 'safety_hazard',
        title: al.title || 'Pharmacological Interaction Hazard',
        subtitle: al.mechanism || al.description || 'Clinical safety rule violation.',
        severity: (al.severity as any) || 'major',
        timestamp: checkTimestamp,
        interactingDrugs: interacting,
        alert: al,
      });
    });

    // 2. Medication Timing & Intake Schedule Alerts
    (c.prescriptions || []).forEach((rx) => {
      const drugName = rx.drugName || (rx as any).name || 'Prescription Medication';
      const dosage = rx.dosage || '';
      const freq = rx.frequency || 'OD';
      const duration = rx.duration || '1 Month';
      const timingInfo = parseMedicationTiming(freq, drugName);
      const course = computeCourseDates(duration, c.createdAt);

      const medSchedule: MedicationScheduleItem = {
        id: `sched-${checkId}-${rx.id || Math.random().toString(36).substring(2, 7)}`,
        checkId,
        patientName,
        patientMrn: mrn,
        drugName,
        dosage,
        frequency: freq,
        route: rx.route || 'Oral (PO)',
        duration,
        scheduledTime: timingInfo.scheduledTime,
        foodInstruction: timingInfo.foodInstruction,
        timeSlot: timingInfo.timeSlot,
        startDate: course.startDate,
        endDate: course.endDate,
        daysRemaining: course.daysRemaining,
        isExpired: course.isExpired,
        timestamp: checkTimestamp,
      };

      // Intake Schedule Card
      queue.push({
        id: medSchedule.id,
        checkId,
        patientName,
        mrn,
        type: 'intake_schedule',
        title: `${drugName} ${dosage} — Scheduled for ${timingInfo.scheduledTime}`,
        subtitle: `${timingInfo.foodInstruction} • Frequency: ${freq} • Route: ${rx.route || 'Oral'}`,
        severity: 'info',
        timestamp: checkTimestamp,
        scheduledTime: timingInfo.scheduledTime,
        foodInstruction: timingInfo.foodInstruction,
        drugName,
        daysRemaining: course.daysRemaining,
        isExpired: course.isExpired,
        medication: medSchedule,
      });

      // Course Expiry / Stop Eating Notice
      queue.push({
        id: `exp-${medSchedule.id}`,
        checkId,
        patientName,
        mrn,
        type: 'course_expiry',
        title: course.isExpired
          ? `${drugName}: Course Completed — STOP Eating This Medication`
          : `${drugName}: Regimen Duration — ${course.daysRemaining} Days Remaining (Stops on ${course.endDate})`,
        subtitle: course.isExpired
          ? `Prescribed ${duration} duration has elapsed. Clinician review required before continuation.`
          : `Do not consume past ${course.endDate}. Discontinue automatically once course is finished.`,
        severity: course.isExpired ? 'contraindicated' : 'moderate',
        timestamp: checkTimestamp,
        drugName,
        daysRemaining: course.daysRemaining,
        isExpired: course.isExpired,
        medication: medSchedule,
      });
    });
  });

  return queue;
}

/**
 * Dispatches verified daily medication timetable and safety alert schedule to email.
 */
export async function dispatchScheduleAlertEmail(payload: {
  to_email: string;
  patient_name: string;
  patient_mrn?: string;
  clinician_name?: string;
  check_number?: string;
  schedule_date?: string;
  course_end_date?: string;
  regimen_duration?: string;
  medications: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    scheduledTime?: string;
    foodInstruction?: string;
    duration?: string;
  }>;
  safety_alerts?: Array<{
    title: string;
    recommendation?: string;
    severity?: string;
  }>;
  notary_hash?: string;
  portal_url?: string;
}): Promise<{ status: string; message: string; delivered: boolean }> {
  if (!API_BASE_URL) {
    return {
      status: 'success',
      message: `Offline mode: Schedule alert staged for ${payload.to_email}`,
      delivered: false,
    };
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/send-schedule-alert-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || 'Failed to dispatch medication schedule alert email');
  }

  return await res.json();
}

export interface SavedDoctorContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  specialty?: string;
  lastUsed: number;
}

const DEFAULT_DOCTORS: SavedDoctorContact[] = [
  { id: 'doc-1', name: 'Dr. Rajiv Mehta, MD', email: 'dr.rajivmehta@smileclinic.com', specialty: 'General Physician', lastUsed: Date.now() - 86400000 },
  { id: 'doc-2', name: 'Dr. Anita Verma, MBBS', email: 'dr.anitaverma@smileclinic.com', specialty: 'Internal Medicine Lead', lastUsed: Date.now() - 172800000 },
  { id: 'doc-3', name: 'Dr. Sanjeev Saxena, MDS', email: 'support.smileclinic@gmail.com', specialty: 'Oral & Maxillofacial Surgeon', lastUsed: Date.now() - 3600000 },
];

export function getSavedDoctors(userEmail?: string): SavedDoctorContact[] {
  if (typeof window === 'undefined') return DEFAULT_DOCTORS;
  try {
    const key = 'smileclinic_doctors_' + (userEmail || 'default').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const raw = localStorage.getItem(key) || localStorage.getItem('smileclinic_saved_doctors_directory');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_DOCTORS;
}

export function saveDoctorContact(
  doctor: { name: string; email: string; phone?: string; specialty?: string },
  userEmail?: string
): SavedDoctorContact[] {
  if (typeof window === 'undefined') return DEFAULT_DOCTORS;
  try {
    const current = getSavedDoctors(userEmail);
    const cleanEmail = doctor.email.trim().toLowerCase();
    const cleanName = doctor.name.trim();
    if (!cleanEmail) return current;

    const filtered = current.filter((d) => d.email.toLowerCase() !== cleanEmail);
    const updated: SavedDoctorContact[] = [
      {
        id: 'doc-' + Date.now(),
        name: cleanName || cleanEmail,
        email: cleanEmail,
        phone: doctor.phone,
        specialty: doctor.specialty || 'Consulting Physician',
        lastUsed: Date.now(),
      },
      ...filtered,
    ].slice(0, 20);

    const key = 'smileclinic_doctors_' + (userEmail || 'default').toLowerCase().replace(/[^a-z0-9]/g, '_');
    localStorage.setItem(key, JSON.stringify(updated));
    localStorage.setItem('smileclinic_saved_doctors_directory', JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_DOCTORS;
  }
}

export async function dispatchDoctorConsultEmail(payload: {
  to_doctor_email: string;
  doctor_name: string;
  patient_name: string;
  patient_mrn?: string;
  check_number?: string;
  alert_title: string;
  severity: string;
  interacting_drugs: string[];
  clinical_mechanism: string;
  substituted_medication?: string;
  rationale: string;
  clinician_name?: string;
  clinician_email?: string;
  notary_hash?: string;
  portal_url?: string;
}): Promise<{ status: string; message: string; delivered: boolean }> {
  if (!API_BASE_URL) {
    return {
      status: 'success',
      message: 'Offline mode: Doctor consult email staged for Dr. ' + payload.doctor_name + ' (' + payload.to_doctor_email + ')',
      delivered: false,
    };
  }

  const res = await fetch(API_BASE_URL + '/api/v1/auth/send-doctor-consult-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || 'Failed to dispatch doctor consultation email');
  }

  return await res.json();
}

