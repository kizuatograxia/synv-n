import { z } from 'zod';
import { phoneSchema } from './auth';

/**
 * Profile update validation schema
 */
export const updateProfileSchema = z.object({
  name: z.string()
    .min(1, 'Nome é obrigatório')
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  phone: phoneSchema
});

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;
