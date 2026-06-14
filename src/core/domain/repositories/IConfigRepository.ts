import { Config } from '../entities/Config';

export interface IConfigRepository {
  findById(id: string): Promise<Config | null>;
  update(config: Config): Promise<Config>;
}
