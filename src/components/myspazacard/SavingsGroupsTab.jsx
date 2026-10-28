import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useEntityQuery, useInvalidateEntity } from "@/hooks/useEntityQuery";
import { Plus, Users, Trash2, Pencil, UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MobileSelect } from "@/components/ui/mobile-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const fmt = (a) => "R " + Number(a || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SavingsGroupsTab() {
  const groupsQuery = useEntityQuery("SavingsGroup", "list", []);
  const invalidate = useInvalidateEntity();
  const [groups, setGroups] = useState([]);
  const loading = groupsQuery.isLoading && !groupsQuery.data;
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const { toast } = useToast();

  useEffect(() => { setGroups(groupsQuery.data || []); }, [groupsQuery.data]);
  const load = () => invalidate("SavingsGroup");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Save together with other shop owners in a stokvel or shared savings group.</p>
        <Button size="sm" onClick={() => { setEdit(null); setModal(true); }} className="bg-green-600 hover:bg-green-700"><Plus size={16} /> New Group</Button>
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : groups.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Users size={40} className="mx-auto mb-2 opacity-40" />
          <p>No savings groups yet. Start a stokvel with other shop owners.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const progress = g.target_amount > 0 ? Math.min(100, (g.current_balance / g.target_amount) * 100) : 0;
            return (
              <div key={g.id} className="bg-white border rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center"><Users size={18} className="text-green-700" /></div>
                      <div>
                        <p className="font-semibold text-gray-800">{g.name}</p>
                        <Badge variant="secondary" className="text-[10px] capitalize">{g.purpose?.replace("_", " ") || "shared savings"}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEdit(g); setModal(true); }}><Pencil size={15} className="text-gray-400 hover:text-gray-600" /></button>
                    <button onClick={() => {
                      setGroups(prev => prev.filter(x => x.id !== g.id));
                      base44.entities.SavingsGroup.delete(g.id).catch(() => {
                        toast({ title: "Delete failed", variant: "destructive" });
                        load();
                      });
                    }}>
                      <Trash2 size={15} className="text-red-400 hover:text-red-600" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-2">{g.description}</p>

                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{fmt(g.current_balance)} saved</span>
                    <span>of {fmt(g.target_amount)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
                  <span>{g.member_count} members</span>
                  <span className="capitalize">{g.contribution_frequency} · {fmt(g.contribution_amount)}</span>
                </div>

                <div className="mt-3 border-t pt-2">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1">Members</p>
                  <div className="space-y-1">
                    {(g.members || []).map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">{m.name}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-gray-500">{fmt(m.contributed)}</span>
                          {m.status === "paid" ? <Check size={12} className="text-green-600" /> : <Badge variant="outline" className="text-[9px]">pending</Badge>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && <GroupForm edit={edit} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
    </div>
  );
}

function GroupForm({ edit, onClose, onSaved }) {
  const [form, setForm] = useState(edit ? {
    name: edit.name, description: edit.description || "", target_amount: edit.target_amount || 0,
    contribution_amount: edit.contribution_amount || 0, contribution_frequency: edit.contribution_frequency || "monthly",
    current_balance: edit.current_balance || 0, member_count: edit.member_count || 1,
    created_by_name: edit.created_by_name || "Shop Owner", status: edit.status || "open",
    purpose: edit.purpose || "shared_savings", members: edit.members || [{ name: "Shop Owner", contributed: 0, status: "pending" }],
  } : {
    name: "", description: "", target_amount: 10000, contribution_amount: 1000, contribution_frequency: "monthly",
    current_balance: 0, member_count: 1, created_by_name: "Shop Owner", status: "open", purpose: "shared_savings",
    members: [{ name: "Shop Owner", contributed: 0, status: "pending" }],
  });
  const [newMember, setNewMember] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const addMember = () => {
    if (!newMember) return;
    setForm({ ...form, members: [...form.members, { name: newMember, contributed: 0, status: "pending" }], member_count: form.members.length + 1 });
    setNewMember("");
  };

  const submit = async () => {
    if (!form.name) { toast({ title: "Group name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (edit) {
        await base44.entities.SavingsGroup.update(edit.id, form);
      } else {
        await base44.entities.SavingsGroup.create(form);
      }
      toast({ title: edit ? "Group updated" : "Group created" });
      onSaved();
    } catch (e) {
      toast({ title: "Error", description: "Could not save", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? "Edit Savings Group" : "New Savings Group"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Group name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Purpose</Label>
            <MobileSelect
              value={form.purpose}
              onValueChange={v => setForm({ ...form, purpose: v })}
              placeholder="Purpose"
              options={[
                { value: "shared_savings", label: "Shared Savings" },
                { value: "stokvel", label: "Stokvel" },
                { value: "bulk_buying", label: "Bulk Buying" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Target (R)</Label><Input type="number" value={form.target_amount} onChange={e => setForm({ ...form, target_amount: parseFloat(e.target.value) })} /></div>
            <div><Label>Contribution (R)</Label><Input type="number" value={form.contribution_amount} onChange={e => setForm({ ...form, contribution_amount: parseFloat(e.target.value) })} /></div>
          </div>
          <div><Label>Frequency</Label>
            <MobileSelect
              value={form.contribution_frequency}
              onValueChange={v => setForm({ ...form, contribution_frequency: v })}
              placeholder="Frequency"
              options={[
                { value: "weekly", label: "Weekly" },
                { value: "bi_weekly", label: "Bi-weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
          </div>
          <div>
            <Label>Members</Label>
            <div className="flex gap-2">
              <Input placeholder="Member name" value={newMember} onChange={e => setNewMember(e.target.value)} />
              <Button type="button" size="sm" onClick={addMember}><UserPlus size={15} /></Button>
            </div>
            <div className="mt-2 space-y-1">
              {form.members.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1">
                  <span>{m.name}</span>
                  <button onClick={() => setForm({ ...form, members: form.members.filter((_, j) => j !== i), member_count: Math.max(1, form.members.length - 1) })}>
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={submit} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">{saving ? "Saving..." : "Save Group"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}