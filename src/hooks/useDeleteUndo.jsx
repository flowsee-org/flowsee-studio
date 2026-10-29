import { useCallback } from "react";
import { toast } from "@/components/ui/use-toast";
import { appId } from "@/api/base44Client";
import { formatPersianNumber as faNum } from "@/lib/number-format";

const toList = (records) => (Array.isArray(records) ? records : records ? [records] : []);
const recordLabel = (r) => r?.title || r?.name || r?.colleague || "مورد";

/**
 * useDeleteUndo(entityName, deleteFn, loadFn)
 *
 * Wraps delete calls so records can be restored within a 5-second window:
 *   1. deleteFn(id) is called for each record — records are soft-deleted server-side.
 *   2. A toast with an inline "بازگردانی" button appears for 5 seconds.
 *   3. Undo → POST /entities/:entityName/:id/restore for each record, then loadFn().
 *   4. No undo after 5s → nothing more happens (records stay deleted until purge).
 *
 * deleteWithUndo(records) accepts a single record or an array of
 * { id, title }. Pass { title, count } to customize the toast copy.
 */
export function useDeleteUndo(entityName, deleteFn, loadFn) {
  const deleteWithUndo = useCallback(
    async (records, opts = {}) => {
      const list = toList(records);
      if (list.length === 0) return;
      try {
        for (const r of list) await deleteFn(r.id);
        await loadFn?.();
      } catch (err) {
        console.error(`Failed to delete ${entityName}:`, err);
        toast({
          title: "حذف انجام نشد",
          description: err?.message || "لطفاً دوباره تلاش کنید.",
          variant: "destructive",
        });
        return 0;
      }

      const count = opts.count ?? list.length;
      const title = opts.title || (count === 1 ? recordLabel(list[0]) : "گزینه");

      toast({
        title: count === 1 ? `«${title}» حذف شد` : `${faNum(count)} مورد حذف شد`,
        description: "شما ۵ ثانیه فرصت دارید تا بازگردانید.",
        duration: 5000,
        action: (
          <button
            onClick={async () => {
              try {
                const token = localStorage.getItem("base44_access_token");
                for (const r of list) {
                  const res = await fetch(
                    `/api/apps/${appId}/entities/${entityName}/${r.id}/restore`,
                    {
                      method: "POST",
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    }
                  );
                  if (!res.ok) throw new Error("restore failed");
                }
                await loadFn?.();
                toast({ title: count === 1 ? "بازگردانی شد" : `${faNum(count)} مورد بازگردانی شد` });
              } catch {
                console.error("Undo failed");
                toast({ title: "خطا", description: "بازگردانی ناموفق بود", variant: "destructive" });
              }
            }}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            بازگردانی
          </button>
        ),
      });

      return list.length;
    },
    [entityName, deleteFn, loadFn]
  );

  return { deleteWithUndo };
}
