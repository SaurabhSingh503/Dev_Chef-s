import { env } from '../config/env.js';
export const voiceService={async transcribe(input:{language:string;transcript?:string}){if(env.VOICE_SERVICE_URL)throw new Error('Voice provider adapter must be connected to the configured provider contract');return {transcript:input.transcript??'',language:input.language,status:'provider_not_configured' as const};}};
