export interface Organization {
  key: string;
  name: string;
  myRole?: string;
  isDefault?: boolean;
  users: any[];
  invites: any[];
}
