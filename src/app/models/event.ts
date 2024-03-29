export interface Event {
  id?: string;
  title?: string;
  date: Date;
  hours: number;
  workDone: string;
  reason: string;
  specialDay?: number;
  holiday?: boolean;
}
