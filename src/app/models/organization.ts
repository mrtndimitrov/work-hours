import { Invitation } from './invitation';

export interface Organization {
  key: string;
  name: string;
  myRole?: string;
  isDefault?: boolean;
  users: any[];
  invitations: Invitation[];
  holidays?: any;
  spreadsheetId?: string;
}
