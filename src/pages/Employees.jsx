import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Clock, UserCheck, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileSelect } from "@/components/ui/mobile-select";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";

const ROLES = ["Cashier", "Manager", "Stock Controller", "Cleaner", "Security", "Driver", "Other"];

const MOCK_EMPLOYEES = [
  { id: "1", name: "Sipho Dlamini", role: "Cashier", phone: "082 123 4567", salary: 3500, status: "active", clockedIn: true, startDate: "2024-01-01" },
  { id: "2", name: "Nomsa Khumalo", role: "Manager", phone: "073 987 6543", salary: 6000, status: "active", clockedIn: false, startDate: "2023-06-15" },
];

export default function Employees() {
  const [employees, setEmployees] = useState(MOCK_EMPLOYEES);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", role: "", phone: "", email: "", salary: "", startDate: "", status: "active" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast } = useToast();

  const openNew = () => { setEditItem(null); setForm({ name: "", role: "", phone: "", email: "", salary: "", startDate: "", status: "active" }); setModalOpen(true); };
  const openEdit = (e) => { setEditItem(e); setForm({...e}); setModalOpen(true); };

  const handleSave = () => {
    if (!form.name || !form.role) { toast({ title: "Name and role required", variant: "destructive" }); return; }
    setSaving(true);
    setTimeout(() => {
      if (editItem) {
        setEmployees(prev => prev.map(e => e.id === editItem.id ? {...form, id: editItem.id} : e));
        toast({ title: "Employee Updated" });
      } else {
        setEmployees(prev => [...prev, {...form, id: Date.now().toString(), clockedIn: false}]);
        toast({ title: "Employee Added" });
      }
      setModalOpen(false);
      setSaving(false);
    }, 500);
  };

  const toggleClock = (id) => {
    setEmployees(prev => prev.map(e => e.id === id ? {...e, clockedIn: !e.clockedIn} : e));
    const emp = employees.find(e => e.id === id);
    toast({ title: emp?.clockedIn ? `${emp.name} clocked out` : `${emp.name} clocked in` });
  };

  const handleDelete = (emp) => setDeleteTarget(emp);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setEmployees(prev => prev.filter(e => e.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast({ title: "Employee Removed" });
  };

  const totalPayroll = employees.reduce((sum, e) => sum + (parseFloat(e.salary) || 0), 0);
  const clockedIn = employees.filter(e => e.clockedIn).length;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-muted-foreground text-sm">{employees.length} staff · {clockedIn} clocked in · Monthly payroll: R{totalPayroll.toFixed(0)}</p>
        </div>
        <Button onClick={openNew} className="bg-green-600 hover:bg-green-700 gap-2"><Plus size={18} /> Add Employee</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-muted border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{employees.length}</p>
            <p className="text-xs text-muted-foreground">Total Staff</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{clockedIn}</p>
            <p className="text-xs text-green-600 dark:text-green-400">Working Now</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-red-700 dark:text-red-400">R{totalPayroll.toFixed(0)}</p>
            <p className="text-xs text-red-600 dark:text-red-400">Monthly Payroll</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {employees.map(emp => (
          <Card key={emp.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${emp.clockedIn ? "bg-green-100 dark:bg-green-900/40" : "bg-muted"}`}>
                    <span className={`font-bold text-lg ${emp.clockedIn ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                      {emp.name[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{emp.name}</h3>
                    <Badge variant="outline" className="text-xs">{emp.role}</Badge>
                    {emp.phone && <p className="text-xs text-muted-foreground mt-0.5">{emp.phone}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={`flex items-center gap-1.5 ${emp.clockedIn ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${emp.clockedIn ? "bg-green-600" : "bg-muted-foreground"}`} />
                    {emp.clockedIn ? "In" : "Out"}
                  </Badge>
                  {emp.salary && <p className="text-xs text-muted-foreground">R{parseFloat(emp.salary).toFixed(0)}/mo</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={() => toggleClock(emp.id)}
                  size="sm"
                  variant="outline"
                  className={`flex-1 gap-1.5 ${emp.clockedIn ? "border-red-300 text-red-600 hover:bg-red-50" : "border-green-300 text-green-600 hover:bg-green-50"}`}
                >
                  <Clock size={14} />
                  {emp.clockedIn ? "Clock Out" : "Clock In"}
                </Button>
                <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => openEdit(emp)}>
                  <Edit size={18} className="text-foreground" />
                </Button>
                <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => handleDelete(emp)}>
                  <Trash2 size={15} className="text-red-400" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editItem ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full Name *</Label>
              <Input className="mt-1" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <Label>Role *</Label>
              <MobileSelect
                value={form.role}
                onValueChange={v => setForm({...form, role: v})}
                placeholder="Select role"
                triggerClassName="mt-1"
                options={ROLES.map(r => ({ value: r, label: r }))}
              />
            </div>
            {[["phone","Phone Number"], ["email","Email"]].map(([f, l]) => (
              <div key={f}>
                <Label>{l}</Label>
                <Input className="mt-1" value={form[f] || ""} onChange={e => setForm({...form, [f]: e.target.value})} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monthly Salary (R)</Label>
                <Input className="mt-1" type="number" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input className="mt-1" type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-3">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">
              {saving ? "Saving..." : editItem ? "Update" : "Add Employee"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove Employee"
        description={`Are you sure you want to remove "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        confirmLabel="Remove"
      />
    </div>
  );
}