import React from 'react';
import { useStore } from './StoreContext';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export const NotificationSystem: React.FC = () => {
    const { toasts, removeToast } = useStore();

    if (toasts.length === 0) return null;

    const getIcon = (type: string) => {
        switch(type) {
            case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
            case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
            default: return <Info className="w-5 h-5 text-indigo-500" />;
        }
    };

    const getBgColor = (type: string) => {
        // Using white background with colored accents for modern look
        return 'bg-white dark:bg-slate-800'; 
    };

    const getBorderColor = (type: string) => {
        switch(type) {
            case 'success': return 'border-l-4 border-emerald-500';
            case 'warning': return 'border-l-4 border-orange-500';
            case 'error': return 'border-l-4 border-red-500';
            default: return 'border-l-4 border-indigo-500';
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-3 w-full max-w-sm px-4 md:px-0">
            {toasts.map(toast => (
                <div 
                    key={toast.id}
                    className={`
                        flex items-start gap-3 p-4 rounded-lg shadow-xl border border-slate-100 dark:border-slate-700
                        animate-[slideInRight_0.3s_ease-out]
                        ${getBgColor(toast.type)} ${getBorderColor(toast.type)}
                    `}
                >
                    <div className="shrink-0 mt-0.5">
                        {getIcon(toast.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{toast.title}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-snug break-words">{toast.message}</p>
                    </div>
                    <button 
                        onClick={() => removeToast(toast.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};