import type { Response } from 'express';
import type { AuthRequest } from '../types/api.js';
import { getRealStandards } from '../services/pdfMatcher.js';
import { ragClient } from '../services/ragService.js';
import { testingService } from '../services/catalogService.js';

export const reportsController = {
  generate: async (req: AuthRequest, res: Response) => {
    try {
      const { title, standardNumbers, sections } = req.body;
      const allStandards = await getRealStandards();
      const selectedStandards = standardNumbers.map((code: string) => {
        const match = allStandards.find((s: {code:string, title:string, year?:string, description:string, file_name:string}) => s.code === code);
        if (!match) throw new Error(`Unknown standard: ${code}`);
        return match;
      });

      const today = new Date().toISOString().split('T')[0];
      let markdown = `# MANAK BIS Report\n\n**Report:** ${title}\n**Generated:** ${today}\n\n---\n\n`;
      markdown += `# Selected Standards\n\n`;

      for (const standard of selectedStandards) {
        markdown += `## ${standard.code}\n\n`;
        markdown += `**Title:** ${standard.title}\n`;
        markdown += `**Year:** ${standard.year || 'Unknown'}\n`;
        markdown += `**Document Type:** ${standard.description.replace('Document Type: ', '')}\n`;
        markdown += `**Source PDF:** ${standard.file_name}\n\n`;
      }
      markdown += `---\n\n`;

      const allCitations: {page?:number|null, section?:string|null, clause?:string|null, file_name?:string|null}[] = [];

      for (const standard of selectedStandards) {
        let evidence: string = '';
        let citations: {page?:number|null, section?:string|null, clause?:string|null, file_name?:string|null}[] = [];
        let fetchedRag = false;
        
        const ragSections = [];
        if (sections.standardInformation) ragSections.push('Standard Information');
        if (sections.requirements) ragSections.push('Requirements');
        if (sections.testing) ragSections.push('Testing');

        if (ragSections.length > 0) {
            const prompt = `${standard.code} - Extract information and format your response STRICTLY with these exact markdown headings: ${ragSections.map(s => `# ${s}`).join(', ')}. Under each heading, provide the relevant facts and clauses. If information for a heading is not available, explicitly write: 'Information not available in the current BIS knowledge dataset.'`;
            const ragRes = await ragClient.ask(prompt, 'en');
            evidence = ragRes.answer;
            citations = ragRes.citations;
            fetchedRag = true;
        }

        const standardSources = citations.filter(c => c.file_name === standard.file_name);
        allCitations.push(...standardSources);

        // Helper to extract sections from the LLM's unified response
        const extractSectionFromAnswer = (heading: string) => {
            if (!fetchedRag || !evidence) return "Information not available in the current BIS knowledge dataset.";
            // The LLM will generate headings like "# Standard Information" or "## Standard Information".
            const regex = new RegExp(`#{1,3}\\s*${heading}[\\s\\S]*?(?=(?:#{1,3}\\s*(?:Standard Information|Requirements|Testing|$)))`, 'i');
            const match = evidence.match(regex);
            if (match && match[0]) {
                const content = match[0].replace(new RegExp(`^#{1,3}\\s*${heading}\\s*`, 'i'), '').trim();
                if (!content) return "Information not available in the current BIS knowledge dataset.";
                return content;
            }
            return "Information not available in the current BIS knowledge dataset.";
        };

        if (sections.standardInformation) {
            markdown += `# Standard Information - ${standard.code}\n\n`;
            markdown += extractSectionFromAnswer('Standard Information') + '\n\n';
            if (sections.citations && standardSources.length > 0) {
                markdown += `### Sources\n- [${standard.file_name}](#sources)\n\n`;
            }
            markdown += `---\n\n`;
        }

        if (sections.requirements) {
            markdown += `# Requirements - ${standard.code}\n\n`;
            markdown += extractSectionFromAnswer('Requirements') + '\n\n';
            if (sections.citations && standardSources.length > 0) {
                markdown += `### Sources\n- [${standard.file_name}](#sources)\n\n`;
            }
            markdown += `---\n\n`;
        }

        if (sections.testing) {
            markdown += `# Testing - ${standard.code}\n\n`;
            markdown += extractSectionFromAnswer('Testing') + '\n\n';
            if (sections.citations && standardSources.length > 0) {
                markdown += `### Sources\n- [${standard.file_name}](#sources)\n\n`;
            }
            markdown += `---\n\n`;
        }

        if (sections.laboratories) {
            markdown += `# Laboratories - ${standard.code}\n\n`;
            // Real dataset querying
            const labsData = await testingService.search('');
            const labs = labsData.laboratories;
            const matchingLabs = labs.slice(0, 3); // Example matching logic based on standards would go here if available in dataset
            if (matchingLabs.length > 0) {
                markdown += matchingLabs.map((l: {name: string, address: string, city: string, state: string, pin: string}) => `- **${l.name}**\n  ${l.address}\n  ${l.city}, ${l.state} - ${l.pin}`).join('\n\n') + '\n\n';
            } else {
                markdown += "Information not available in the current BIS laboratory dataset.\n\n";
            }
            if (sections.citations) markdown += `### Sources\n- MANAK Testing Laboratory Database\n\n`;
            markdown += `---\n\n`;
        }
      }

      if (sections.citations) {
        markdown += `# Sources\n\n`;
        for (const standard of selectedStandards) {
            markdown += `1. ${standard.code}\n`;
            const stdCitations = allCitations.filter(c => c.file_name === standard.file_name);
            const uniqueCitations = new Set();
            for (const c of stdCitations) {
                const key = `Page ${c.page || 'Unknown'} - Section ${c.section || 'Unknown'} - Clause ${c.clause || 'Unknown'}`;
                if (!uniqueCitations.has(key)) {
                    uniqueCitations.add(key);
                    markdown += `   - ${key}\n`;
                    markdown += `   - Source: ${c.file_name}\n`;
                }
            }
            if (uniqueCitations.size === 0) {
                markdown += `   - Source PDF: ${standard.file_name}\n`;
            }
            markdown += `\n`;
        }
      }

      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="MANAK-Report-${today}.md"`);
      return res.send(markdown);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ success: false, error: { message } });
    }
  }
};
