import { z } from 'zod';
import { date, id } from './validation';
import { monthStart, todayIndia } from './business';
export const reportInput = z
  .object({
    start: date.default(() => monthStart()),
    end: date.default(() => todayIndia()),
    location: z.union([id, z.literal('')]).default(''),
    department: z.string().max(250).default(''),
    search: z.string().max(250).default(''),
  })
  .refine(
    (v) =>
      v.end >= v.start &&
      v.end <= todayIndia() &&
      (Date.parse(v.end) - Date.parse(v.start)) / 86400000 <= 366,
    'Choose an ordered date range of at most 367 days, ending today or earlier.',
  );
