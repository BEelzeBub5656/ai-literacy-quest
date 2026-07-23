import { z } from 'zod';

export const detectionSchema = z.object({
  label: z.string().min(1),
  confidence: z.number().min(0).max(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().optional(),
}).strict();

export const visionRecognizeResponseSchema = z.object({
  provider: z.string(),
  model: z.string(),
  fallback_used: z.boolean(),
  detections: z.array(detectionSchema),
}).strict();

export type Detection = z.infer<typeof detectionSchema>;
export type VisionRecognizeResponse = z.infer<typeof visionRecognizeResponseSchema>;
