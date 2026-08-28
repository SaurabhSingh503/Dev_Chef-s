import type { Handbook, Standard } from '../types';

export const standards: Standard[] = [
 {id:'is-302',code:'IS 302',title:'Safety of household electrical appliances',category:'Safety',industry:'Electrical',status:'Current',description:'Demo summary for exploring the MANAK standards experience.',tags:['Electrical','Consumer safety']},
 {id:'is-10500',code:'IS 10500',title:'Drinking water — specification',category:'Quality',industry:'Water',status:'Current',description:'Demo quality parameters and compliance guidance.',tags:['Water','Public health']},
 {id:'is-14543',code:'IS 14543',title:'Packaged drinking water',category:'Food & beverage',industry:'Consumer goods',status:'Under review',description:'Demo reference for packaged-water manufacturers.',tags:['Packaging','Quality']},
 {id:'is-1293',code:'IS 1293',title:'Plugs and socket-outlets',category:'Safety',industry:'Electrical',status:'Current',description:'Demo technical reference for electrical fittings.',tags:['Electrical','Product']}
];
export const handbooks: Handbook[] = [
 {id:'h1',title:'Quality Management Essentials',category:'Quality systems',description:'A practical demo handbook for establishing consistent quality practices.',pages:48,updated:'August 2026',audience:'Organization'},
 {id:'h2',title:'Consumer Product Safety Guide',category:'Consumer guidance',description:'A clear demo guide to labels, safety marks and informed choices.',pages:32,updated:'July 2026',audience:'BIS'},
 {id:'h3',title:'Testing Readiness Handbook',category:'Testing',description:'Prepare product samples and documentation for laboratory testing.',pages:54,updated:'June 2026',audience:'Organization'},
 {id:'h4',title:'Hallmarking at a Glance',category:'Consumer guidance',description:'A concise demo explainer for jewellery consumers.',pages:20,updated:'May 2026',audience:'BIS'}
];
export const news = ['New demo handbook: Testing Readiness', 'Standards discovery now supports saved items', 'Voice guidance is available in eight languages'];
