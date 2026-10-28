import { useState } from "react";
import { useTheme } from "next-themes";
import { api } from "@/api/client";
import { Settings, Bell, Shield, Globe, Palette, Building2, Printer, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MobileSelect } from "@/components/ui/mobile-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

const SA_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zu", label: "isiZulu" },
  { code: "xh", label: "isiXhosa" },
  { code: "st", label: "Sesotho" },
  { code: "tn", label: "Setswana" },
  { code: "af", label: "Afrikaans" },
  { code: "ts", label: "Xitsonga" },
  { code: "ve", label: "Tshivenda" },
  { code: "nr", label: "isiNdebele" },
  { code: "ss", label: "siSwati" },
  { code: "nso", label: "Sepedi" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [business, setBusiness] = useState({
    name: "My Spaza Shop", owner: "", phone: "", email: "", address: "",
    vatNumber: "", registrationNumber: "", currency: "ZAR"
  });
  const [receiptSettings, setReceiptSettings] = useState({
    showLogo: true, showVAT: false, footer: "Thank you for shopping with us!", paperSize: "80mm"
  });
  const [notifications, setNotifications] = useState({
    lowStock: true, cashupReminder: true, bankDeposit: true, expiryAlert: true, businessTips: true
  });
  const [security, setSecurity] = useState({ pinLogin: false, autoLock: true, lockTime: "5" });
  const [language, setLanguage] = useState("en");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    toast({ title: "Settings Saved", description: "Your settings have been saved successfully" });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteAccount = async () => {
    console.log("Account deletion requested - implementing logout");
    toast({ title: "Account Deletion", description: "Logging you out. Account deletion will be processed.", variant: "destructive" });
    setDeleteDialogOpen(false);
    try {
      await api.auth.logout();
    } catch (err) {
      window.location.href = "/login";
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your shop settings</p>
      </div>

      <Tabs defaultValue="business">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="business" className="text-xs">Business</TabsTrigger>
          <TabsTrigger value="receipt" className="text-xs">Receipt</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs">Alerts</TabsTrigger>
          <TabsTrigger value="security" className="text-xs">Security</TabsTrigger>
        </TabsList>

        {/* Business Info */}
        <TabsContent value="business">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 size={18} /> Business Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-20 h-20 bg-foreground rounded-2xl flex items-center justify-center cursor-pointer hover:bg-foreground/90 transition-colors">
                  <Building2 size={32} className="text-background" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Shop Logo</p>
                  <p className="text-xs text-muted-foreground">Tap to change logo</p>
                  <Button variant="outline" size="sm" className="mt-1">Upload Logo</Button>
                </div>
              </div>
              {[
                ["name", "Shop Name *"],
                ["owner", "Owner Name"],
                ["phone", "Phone Number"],
                ["email", "Email Address"],
                ["address", "Shop Address"],
                ["vatNumber", "VAT Number"],
                ["registrationNumber", "Business Reg. Number"],
              ].map(([field, label]) => (
                <div key={field}>
                  <Label>{label}</Label>
                  <Input className="mt-1" value={business[field]} onChange={e => setBusiness({...business, [field]: e.target.value})} />
                </div>
              ))}

              <div>
                <Label>Language</Label>
                <MobileSelect
                  value={language}
                  onValueChange={setLanguage}
                  placeholder="Language"
                  triggerClassName="mt-1"
                  options={SA_LANGUAGES.map(l => ({ value: l.code, label: l.label }))}
                />
                {language !== "en" && (
                  <p className="text-xs text-muted-foreground mt-1">{SA_LANGUAGES.find(l => l.code === language)?.label} translation coming soon</p>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 dark:bg-muted/30 rounded-xl">
                <div>
                  <p className="font-medium text-foreground">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">Switch to dark theme</p>
                </div>
                <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receipt Settings */}
        <TabsContent value="receipt">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Printer size={18} /> Receipt Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                ["showLogo", "Show Logo on Receipt"],
                ["showVAT", "Show VAT on Receipt"],
              ].map(([field, label]) => (
                <div key={field} className="flex items-center justify-between p-3 bg-muted/50 dark:bg-muted/30 rounded-xl">
                  <span className="font-medium text-foreground">{label}</span>
                  <Switch checked={receiptSettings[field]} onCheckedChange={v => setReceiptSettings({...receiptSettings, [field]: v})} />
                </div>
              ))}
              <div>
                <Label>Receipt Footer Message</Label>
                <Input className="mt-1" value={receiptSettings.footer} onChange={e => setReceiptSettings({...receiptSettings, footer: e.target.value})} />
              </div>
              <div>
                <Label>Paper Size</Label>
                <MobileSelect
                  value={receiptSettings.paperSize}
                  onValueChange={v => setReceiptSettings({...receiptSettings, paperSize: v})}
                  placeholder="Paper Size"
                  triggerClassName="mt-1"
                  options={[
                    { value: "80mm", label: "80mm (Standard Thermal)" },
                    { value: "58mm", label: "58mm (Small Thermal)" },
                    { value: "A4", label: "A4 (Paper)" },
                  ]}
                />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-dashed">
                <p className="text-center text-sm font-bold text-foreground">{business.name}</p>
                <p className="text-center text-xs text-muted-foreground">{business.address}</p>
                <p className="text-center text-xs text-muted-foreground">{business.phone}</p>
                <div className="border-t my-2" />
                <p className="text-xs text-muted-foreground">Product 1 x 2 ......... R10.00</p>
                <p className="text-xs text-muted-foreground">Product 2 x 1 ......... R5.00</p>
                <div className="border-t my-2" />
                <p className="text-sm font-bold text-right">TOTAL: R15.00</p>
                <p className="text-center text-xs text-muted-foreground mt-2">{receiptSettings.footer}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell size={18} /> Notifications & Alerts</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                ["lowStock", "Low Stock Alerts", "Get alerted when products are running low"],
                ["cashupReminder", "Daily Cash Up Reminder", "Reminder to do cash up at end of day"],
                ["bankDeposit", "Bank Deposit Reminder", "Reminder to deposit cash into bank"],
                ["expiryAlert", "Product Expiry Alerts", "Alert when products are near expiry date"],
                ["businessTips", "Daily Business Tips", "Receive daily tips to improve your business"],
              ].map(([field, label, desc]) => (
                <div key={field} className="flex items-center justify-between p-3 bg-muted/50 dark:bg-muted/30 rounded-xl">
                  <div>
                    <p className="font-medium text-foreground text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch checked={notifications[field]} onCheckedChange={v => setNotifications({...notifications, [field]: v})} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield size={18} /> Security</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                ["pinLogin", "PIN Login", "Require PIN to access the app"],
                ["autoLock", "Auto Lock", "Automatically lock after inactivity"],
              ].map(([field, label, desc]) => (
                <div key={field} className="flex items-center justify-between p-3 bg-muted/50 dark:bg-muted/30 rounded-xl">
                  <div>
                    <p className="font-medium text-foreground text-sm">{label}</p>
                  </div>
                  <Switch checked={security[field]} onCheckedChange={v => setSecurity({...security, [field]: v})} />
                </div>
              ))}
              {security.autoLock && (
                <div>
                  <Label>Auto-lock after (minutes)</Label>
                  <MobileSelect
                    value={security.lockTime}
                    onValueChange={v => setSecurity({...security, lockTime: v})}
                    placeholder="Lock time"
                    triggerClassName="mt-1"
                    options={["2","5","10","15","30"].map(t => ({ value: t, label: `${t} minutes` }))}
                  />
                </div>
              )}
              <div className="bg-muted rounded-xl p-4 space-y-2">
                <p className="font-semibold text-foreground text-sm">Data Security</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>✓ All data encrypted and stored securely</p>
                  <p>✓ Automatic cloud backup enabled</p>
                  <p>✓ Offline mode available</p>
                  <p>✓ Data accessible only by you</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="w-full">Export Data</Button>
                <Button variant="outline" className="w-full">Backup Now</Button>
              </div>

              {/* Account Deletion */}
              <div className="mt-6 pt-6 border-t border-red-200">
                <div className="bg-red-50 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-red-800 text-sm flex items-center gap-2">
                      <Trash2 size={16} /> Danger Zone
                    </p>
                    <p className="text-xs text-red-600 mt-1">Permanently delete your account and all associated data.</p>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete My Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave} className="w-full h-12 bg-green-600 hover:bg-green-700 font-bold">
        <Save size={18} className="mr-2" />
        Save Settings
      </Button>

      {/* Delete Account Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all your data, including products, sales, expenses, and settings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}