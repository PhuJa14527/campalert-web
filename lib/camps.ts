import raw from "@/data/camps.json";

export type Camp = {
  id: string;
  title: string;
  type: string;
  field: string;
  startDate: string;
  endDate: string;
  deadline: string | null;
  dateIsDeadline?: boolean;
  level: string;
  location: string;
  fee: string;
  seats: string;
  organizer: string;
  registration: string;
  dateText: string;
  regmode: string;
  sourceUrl: string;
};

export const camps: Camp[] = raw.camps as Camp[];

export const campTypes: string[] = [...new Set(camps.map((camp) => camp.type))].sort();

export const dataFetchedAt: string = raw.fetchedAt;

export const dataSource: string = raw.sourceUrl;
