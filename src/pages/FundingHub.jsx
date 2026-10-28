import { useState } from "react";
import { ExternalLink, CheckCircle, Landmark, ClipboardList, Globe, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const FUNDERS = [
  {
    id: 1, name: "SEFA", fullName: "Small Enterprise Finance Agency",
    icon: <Landmark size={28} strokeWidth={1.75} className="text-foreground" />, type: "Government", maxAmount: "R5 million",
    interest: "From 5% per annum", description: "State-owned finance company that provides financial products to qualifying small, medium and micro enterprises.",
    requirements: ["South African citizen", "Business registered in SA", "Business plan required", "Good credit record", "Operating for 2+ years (preferred)"],
    link: "https://www.sefa.org.za",
    tags: ["Loans", "Government", "Microfinance"]
  },
  {
    id: 2, name: "SEDA", fullName: "Small Enterprise Development Agency",
    icon: <ClipboardList size={28} strokeWidth={1.75} className="text-foreground" />, type: "Government", maxAmount: "Non-financial support",
    interest: "Free", description: "Provides non-financial support including mentorship, training, business planning, and market access to SMMEs.",
    requirements: ["South African citizen", "Formal or informal business", "Willing to attend training"],
    link: "https://www.seda.org.za",
    tags: ["Mentorship", "Training", "Free"]
  },
  {
    id: 3, name: "NEF", fullName: "National Empowerment Fund",
    icon: <Globe size={28} strokeWidth={1.75} className="text-foreground" />, type: "Government", maxAmount: "R75 million",
    interest: "Competitive rates", description: "Provides finance to black entrepreneurs and communities for creating and expanding businesses.",
    requirements: ["Black South African owned (51%+)", "Job creation commitment", "Viable business plan", "Own contribution required"],
    link: "https://www.nef.org.za",
    tags: ["BEE", "Large funding", "Growth"]
  },
  {
    id: 4, name: "Capitec Business", fullName: "Capitec Bank Business Loans",
    icon: <Landmark size={28} strokeWidth={1.75} className="text-foreground" />, type: "Bank", maxAmount: "R500 000",
    interest: "From Prime + 2%", description: "Simple and accessible business loans for small businesses. Easy application process.",
    requirements: ["Business bank account", "3 months bank statements", "South African ID", "Good credit record"],
    link: "https://www.capitecbank.co.za",
    tags: ["Bank Loan", "Fast approval"]
  },
  {
    id: 5, name: "FNB Business", fullName: "First National Bank Business",
    icon: <Landmark size={28} strokeWidth={1.75} className="text-foreground" />, type: "Bank", maxAmount: "R5 million",
    interest: "Prime based", description: "Wide range of business finance products for growing businesses.",
    requirements: ["FNB business account", "6+ months trading history", "Financial statements"],
    link: "https://www.fnb.co.za",
    tags: ["Bank Loan", "Overdraft", "Asset Finance"]
  },
  {
    id: 6, name: "Lula", fullName: "Lula Business Finance",
    icon: <Zap size={28} strokeWidth={1.75} className="text-foreground" />, type: "Fintech", maxAmount: "R5 million",
    interest: "Flexible rates", description: "Alternative business funder offering fast access to capital based on your business bank account data.",
    requirements: ["6+ months in business", "Business bank account", "Minimum monthly revenue"],
    link: "https://lula.co.za",
    tags: ["Fast funding", "Fintech", "Revenue-based"]
  },
];

const CHECKLIST = [
  { id: 1, label: "Business registered with CIPC", category: "Legal" },
  { id: 2, label: "Tax registered with SARS", category: "Legal" },
  { id: 3, label: "Business bank account open", category: "Banking" },
  { id: 4, label: "3-6 months bank statements available", category: "Banking" },
  { id: 5, label: "Business plan written", category: "Planning" },
  { id: 6, label: "Financial projections (12 months)", category: "Planning" },
  { id: 7, label: "Personal ID document copy", category: "Documents" },
  { id: 8, label: "Proof of residence", category: "Documents" },
  { id: 9, label: "Good personal credit record", category: "Credit" },
  { id: 10, label: "No outstanding SARS debt", category: "Legal" },
  { id: 11, label: "Clear police clearance", category: "Legal" },
  { id: 12, label: "Quotes for equipment/stock needed", category: "Planning" },
];

const typeBadge = (type) =>
  type === "Government" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" :
  type === "Bank" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" :
  "bg-muted text-foreground";

export default function FundingHub() {
  const [checklist, setChecklist] = useState({});
  const [selectedFunder, setSelectedFunder] = useState(null);

  const toggleCheck = (id) => setChecklist(prev => ({...prev, [id]: !prev[id]}));
  const score = Math.round((Object.values(checklist).filter(Boolean).length / CHECKLIST.length) * 100);

  const scoreColor = score >= 80 ? "text-green-600 dark:text-green-400" : score >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const scoreBg = score >= 80 ? "bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-900" : score >= 50 ? "bg-yellow-50 border-yellow-300 dark:bg-yellow-950/20 dark:border-yellow-900" : "bg-red-50 border-red-300 dark:bg-red-950/20 dark:border-red-900";

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0D0D0D] to-[#1c1c1c] rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold tracking-tight">Funding Hub</h1>
        <p className="text-white/60 mt-1">Find funding to grow your spaza shop</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{FUNDERS.length}</p>
            <p className="text-white/50 text-xs">Funders Listed</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">R75M</p>
            <p className="text-white/50 text-xs">Max Available</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{score}%</p>
            <p className="text-white/50 text-xs">Your Readiness</p>
          </div>
        </div>
      </div>

      {/* Readiness Score */}
      <Card className={`border-2 ${scoreBg}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-foreground">Funding Readiness Score</h2>
              <p className="text-sm text-muted-foreground">Complete the checklist below to improve your score</p>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-bold ${scoreColor}`}>{score}%</p>
              <p className="text-xs text-muted-foreground">{Object.values(checklist).filter(Boolean).length}/{CHECKLIST.length} done</p>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-3 mb-3">
            <div className={`h-3 rounded-full transition-all ${score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${score}%` }} />
          </div>
          <p className={`text-sm font-medium ${scoreColor}`}>
            {score >= 80 ? "Excellent! You're ready to apply for funding" :
             score >= 50 ? "Good progress! A few more items to complete" :
             "Let's get you ready — complete the checklist below"}
          </p>
        </CardContent>
      </Card>

      {/* Application Checklist */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList size={18} /> Application Checklist</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {CHECKLIST.map(item => (
              <button
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  checklist[item.id] ? "border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-900" : "border-border hover:border-foreground/30"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${checklist[item.id] ? "bg-green-500" : "bg-muted"}`}>
                  {checklist[item.id] ? <CheckCircle size={14} className="text-white" /> : null}
                </div>
                <span className={`text-sm flex-1 ${checklist[item.id] ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.label}</span>
                <Badge variant="outline" className="text-xs">{item.category}</Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Funders */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-3">Available Funding Sources</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {FUNDERS.map(funder => (
            <Card key={funder.id} className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-foreground/30"
              onClick={() => setSelectedFunder(funder)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">{funder.icon}</div>
                    <div>
                      <h3 className="font-bold text-foreground">{funder.name}</h3>
                      <p className="text-xs text-muted-foreground">{funder.fullName}</p>
                    </div>
                  </div>
                  <Badge className={typeBadge(funder.type)}>
                    {funder.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{funder.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-2">
                    <p className="text-muted-foreground">Max Amount</p>
                    <p className="font-bold text-green-700 dark:text-green-400">{funder.maxAmount}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2">
                    <p className="text-muted-foreground">Interest</p>
                    <p className="font-bold text-foreground">{funder.interest}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {funder.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Funder Detail Modal */}
      <Dialog open={!!selectedFunder} onOpenChange={() => setSelectedFunder(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          {selectedFunder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">{selectedFunder.icon}</div>
                  {selectedFunder.name}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{selectedFunder.description}</p>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Maximum Amount</p>
                  <p className="font-bold text-green-700 dark:text-green-400">{selectedFunder.maxAmount}</p>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Interest Rate</p>
                  <p className="font-bold text-foreground">{selectedFunder.interest}</p>
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-2">Requirements:</p>
                <div className="space-y-1.5">
                  {selectedFunder.requirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                      {req}
                    </div>
                  ))}
                </div>
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700 gap-2" onClick={() => window.open(selectedFunder.link, "_blank")}>
                <ExternalLink size={16} /> Apply / Learn More
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}