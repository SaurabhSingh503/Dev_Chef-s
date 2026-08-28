import type { Request } from 'express';
export type Role='individual'|'organization'|'admin';
export type AuthUser={id:string;email:string;role:Role;name:string;account_type:'individual'|'organization';product_type?:string;organizationName?:string;avatar_url?:string};
export type ApiSuccess<T>={success:true;data:T;message?:string};
export type ApiError={success:false;error:{code:string;message:string}};
export type AuthRequest=Request & {user?:AuthUser};
export type Page<T>={items:T[];page:number;pageSize:number;total:number};
