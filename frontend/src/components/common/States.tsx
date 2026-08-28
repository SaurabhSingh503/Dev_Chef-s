export const LoadingState=()=> <div className="state">Loading MANAK knowledge…</div>;
export const EmptyState=({title='Nothing here yet'}:{title?:string})=><div className="state"><strong>{title}</strong><span>Try another search or return later.</span></div>;
export const ErrorState=({message='Something went wrong'}:{message?:string})=><div className="state error"><strong>{message}</strong><span>Please try again.</span></div>;
