import { useState } from "react";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export default function ConfirmDialog({
  children = null,
  title = "آیا مطمئن هستید؟",
  description = "این کار قابل بازگشت نیست.",
  onConfirm,
  onCancel,
  confirmText = "بله، انجام شود",
  cancelText = "انصراف",
  variant = "destructive",
}) {
  // Pages mount this dialog conditionally (e.g. {deleteTarget && <ConfirmDialog/>})
  // without passing a trigger child, so it must open itself on mount.
  const [open, setOpen] = useState(!children);

  const dismiss = () => {
    setOpen(false);
    // Let the page clear its target so the dialog unmounts; otherwise the
    // mounted instance would stay closed and never reopen for the next item.
    onCancel?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      {children ? (
        <AlertDialogTrigger asChild>
          {children}
        </AlertDialogTrigger>
      ) : null}
      <AlertDialogContent dir="rtl" className="text-right">
        <div dir="rtl" className="grid gap-4">
          <AlertDialogHeader className="text-right sm:text-right">
            <AlertDialogTitle className="text-right">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-right text-muted-foreground">{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row justify-start gap-2 sm:justify-start">
            <AlertDialogAction onClick={() => { setOpen(false); onConfirm?.(); }} className={variant === "destructive" ? "bg-red-600 hover:bg-red-700" : ""}>
              {confirmText}
            </AlertDialogAction>
            <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
