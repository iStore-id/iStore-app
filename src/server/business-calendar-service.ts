import { DateTime, Interval } from "luxon";
import { adminDb } from "./firebase-admin";
import { BusinessCalendarConfig, CalendarException, TimeWindow, DaySchedule } from "../types/core";

export class BusinessCalendarService {
  private static instance: BusinessCalendarService;
  private config: BusinessCalendarConfig | null = null;
  private exceptions: CalendarException[] = [];
  private lastLoaded: number = 0;
  private CACHE_TTL = 60000; // 1 minute cache

  private constructor() {}

  static getInstance(): BusinessCalendarService {
    if (!BusinessCalendarService.instance) {
      BusinessCalendarService.instance = new BusinessCalendarService();
    }
    return BusinessCalendarService.instance;
  }

  async ensureLoaded() {
    const now = Date.now();
    if (!this.config || (now - this.lastLoaded > this.CACHE_TTL)) {
      await this.loadConfig();
    }
  }

  async loadConfig() {
    const configDoc = await adminDb.collection("businessCalendarConfig").doc("default").get();
    if (configDoc.exists) {
      this.config = configDoc.data() as BusinessCalendarConfig;
    } else {
      // Default config: Asia/Jakarta, 08:00 - 22:00 every day
      const defaultSchedule: Record<number, DaySchedule> = {};
      for (let i = 0; i < 7; i++) {
        defaultSchedule[i] = { isEnabled: true, windows: [{ open: "08:00", close: "22:00" }] };
      }
      this.config = {
        timezone: "Asia/Jakarta",
        weeklySchedule: defaultSchedule,
        updatedAt: new Date().toISOString(),
        updatedBy: "system"
      };
    }

    const exceptionsSnap = await adminDb.collection("businessCalendarExceptions")
      .where("isEnabled", "==", true)
      .get();
    this.exceptions = exceptionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarException));
    this.lastLoaded = Date.now();
  }

  getTimezone(): string {
    return this.config?.timezone || "Asia/Jakarta";
  }

  isOpen(timestamp: Date = new Date()): { isOpen: boolean; reason?: string; nextEvent?: string } {
    if (!this.config) return { isOpen: true };

    const dt = DateTime.fromJSDate(timestamp).setZone(this.config.timezone);
    
    // Priority: Blackout > Holiday/Closed > Special Operating Day > Weekly Schedule

    // 1. Blackout / Maintenance
    const activeBlackout = this.exceptions.find(e => 
      (e.type === 'BLACKOUT' || e.type === 'MAINTENANCE') &&
      e.startAt && e.endAt &&
      Interval.fromDateTimes(DateTime.fromISO(e.startAt), DateTime.fromISO(e.endAt)).contains(dt)
    );
    if (activeBlackout) return { isOpen: false, reason: `Maintenance: ${activeBlackout.name}` };

    // 2. Holiday
    const dateStr = dt.toFormat("yyyy-MM-dd");
    const activeHoliday = this.exceptions.find(e => e.type === 'HOLIDAY' && e.date === dateStr);
    if (activeHoliday) return { isOpen: false, reason: `Holiday: ${activeHoliday.name}` };

    // 3. Special Operating Day
    const activeSpecial = this.exceptions.find(e => e.type === 'SPECIAL_OPERATING_DAY' && e.date === dateStr);
    if (activeSpecial) {
      const isInWindow = activeSpecial.windows?.some(w => this.isWithinWindow(dt, w));
      return { isOpen: !!isInWindow, reason: isInWindow ? undefined : "Outside Special Hours" };
    }

    // 4. Weekly Schedule
    // Luxon weekday: 1 (Mon) - 7 (Sun)
    // Map to 0 (Sun) - 6 (Sat)
    const jsDay = dt.weekday === 7 ? 0 : dt.weekday;
    const daySchedule = this.config.weeklySchedule[jsDay];
    
    if (!daySchedule || !daySchedule.isEnabled) return { isOpen: false, reason: "Closed (Weekly Schedule)" };

    const isInWeeklyWindow = daySchedule.windows.some(w => this.isWithinWindow(dt, w));
    return { isOpen: isInWeeklyWindow, reason: isInWeeklyWindow ? undefined : "Outside Operating Hours" };
  }

  private isWithinWindow(dt: DateTime, window: TimeWindow): boolean {
    const [openH, openM] = window.open.split(":").map(Number);
    const [closeH, closeM] = window.close.split(":").map(Number);
    
    const openDt = dt.set({ hour: openH, minute: openM, second: 0, millisecond: 0 });
    const closeDt = dt.set({ hour: closeH, minute: closeM, second: 0, millisecond: 0 });
    
    // Handle cross-midnight windows if needed (though usually store windows are same day)
    if (closeDt < openDt) {
        // Assume close is next day
        const closeDtNext = closeDt.plus({ days: 1 });
        return dt >= openDt && dt < closeDtNext;
    }
    
    return dt >= openDt && dt < closeDt;
  }

  /**
   * Calculates the business duration in seconds between two dates.
   * This respects weekly schedule, holidays, and special operating days.
   * Note: This currently does not subtract precise blackout/maintenance intervals for simplicity,
   * but follows the priority: Holiday > Special Day > Weekly Schedule.
   */
  async calculateBusinessDuration(start: Date, end: Date): Promise<number> {
    await this.ensureLoaded();
    if (!this.config) return Math.floor((end.getTime() - start.getTime()) / 1000);
    
    let current = DateTime.fromJSDate(start).setZone(this.config.timezone);
    const target = DateTime.fromJSDate(end).setZone(this.config.timezone);
    
    if (current > target) return 0;

    let totalSeconds = 0;

    // Small optimization: if same day, just calculate
    if (current.hasSame(target, "day")) {
        return this.getBusinessSecondsInDay(current, target);
    }

    // First day partial
    totalSeconds += this.getBusinessSecondsInDay(current, current.endOf("day"));
    
    // Middle days full
    current = current.plus({ days: 1 }).startOf("day");
    while (current < target.startOf("day")) {
        totalSeconds += this.getBusinessSecondsInDay(current, current.endOf("day"));
        current = current.plus({ days: 1 });
    }
    
    // Last day partial
    totalSeconds += this.getBusinessSecondsInDay(target.startOf("day"), target);
    
    return Math.floor(totalSeconds);
  }

  private getBusinessSecondsInDay(start: DateTime, end: DateTime): number {
      const status = this.getBusinessDayStatus(start);
      if (!status.isBusinessDay) return 0;
      
      let seconds = 0;
      const windows = status.windows || [];
      
      for (const window of windows) {
          const [openH, openM] = window.open.split(":").map(Number);
          const [closeH, closeM] = window.close.split(":").map(Number);
          
          const windowStart = start.set({ hour: openH, minute: openM, second: 0, millisecond: 0 });
          const windowEnd = start.set({ hour: closeH, minute: closeM, second: 0, millisecond: 0 });
          
          const intersectionStart = DateTime.max(start, windowStart);
          const intersectionEnd = DateTime.min(end, windowEnd);
          
          if (intersectionStart < intersectionEnd) {
              seconds += intersectionEnd.diff(intersectionStart, "seconds").seconds;
          }
      }
      
      return seconds;
  }

  private getBusinessDayStatus(dt: DateTime): { isBusinessDay: boolean; windows?: TimeWindow[] } {
    // 1. Check Holiday
    const dateStr = dt.toFormat("yyyy-MM-dd");
    const activeHoliday = this.exceptions.find(e => e.type === 'HOLIDAY' && e.date === dateStr);
    if (activeHoliday) return { isBusinessDay: false };

    // 2. Check Special Operating Day
    const activeSpecial = this.exceptions.find(e => e.type === 'SPECIAL_OPERATING_DAY' && e.date === dateStr);
    if (activeSpecial) return { isBusinessDay: true, windows: activeSpecial.windows };

    // 3. Check Weekly Schedule
    const jsDay = dt.weekday === 7 ? 0 : dt.weekday;
    const daySchedule = this.config!.weeklySchedule[jsDay];
    if (!daySchedule || !daySchedule.isEnabled) return { isBusinessDay: false };

    return { isBusinessDay: true, windows: daySchedule.windows };
  }

  async getConfig(): Promise<BusinessCalendarConfig> {
    await this.ensureLoaded();
    return this.config!;
  }

  async getExceptions(): Promise<CalendarException[]> {
    await this.ensureLoaded();
    return this.exceptions;
  }

  async getAllExceptionsAdmin(): Promise<CalendarException[]> {
    const snap = await adminDb.collection("businessCalendarExceptions").orderBy("updatedAt", "desc").get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarException));
  }

  async updateConfig(config: Partial<BusinessCalendarConfig>, actorUid: string) {
    const now = new Date().toISOString();
    const current = await this.getConfig();
    const updated = { ...current, ...config, updatedAt: now, updatedBy: actorUid };
    await adminDb.collection("businessCalendarConfig").doc("default").set(updated);
    this.config = updated;
  }

  async upsertException(exception: Partial<CalendarException>, actorUid: string) {
    const now = new Date().toISOString();
    if (exception.id) {
        const id = exception.id;
        delete exception.id;
        const data = { ...exception, updatedAt: now, updatedBy: actorUid };
        await adminDb.collection("businessCalendarExceptions").doc(id).update(data);
    } else {
        const data = {
            ...exception,
            isEnabled: exception.isEnabled ?? true,
            createdAt: now,
            updatedAt: now,
            createdBy: actorUid,
            updatedBy: actorUid
        };
        await adminDb.collection("businessCalendarExceptions").add(data);
    }
    await this.loadConfig();
  }

  async deleteException(id: string) {
    await adminDb.collection("businessCalendarExceptions").doc(id).delete();
    await this.loadConfig();
  }
}
