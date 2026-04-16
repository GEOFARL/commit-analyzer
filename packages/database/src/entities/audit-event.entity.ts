import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { User } from "./user.entity.js";

@Entity({ name: "audit_events" })
@Index("audit_events_user_created_idx", ["userId", "createdAt"])
@Index("audit_events_user_type_created_idx", [
  "userId",
  "eventType",
  "createdAt",
])
export class AuditEvent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column("text")
  eventType!: string;

  @Column("jsonb", { default: {} })
  payload!: Record<string, unknown>;

  @Column("inet", { nullable: true })
  ip!: string | null;

  @Column("text", { nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
