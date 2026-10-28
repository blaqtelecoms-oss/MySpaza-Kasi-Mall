import { useState } from "react";
import { GraduationCap, BookOpen, Play, CheckCircle, Star, Store, ClipboardList, Banknote, BarChart2, Lock, TrendingUp, Landmark, Lightbulb, ArrowLeft, ArrowRight, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/AuthContext";
import Certificate from "@/components/academy/Certificate";
import { COURSES } from "@/lib/academyContent";

const ICONS = { Store, ClipboardList, Banknote, BarChart2, Lock, TrendingUp, Landmark, Lightbulb };

const TIPS = [
  "Always keep at least R500 as opening float every morning",
  "Do a stock count every week to catch discrepancies early",
  "Pay yourself a salary from profits — not from the cash till",
  "Record every expense — even small ones add up",
  "Keep your top 20 best-selling products always in stock",
  "Accept card payments — customers spend more when they don't use cash",
  "Never keep large amounts of cash at the shop overnight",
  "Review your sales report every Monday morning",
];

const levelBadge = (level) =>
  level === "Beginner" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" :
  level === "Intermediate" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" :
  "bg-foreground text-background";

export default function Academy() {
  const { user } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null); // { courseId, index }
  const [completedTopics, setCompletedTopics] = useState({});
  const [tipIndex, setTipIndex] = useState(0);
  const [certCourse, setCertCourse] = useState(null);

  const toggleTopic = (courseId, topicIndex) => {
    const key = `${courseId}-${topicIndex}`;
    setCompletedTopics(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getCourseProgress = (course) => {
    const completed = course.topics.filter((_, i) => completedTopics[`${course.id}-${i}`]).length;
    return { completed, total: course.topics.length, percent: Math.round((completed / course.topics.length) * 100) };
  };

  const renderIcon = (iconName, size = 28) => {
    const Icon = ICONS[iconName] || BookOpen;
    return <Icon size={size} strokeWidth={1.75} className="text-foreground" />;
  };

  const activeTopic = selectedTopic && selectedCourse
    ? { course: selectedCourse, topic: selectedCourse.topics[selectedTopic.index], index: selectedTopic.index }
    : null;

  const goTopic = (delta) => {
    if (!activeTopic) return;
    const next = activeTopic.index + delta;
    if (next >= 0 && next < activeTopic.course.topics.length) {
      setSelectedTopic({ courseId: activeTopic.course.id, index: next });
    }
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0D0D0D] to-[#1c1c1c] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <GraduationCap size={32} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Spaza Academy</h1>
            <p className="text-white/60 text-sm">Learn to run a profitable business</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{COURSES.length}</p>
            <p className="text-white/50 text-xs">Courses</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{COURSES.reduce((s, c) => s + c.lessons, 0)}</p>
            <p className="text-white/50 text-xs">Lessons</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">Free</p>
            <p className="text-white/50 text-xs">Always</p>
          </div>
        </div>
      </div>

      {/* Daily Tip */}
      <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Star size={20} className="text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">Business Tip of the Day</p>
              <p className="text-yellow-700 dark:text-yellow-400 mt-1">{TIPS[tipIndex]}</p>
            </div>
            <button
              onClick={() => setTipIndex((tipIndex + 1) % TIPS.length)}
              className="text-yellow-600 hover:text-yellow-800 dark:hover:text-yellow-300 text-xs whitespace-nowrap"
            >
              Next tip →
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Courses Grid */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-3">Courses</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COURSES.map(course => {
            const { completed, total, percent } = getCourseProgress(course);
            return (
              <Card
                key={course.id}
                className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-foreground/30"
                onClick={() => setSelectedCourse(course)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">{renderIcon(course.icon)}</div>
                    <Badge className={`${levelBadge(course.level)} text-xs`}>
                      {course.level}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-foreground mb-1">{course.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{course.description}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1"><BookOpen size={12} /> {course.lessons} lessons</span>
                    <span>{completed}/{total} done</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-foreground h-2 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Course Modal — topic list */}
      <Dialog open={!!selectedCourse && !activeTopic} onOpenChange={() => setSelectedCourse(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedCourse && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">{renderIcon(selectedCourse.icon, 22)}</div>
                  {selectedCourse.title}
                </DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground text-sm">{selectedCourse.description}</p>
              <div className="mt-2">
                <p className="text-sm font-semibold text-foreground mb-3">Lessons ({selectedCourse.topics.length})</p>
                <div className="space-y-2">
                  {selectedCourse.topics.map((topic, i) => {
                    const key = `${selectedCourse.id}-${i}`;
                    const done = completedTopics[key];
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedTopic({ courseId: selectedCourse.id, index: i })}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                          done ? "border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-900" : "border-border hover:border-foreground/30"
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-green-500" : "bg-muted"}`}>
                          {done ? <CheckCircle size={16} className="text-white" /> : <span className="text-xs text-muted-foreground">{i+1}</span>}
                        </div>
                        <span className={`text-sm flex-1 ${done ? "text-green-700 dark:text-green-400 line-through" : "text-foreground"}`}>{topic.title}</span>
                        <Play size={14} className="text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
                {getCourseProgress(selectedCourse).percent === 100 && (
                  <div className="mt-4 bg-green-50 dark:bg-green-950/20 border-2 border-green-300 dark:border-green-900 rounded-xl p-4 text-center">
                    <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                    <p className="font-bold text-green-800 dark:text-green-400">Course Complete!</p>
                    <p className="text-green-600 dark:text-green-400 text-sm mb-3">You've earned a certificate</p>
                    <button
                      onClick={() => setCertCourse(selectedCourse)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90"
                    >
                      <Award size={16} /> View Certificate
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lesson Modal — content viewer */}
      <Dialog open={!!activeTopic} onOpenChange={(open) => { if (!open) setSelectedTopic(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {activeTopic && (
            <>
              <DialogHeader>
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="absolute left-4 top-4 text-muted-foreground hover:text-foreground"
                  aria-label="Back to lessons"
                >
                  <ArrowLeft size={20} />
                </button>
                <DialogTitle className="flex items-center gap-3 pl-8">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">{renderIcon(activeTopic.course.icon, 22)}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-normal text-muted-foreground truncate">{activeTopic.course.title}</p>
                    <p className="truncate">Lesson {activeTopic.index + 1}: {activeTopic.topic.title}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-foreground/90">{activeTopic.topic.content}</p>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    onClick={() => goTopic(-1)}
                    disabled={activeTopic.index === 0}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowLeft size={16} /> Prev
                  </button>

                  <button
                    onClick={() => toggleTopic(activeTopic.course.id, activeTopic.index)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      completedTopics[`${activeTopic.course.id}-${activeTopic.index}`]
                        ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                        : "bg-foreground text-background"
                    }`}
                  >
                    <CheckCircle size={16} />
                    {completedTopics[`${activeTopic.course.id}-${activeTopic.index}`] ? "Completed" : "Mark complete"}
                  </button>

                  <button
                    onClick={() => goTopic(1)}
                    disabled={activeTopic.index === activeTopic.course.topics.length - 1}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    Next <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Certificate */}
      <Certificate
        open={!!certCourse}
        onClose={() => setCertCourse(null)}
        courseTitle={certCourse?.title || ""}
        ownerName={user?.full_name || user?.email || ""}
        completedDate={new Date()}
      />
    </div>
  );
}