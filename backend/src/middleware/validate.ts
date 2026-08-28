import type { RequestHandler } from 'express'; import type { ZodType } from 'zod';
type Validated={body:unknown;query:unknown;params:unknown};
export const validate=(schema:ZodType<Validated>):RequestHandler=>(req,_res,next)=>{const parsed=schema.safeParse({body:req.body,query:req.query,params:req.params});if(!parsed.success)return next(parsed.error);req.body=parsed.data.body;Object.defineProperty(req, 'query', { value: parsed.data.query, configurable: true });Object.defineProperty(req, 'params', { value: parsed.data.params, configurable: true });next();};
