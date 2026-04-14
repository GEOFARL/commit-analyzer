import type { DataSource, Repository as OrmRepository } from "typeorm";

import { User } from "../entities/user.entity.js";

export interface UserRepository extends OrmRepository<User> {
  findByAuthId(id: string): Promise<User | null>;
  findByGithubId(githubId: string): Promise<User | null>;
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
  }) as UserRepository;
