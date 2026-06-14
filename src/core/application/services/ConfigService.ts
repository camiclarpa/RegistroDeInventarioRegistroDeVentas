import { Config } from '../../domain/entities/Config';
import { IConfigRepository } from '../../domain/repositories/IConfigRepository';

export class ConfigService {
  constructor(private readonly configRepo: IConfigRepository) {}

  async getConfig(): Promise<Config | null> {
    return this.configRepo.findById('main');
  }

  async updateConfig(data: Partial<Omit<Config, 'id' | 'createdAt'>>): Promise<Config> {
    const existing = await this.configRepo.findById('main');
    if (!existing) {
      throw new Error('Configuración no encontrada');
    }
    const updated = existing.update(data);
    return this.configRepo.update(updated);
  }
}
