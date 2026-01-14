import { ReportReason } from './report-reason.entity';

export const DEFAULT_REPORT_REASONS = [
  {
    title: 'Spam',
    description: 'Content that is repetitive, irrelevant, or promotional in nature',
    sortOrder: 1
  },
  {
    title: 'Harassment or Bullying',
    description: 'Content that harasses, intimidates, or bullies individuals or groups',
    sortOrder: 2
  },
  {
    title: 'Inappropriate Content',
    description: 'Content that is inappropriate, offensive, or not suitable for the platform',
    sortOrder: 3
  },
  {
    title: 'False Information',
    description: 'Content containing misleading or false information',
    sortOrder: 4
  },
  {
    title: 'Violence or Harmful Behavior',
    description: 'Content that promotes or depicts violence or harmful behavior',
    sortOrder: 5
  },
  {
    title: 'Copyright Violation',
    description: 'Content that violates copyright or intellectual property rights',
    sortOrder: 6
  },
  {
    title: 'Privacy Violation',
    description: 'Content that violates privacy or shares personal information without consent',
    sortOrder: 7
  },
  {
    title: 'Hate Speech',
    description: 'Content that promotes hate or discrimination against individuals or groups',
    sortOrder: 8
  },
  {
    title: 'Other',
    description: 'Other reasons not covered by the above categories',
    sortOrder: 9
  }
];