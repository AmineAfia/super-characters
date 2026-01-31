"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="flex items-center justify-center h-full bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-accent/10">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to Super Characters</CardTitle>
          <CardDescription>
            Your app is ready. Start building something amazing!
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={() => alert("Hello from Wails!")}>
            Get Started
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
