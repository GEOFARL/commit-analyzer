import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  badge: string;
};

export const ComingSoonCard = ({ icon, title, description, badge }: Props) => (
  <Card className="group relative overflow-hidden">
    <div
      aria-hidden="true"
      className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl"
    />
    <CardHeader>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <CardTitle className="mt-3">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <Badge variant="secondary">{badge}</Badge>
    </CardContent>
  </Card>
);
