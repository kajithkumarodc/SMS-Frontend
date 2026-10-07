import api from '../lib/api';

/** A type of calendar entry (`CalendarController.TypeResponse`). */
export type HolidayType = { id: string; name: string };

/** One calendar entry (`CalendarService.EventRow`); `createdByCode` is the staff ID when the creator is staff. */
export type CalendarEvent = {
  id: string;
  typeId: string;
  typeName: string | null;
  fromDate: string;
  toDate: string;
  description: string;
  frontSite: boolean;
  createdByName: string | null;
  createdByCode: string | null;
};

export type CalendarEventInput = {
  typeId: string;
  fromDate: string;
  toDate: string;
  description: string;
  frontSite: boolean;
};

export async function fetchHolidayTypes(): Promise<HolidayType[]> {
  const { data } = await api.get<HolidayType[]>('/v1/calendar/types');
  return data;
}

export async function createHolidayType(name: string): Promise<HolidayType> {
  const { data } = await api.post<HolidayType>('/v1/calendar/types', { name });
  return data;
}

export async function updateHolidayType(id: string, name: string): Promise<HolidayType> {
  const { data } = await api.put<HolidayType>(`/v1/calendar/types/${id}`, { name });
  return data;
}

export async function deleteHolidayType(id: string): Promise<void> {
  await api.delete(`/v1/calendar/types/${id}`);
}

export async function fetchCalendarEvents(typeId?: string): Promise<CalendarEvent[]> {
  const { data } = await api.get<CalendarEvent[]>('/v1/calendar/events', { params: typeId ? { typeId } : undefined });
  return data;
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent> {
  const { data } = await api.post<CalendarEvent>('/v1/calendar/events', input);
  return data;
}

export async function updateCalendarEvent(id: string, input: CalendarEventInput): Promise<CalendarEvent> {
  const { data } = await api.put<CalendarEvent>(`/v1/calendar/events/${id}`, input);
  return data;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await api.delete(`/v1/calendar/events/${id}`);
}
