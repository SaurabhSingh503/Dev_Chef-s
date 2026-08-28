import type { NextFunction, Response } from 'express'; import type { AuthRequest, Role } from '../types/api.js'; import { authService } from '../services/authService.js'; import { AppError } from '../utils/appError.js';
export async function authenticate(req:AuthRequest,_res:Response,next:NextFunction){try{const header=req.header('authorization');if(!header?.startsWith('Bearer '))throw new AppError(401,'UNAUTHENTICATED','Authentication is required');const token=header.slice(7);if(authService.isRevoked(token))throw new AppError(401,'UNAUTHENTICATED','Session has ended');req.user=await authService.verify(token);next();}catch(error){next(error);}}
export const requireRole=(...roles:Role[])=> (req:AuthRequest,_res:Response,next:NextFunction)=>!req.user?next(new AppError(401,'UNAUTHENTICATED','Authentication is required')):roles.includes(req.user.role)?next():next(new AppError(403,'FORBIDDEN','You do not have permission to access this resource'));
export const requireAccountType = (type: 'individual' | 'organization') => (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required'));
  if (req.user.account_type !== type) return next(new AppError(403, 'FORBIDDEN', `This resource requires an ${type} account.`));
  next();
};
