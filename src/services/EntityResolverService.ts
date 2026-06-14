import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

export interface ResolvedEntity {
  id: string;
  name: string;
  created: boolean;
}

function normalizeEntityName(raw: string): string {
  return raw.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export class EntityResolverService {
  async findOrCreateCategory(rawName: string): Promise<ResolvedEntity> {
    const name = normalizeEntityName(rawName);
    const existing = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name FROM categories WHERE UPPER(name) = ${name} AND "isActive" = true LIMIT 1
    `;
    if (existing.length > 0) return { id: existing[0].id, name: existing[0].name, created: false };

    const slug = slugify(name);
    const codePrefix = name.substring(0, 6).replace(/[^A-Z0-9]/g, '').padEnd(3, 'X');
    const created = await prisma.categories.create({
      data: {
        name,
        slug,
        codePrefix,
        marginPercentage: 30,
        isActive: true
      } as any,
    });
    return { id: created.id, name: created.name, created: true };
  }

  async findOrCreateBrand(rawName: string): Promise<ResolvedEntity> {
    const name = normalizeEntityName(rawName);
    const existing = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name FROM brands WHERE UPPER(name) = ${name} AND "isActive" = true LIMIT 1
    `;
    if (existing.length > 0) return { id: existing[0].id, name: existing[0].name, created: false };

    const created = await prisma.brands.create({
      data: { name, isActive: true } as any,
    });
    return { id: created.id, name: created.name, created: true };
  }

  calculateOptimalMinStock(category: string, price: number, currentStock?: number): number {
    let base = 5;
    if (price > 100000) base = 3;
    else if (price < 50000) base = 20;
    const cat = category.toUpperCase();
    if (cat.includes('ACEITE')) base = Math.round(base * 1.5);
    if (cat.includes('BUJIA')) base = Math.round(base * 2);
    if (currentStock && currentStock > 100) base = Math.max(base, Math.round(currentStock * 0.1));
    return Math.max(1, Math.round(base));
  }
}

