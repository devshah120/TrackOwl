import { Construction } from 'lucide-react';

export function ComingSoon({ title }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Construction className="w-16 h-16 text-slate-300 mb-4" />
      <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
      <p className="text-slate-600 text-lg">Coming soon under development</p>
    </div>
  );
}
