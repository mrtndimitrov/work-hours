export interface Event {
  id?: string;
  title?: string;
  date: Date;
  hours: number;
  workDone: string;
  reason: string;
  holiday?: boolean;
}
