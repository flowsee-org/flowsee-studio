import { useState, useEffect } from "react";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { Camera, Save, Mail, Phone, User, CheckCircle, AlertTriangle, Send, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { imageFileToDataUrl } from "@/lib/image-file";

export default function Profile() {
  const { user, checkUserAuth } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [profileImage, setProfileImage] = useState(user?.profile_image || "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [sendingVerification, setSendingVerification] = useState(false);

  // Refresh user data when it changes
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setPhone(user.phone || "");
      setProfileImage(user.profile_image || "");
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await studio.auth.updateMe({ full_name: fullName, phone, profile_image: profileImage });
      // Refresh user data after update
      await checkUserAuth();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || "خطا در ذخیره");
    }
    setSaving(false);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const imageData = await imageFileToDataUrl(file, { maxDimension: 800 });
      setProfileImage(imageData);
      toast({ title: "تصویر بارگذاری شد", description: "برای ثبت آن، ذخیره تغییرات را بزنید." });
    } catch (err) {
      console.error(err);
      toast({ title: "آپلود تصویر ناموفق بود", description: err.message || "دوباره تلاش کنید.", variant: "destructive" });
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleResendVerification = async () => {
    setSendingVerification(true);
    try {
      await studio.auth.resendOtp(user.email);
      toast({
        title: "ایمیل تایید ارسال شد",
        description: "کد تایید به ایمیل شما ارسال شد. ایمیل خود را بررسی کنید.",
      });
    } catch (err) {
      toast({
        title: "خطا",
        description: err.message || "ارسال ایمیل تایید ناموفق بود",
        variant: "destructive",
      });
    } finally {
      setSendingVerification(false);
    }
  };

  const initial = (fullName || user?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">پروفایل من</h1>
        <p className="text-muted-foreground mt-1 text-sm">اطلاعات شخصی خود را مدیریت کنید</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            {profileImage ? (
              <img
                src={profileImage}
                alt="پروفایل"
                className="w-20 h-20 rounded-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {initial}
              </div>
            )}
            <label className="absolute bottom-0 left-0 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer hover:opacity-90 transition-opacity">
              <Camera className="w-4 h-4" />
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploadingImage} />
            </label>
            {uploadingImage && <span className="text-xs text-muted-foreground">در حال آپلود تصویر...</span>}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-lg truncate">{fullName || "بدون نام"}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">نام و نام خانوادگی</label>
            <div className="relative">
              <User className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-input rounded-xl pr-10 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">شماره تماس</label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912..."
                dir="ltr"
                className="w-full border border-input rounded-xl pr-10 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-right"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">ایمیل</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full border border-input rounded-xl pr-10 px-4 py-2.5 text-sm bg-accent/30 text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              {user?.is_verified ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  تایید شده
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    تایید نشده
                  </span>
                  <button
                    onClick={handleResendVerification}
                    disabled={sendingVerification}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {sendingVerification ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    ارسال ایمیل تایید
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-6 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "در حال ذخیره..." : saved ? "ذخیره شد ✓" : "ذخیره تغییرات"}
        </button>
      </div>
    </div>
  );
}
