import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { AlertTriangle, X, FileText, Clock } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const getPersianDate = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' }).formatToParts(d);
    const p = {};
    parts.forEach((part) => { if (part.type !== 'literal') p[part.type] = part.value; });
    return `${p.year}/${p.month}/${p.day}`;
  } catch {
    return '';
  }
};

export function useDailyReportReminder() {
  const { user, isAdmin } = useAuth();
  const [showReminder, setShowReminder] = useState(false);
  const [checkedToday, setCheckedToday] = useState(false);

  useEffect(() => {
    // Check if it's Friday (day 5 in getDay, which is Friday in JS)
    const now = new Date();
    const isFriday = now.getDay() === 5;

    // Only check once per day
    if (checkedToday) return;
    setCheckedToday(true);

    const checkAndShowReminder = async () => {
      // Skip if admin (they don't need to file reports typically) or Friday
      if (isAdmin || isFriday || !user) return;

      // Check if it's after 23:30 Tehran time
      const tehranTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
      const hours = tehranTime.getHours();
      const minutes = tehranTime.getMinutes();

      // Show reminder between 23:30 and 23:59
      if (hours === 23 && minutes >= 30) {
        const today = getPersianDate(0);
        try {
          // Check if user already filed a report today
          const reports = await base44.entities.WorkReport.list({ q: JSON.stringify({ created_by_id: user.id, date: today }) });
          const hasReport = reports.length > 0;

          if (!hasReport) {
            setShowReminder(true);
          }
        } catch (err) {
          console.error('Failed to check work report:', err);
        }
      }
    };

    checkAndShowReminder();

    // Set up interval to check every minute during the reminder window
    const interval = setInterval(checkAndShowReminder, 60000);
    return () => clearInterval(interval);
  }, [user, isAdmin, checkedToday]);

  return { showReminder, setShowReminder };
}

export default function DailyReportReminder() {
  const { showReminder, setShowReminder } = useDailyReportReminder();

  if (!showReminder) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 lg:bottom-auto lg:left-auto lg:right-4 lg:top-20 z-50 max-w-md" dir="rtl">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xl animate-slide-in">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-amber-800">یادآوری گزارش کار</h3>
            <p className="text-sm text-amber-700 mt-1">
              هنوز گزارش کار امروز را ثبت نکرده‌اید. لطفاً قبل از پایان روز آن را تکمیل کنید.
            </p>
          </div>
          <button onClick={() => setShowReminder(false)} className="text-amber-500 hover:text-amber-700 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2 mt-4">
          <a
            href="/work-reports"
            className="flex-1 bg-amber-600 text-white py-2.5 rounded-lg font-medium text-center hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" /> ثبت گزارش کار
          </a>
          <button
            onClick={() => setShowReminder(false)}
            className="px-4 py-2.5 border border-amber-300 text-amber-700 rounded-lg font-medium hover:bg-amber-100 transition-colors flex items-center gap-2"
          >
            <Clock className="w-4 h-4" /> بعداً
          </button>
        </div>
      </div>
    </div>
  );
}