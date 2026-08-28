import { z } from 'zod';
const empty=z.any();const page=z.coerce.number().int().min(1).default(1);const pageSize=z.coerce.number().int().min(1).max(100).default(12);
export const listStandardsSchema=z.object({body:empty,params:empty,query:z.object({search:z.string().trim().max(200).optional(),category:z.string().trim().max(100).optional(),industry:z.string().trim().max(100).optional(),status:z.enum(['current','under_review']).optional(),page,pageSize})});
export const idSchema=z.object({body:empty,query:empty,params:z.object({id:z.string().trim().min(1).max(100)})});
export const pinSchema=z.object({body:empty,params:empty,query:z.object({pin:z.string().regex(/^\d{6}$/,'Please enter a valid 6-digit PIN code.').optional()})});
export const aiSchema=z.object({body:z.object({question:z.string().trim().min(3).max(4000),language:z.string().trim().max(30).default('en'),conversationId:z.string().uuid().optional()}),params:empty,query:empty});
export const voiceSchema=z.object({body:z.object({language:z.string().trim().min(2).max(30),transcript:z.string().max(8000).optional()}),params:empty,query:empty});
export const makeHandoutSchema=z.object({body:z.object({fileNames:z.array(z.string().trim().min(1).max(255).regex(/^[^/\\]+$/, 'Invalid filename'))}),params:empty,query:empty});

export const generateReportSchema=z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200),
    standardNumbers: z.array(z.string().trim().min(1).max(200)),
    sections: z.object({
      standardInformation: z.boolean(),
      requirements: z.boolean(),
      testing: z.boolean(),
      laboratories: z.boolean(),
      citations: z.boolean()
    })
  }),
  params: empty,
  query: empty
});
