import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

export async function getRealStandards() {
  const dir = path.resolve('../Datasets');
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));
  } catch(e) {
    console.error("Failed to read Datasets directory", e);
  }

  // Fetch metadata from RAG
  let ragDocs: { source?: string; title?: string; category?: string; categories?: string[]; document_type?: string }[] = [];
  try {
    const res = await fetch(`${env.RAG_SERVICE_URL}/documents`);
    if (res.ok) ragDocs = await res.json();
  } catch(e) {
    console.error("Failed to fetch RAG docs", e);
  }

  // Fallback map if RAG title is missing or for accurate matching
  const fileMap: Record<string, string> = {
    '101_2_1_2018_reaff2023.pdf': 'IS 101 (Part 2/Sec 1)',
    '101_7_1.pdf': 'IS 101 (Part 7/Sec 1)',
    '19031_2023.pdf': 'IS 19031:2023',
    '201_2022.pdf': 'IS 201:2022',
    '2325_1981_reff2021.pdf': 'IS 2325:1981',
    '2553_3_2026.pdf': 'IS 2553 (Part 3):2026',
    '269_2015_reff2020.pdf': 'IS 269:2015',
    '302_2_2.pdf': 'IS 302-2-2',
    '302_2_209_1994_reff2020.pdf': 'IS 302-2-209:1994',
    '302_2_24.pdf': 'IS 302-2-24',
    '5006_1968_reff2019.pdf': 'IS 5006:1968',
    '5_2007_reff2022.pdf': 'IS 5:2007',
    '674_2023.pdf': 'IS 674:2023',
    '758_2023.pdf': 'IS 758:2023',
    '8524_1977_reff2020.pdf': 'IS 8524:1977',
    'sp11.pdf': 'SP 11:1973',
    'sp15_1.pdf': 'SP 15 Part 1',
    'sp30_2023.pdf': 'SP 30:2023',
    'sp34.pdf': 'SP 34',
    'sp62.pdf': 'SP 62',
    'sp6_5.pdf': 'SP 6 (5)'
  };

  const results = files.map(filename => {
    const code = fileMap[filename] || filename;
    let title = code;
    let category = '';
    let categories: string[] = [];
    let document_type = filename.toLowerCase().startsWith('sp') ? 'handbook' : 'standard';

    // Try to find matching metadata from RAG
    const doc = ragDocs.find(d => {
      if (d.source && d.source.includes(code)) return true;
      if (d.title && d.title.includes(code)) return true;
      return false;
    });

    if (doc) {
      if (doc.title) title = doc.title;
      if (doc.category) category = doc.category;
      if (doc.categories) categories = doc.categories;
      if (doc.document_type) document_type = doc.document_type;
    }
    
    if (categories.length === 0 && category) {
      categories = [category];
    }

    // Attempt to extract year
    let year = '';
    const match = title.match(/:(\d{4})/);
    if (match) {
        year = match[1];
    } else {
        const fileMatch = filename.match(/_(\d{4})/);
        if (fileMatch) year = fileMatch[1];
    }

    return {
      id: filename,
      code: code,
      title: title,
      category: category,
      categories: categories,
      industry: category || 'Various',
      status: 'current',
      description: `Document Type: ${document_type.charAt(0).toUpperCase() + document_type.slice(1)}`,
      file_name: filename,
      year: year
    };
  });

  return results;
}
