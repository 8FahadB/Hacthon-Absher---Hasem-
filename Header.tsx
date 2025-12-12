import { Radio, Moon, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
interface HeaderProps {
  systemStatus?: "operational" | "processing" | "error";
}
export default function Header({ systemStatus = "operational" }: HeaderProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);
  const toggleTheme = () => setIsDark(!isDark);
  const getStatusBadge = () => {
    switch (systemStatus) {
      case "processing":
        return <Badge variant="secondary" className="bg-amber-600/20 text-amber-400 border-amber-600/30">جاري المعالجة</Badge>;
      case "error":
        return <Badge variant="destructive">خطأ في النظام</Badge>;
      default:
        return <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">جاهز للعمل</Badge>;
    }
  };
  return (
    <header className="h-16 bg-card border-b border-card-border flex items-center justify-between px-6" data-testid="header">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Radio className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">نظام حسم الأمني</h1>
        </div>
        {getStatusBadge()}
      </div>
      
      <Button 
          size="icon" 
          variant="ghost" 
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
    </header>
  );
}