import { DateTime, Interval } from "luxon";
import { supabaseAdmin, isSupabaseAdminConfigured } from "./supabase-admin.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";
import { BusinessCalendarConfig, CalendarException, TimeWindow, DaySchedule } from "../types/core.js";

const CONFIG_KEY = "business_calendar_config";
const EXCEPTIONS_KEY = "business_calendar_exceptions";

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
    const rawConfig = await SystemConfigRepository.getInstance().getConfig(CONFIG_KEY);
    if (rawConfig) {
      this.config = rawConfig as BusinessCalendarConfig;
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

    const rawExceptions = await SystemConfigRepository.getInstance().getConfig(EXCEPTIONS_KEY);
    const allExceptions: CalendarException[] = Array.isArray(rawExceptions) ? rawExceptions : [];
    this.exceptions = allExceptions.filter(e => e.isEnabled === true);
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
    const raw = await SystemConfigRepository.getInstance().getConfig(EXCEPTIONS_KEY);
    const list: CalendarException[] = Array.isArray(raw) ? raw : [];
    return list.sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });
  }

  async getExceptionById(id: string): Promise<CalendarException | null> {
    const list = await this.getAllExceptionsAdmin();
    return list.find(e => e.id === id) || null;
  }

  async updateConfig(config: Partial<BusinessCalendarConfig>, actorUid: string) {
    const now = new Date().toISOString();
    const current = await this.getConfig();
    const updated = { ...current, ...config, updatedAt: now, updatedBy: actorUid };

    try {
      await SystemConfigRepository.getInstance().upsertConfig(CONFIG_KEY, updated);
    } catch (error: any) {
      throw new Error(`Failed to save calendar config: ${error.message}`);
    }

    this.config = updated;
    this.lastLoaded = Date.now();
  }

  async upsertException(exception: Partial<CalendarException>, actorUid: string) {
    const now = new Date().toISOString();
    const raw = await SystemConfigRepository.getInstance().getConfig(EXCEPTIONS_KEY);
    let list: CalendarException[] = Array.isArray(raw) ? [...raw] : [];

    if (exception.id) {
      const targetId = exception.id;
      const idx = list.findIndex(e => e.id === targetId);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          ...exception,
          id: targetId,
          updatedAt: now,
          updatedBy: actorUid
        };
      } else {
        list.push({
          ...(exception as CalendarException),
          id: targetId,
          updatedAt: now,
          updatedBy: actorUid
        });
      }
    } else {
      const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `exc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newException: CalendarException = {
        ...(exception as any),
        id: newId,
        isEnabled: exception.isEnabled ?? true,
        createdAt: now,
        updatedAt: now,
        createdBy: actorUid,
        updatedBy: actorUid
      };
      list.push(newException);
    }

    try {
      await SystemConfigRepository.getInstance().upsertConfig(EXCEPTIONS_KEY, list);
    } catch (error: any) {
      throw new Error(`Failed to save calendar exception: ${error.message}`);
    }

    await this.loadConfig();
  }

  async deleteException(id: string) {
    const now = new Date().toISOString();
    const raw = await SystemConfigRepository.getInstance().getConfig(EXCEPTIONS_KEY);
    let list: CalendarException[] = Array.isArray(raw) ? [...raw] : [];
    list = list.filter(e => e.id !== id);

    try {
      await SystemConfigRepository.getInstance().upsertConfig(EXCEPTIONS_KEY, list);
    } catch (error: any) {
      throw new Error(`Failed to delete calendar exception: ${error.message}`);
    }

    await this.loadConfig();
  }
}
