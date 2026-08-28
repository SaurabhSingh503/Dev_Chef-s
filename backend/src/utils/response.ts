import type { Response } from 'express';
export const ok=<T>(res:Response,data:T,message?:string,status=200)=>res.status(status).json({success:true,data,...(message?{message}:{})});
export const noContent=(res:Response)=>res.status(204).send();
