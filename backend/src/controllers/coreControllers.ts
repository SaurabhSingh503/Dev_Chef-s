import type { Response } from 'express'; import type { AuthRequest } from '../types/api.js'; import { standardsService,testingService } from '../services/catalogService.js'; import { voiceService } from '../services/voiceService.js'; import { aiService } from '../services/aiService.js'; import { ok } from '../utils/response.js';
const value=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
export const standardsController={list:async(req:AuthRequest,res:Response)=>ok(res,await standardsService.list(req.query as {search?:string;category?:string;industry?:string;status?:string;page?:number;pageSize?:number})),get:async(req:AuthRequest,res:Response)=>ok(res,await standardsService.get(value(req.params.id)!)),save:async(req:AuthRequest,res:Response)=>ok(res,await standardsService.save(req.user!.id,value(req.params.id)!),'Standard saved')};
export const testingController={list:async(req:AuthRequest,res:Response)=>ok(res,await testingService.search(typeof req.query.pin==='string'?req.query.pin:undefined)),get:async(req:AuthRequest,res:Response)=>ok(res,await testingService.get(value(req.params.id)!)),requirements:(_req:AuthRequest,res:Response)=>ok(res,testingService.requirements())};
export const aiController={
  ask:async(req:AuthRequest,res:Response)=>{
    const body=req.body as {question:string;language:string;conversationId?:string};
    return ok(res,await aiService.ask(req.user!.id,body.question,body.language,body.conversationId));
  },
  listConversations:async(req:AuthRequest,res:Response)=>{
    return ok(res,await aiService.listConversations(req.user!.id));
  },
  getConversation:async(req:AuthRequest,res:Response)=>{
    return ok(res,await aiService.getConversation(req.user!.id,value(req.params.id)!));
  }
};
export const voiceController={transcribe:async(req:AuthRequest,res:Response)=>ok(res,await voiceService.transcribe(req.body as {language:string;transcript?:string}))};
