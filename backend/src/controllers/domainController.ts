import type { Response } from 'express'; import type { AuthRequest } from '../types/api.js'; import { domainService } from '../services/domainService.js'; import { pdfService } from '../services/pdfService.js'; import { ok } from '../utils/response.js'; import { getRealStandards } from '../services/pdfMatcher.js';
type Domain=Parameters<typeof domainService.get>[0];
const access=(domain:Domain,req:AuthRequest)=>domainService.assertRole(domain,req.user!.role);
const param=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value!;
export const domainController={list:(domain:Domain)=> (req:AuthRequest,res:Response)=>{access(domain,req);return ok(res,domainService.get(domain));},detail:(domain:Domain)=>(req:AuthRequest,res:Response)=>{access(domain,req);return ok(res,domainService.getDetail(domain,param(req.params.id)));},handbookPreview:(req:AuthRequest,res:Response)=>ok(res,domainService.previewHandbook(param(req.params.id))),adminAction:(req:AuthRequest,res:Response)=>{access('admin',req);return ok(res,domainService.adminAction(param(req.params.action)),'Action recorded');},
  downloadHandbookPdf: async (req: AuthRequest, res: Response) => {
    const id = param(req.params.id);
    const handbook = await domainService.getPdfForHandbook(id, req.user!);
    const pdfBuffer = await pdfService.createHandbookPdf(handbook);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="manak-handbook-${id}.pdf"`);
    res.send(pdfBuffer);
  },
  downloadReportPdf: async (req: AuthRequest, res: Response) => {
    const id = param(req.params.id);
    const report = await domainService.getPdfForReport(id, req.user!);
    const pdfBuffer = await pdfService.createReportPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="manak-report-${id}.pdf"`);
    res.send(pdfBuffer);
  },
  makeHandout: async (req: AuthRequest, res: Response) => {
    const fileNames = req.body.fileNames as string[];
    const allStandards = await getRealStandards();
    
    // Resolve filenames against known standards
    const selected = fileNames.map(f => {
      const match = allStandards.find((s) => s.file_name === f);
      if (!match) throw new Error(`Unknown standard file requested: ${f}`);
      return { 
        code: match.code, 
        title: match.title, 
        type: match.description.replace('Document Type: ', ''), 
        year: match.year 
      };
    });
    
    const pdfBuffer = await pdfService.createMultiHandoutPdf(selected);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="MANAK-Handout.pdf"`);
    res.send(pdfBuffer);
  }
};
