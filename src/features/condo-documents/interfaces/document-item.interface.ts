export type CondoDocumentType = 'document' | 'minute';

export interface DocumentItem {
  name: string;
  displayName: string;
  date: string;
  size: number;
  updated: string;
}
