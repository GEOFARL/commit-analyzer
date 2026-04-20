import type { DataSource, Repository as OrmRepository } from "typeorm";

import { User } from "../entities/user.entity.js";

export interface UpsertUserFromAuthInput {
  id: string;
  githubId?: string | null;
  email?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  accessToken?: {
    ciphertext: Buffer;
    iv: Buffer;
    tag: Buffer;
  } | null;
}

export interface UserRepository extends OrmRepository<User> {
  findByAuthId(id: string): Promise<User | null>;
  findByGithubId(githubId: string): Promise<User | null>;
  upsertFromAuth(input: UpsertUserFromAuthInput): Promise<User>;
  getDefaultPolicyTemplate(
    userId: string,
  ): Promise<Record<string, unknown> | null>;
  setDefaultPolicyTemplate(
    userId: string,
    template: Record<string, unknown> | null,
  ): Promise<void>;
}

export const createUserRepository = (
  dataSource: DataSource,
): UserRepository =>
  dataSource.getRepository(User).extend({
    findByAuthId(this: OrmRepository<User>, id: string) {
      return this.findOne({ where: { id } });
    },
    findByGithubId(this: OrmRepository<User>, githubId: string) {
      return this.findOne({ where: { githubId } });
    },
    async upsertFromAuth(
      this: OrmRepository<User>,
      input: UpsertUserFromAuthInput,
    ) {
      const existing = await this.findOne({ where: { id: input.id } });
      const entity =
        existing ??
        this.create({
          id: input.id,
          githubId: null,
          email: null,
          username: null,
          avatarUrl: null,
          accessTokenEnc: null,
          accessTokenIv: null,
          accessTokenTag: null,
        });

      if (input.githubId !== undefined) entity.githubId = input.githubId;
      if (input.email !== undefined) entity.email = input.email;
      if (input.username !== undefined) entity.username = input.username;
      if (input.avatarUrl !== undefined) entity.avatarUrl = input.avatarUrl;

      if (input.accessToken === null) {
        entity.accessTokenEnc = null;
        entity.accessTokenIv = null;
        entity.accessTokenTag = null;
      } else if (input.accessToken) {
        entity.accessTokenEnc = input.accessToken.ciphertext;
        entity.accessTokenIv = input.accessToken.iv;
        entity.accessTokenTag = input.accessToken.tag;
      }

      return this.save(entity);
    },
    async getDefaultPolicyTemplate(
      this: OrmRepository<User>,
      userId: string,
    ): Promise<Record<string, unknown> | null> {
      const row = await this.findOne({
        where: { id: userId },
        select: { id: true, defaultPolicyTemplate: true },
      });
      return row?.defaultPolicyTemplate ?? null;
    },
    async setDefaultPolicyTemplate(
      this: OrmRepository<User>,
      userId: string,
      template: Record<string, unknown> | null,
    ): Promise<void> {
      await this.createQueryBuilder()
        .update(User)
        .set({ defaultPolicyTemplate: template as never })
        .where("id = :id", { id: userId })
        .execute();
    },
  }) as UserRepository;
