import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Check, ChevronDown } from "lucide-react";

export function MobileSelect({ value, onValueChange, options, placeholder = "Select", triggerClassName = "" }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={triggerClassName}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center justify-between w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ${triggerClassName}`}
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className="opacity-50" />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[60vh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="text-base">{placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto space-y-1 max-h-[50vh]">
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onValueChange(o.value); setOpen(false); }}
                className={`flex items-center justify-between w-full p-3 rounded-lg text-left transition-colors ${
                  o.value === value ? "bg-green-50 text-green-700 font-medium" : "hover:bg-gray-100"
                }`}
              >
                {o.label}
                {o.value === value && <Check size={18} />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}